import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useKanbanBoards, useKanbanBoardColunas, type KanbanBoardColuna } from "@/hooks/useKanbanBoards";
import { colunaEhFinal, etapaComoKanban, useMembrosDeTodosQuadros } from "@/hooks/useQuadros";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { sugerirStatusParaColuna } from "@/components/kanban/ConfirmarStatusDemandaDialog";
import { normalizarBusca } from "@/lib/busca";
import { toast } from "sonner";
import type { DemandaSelecionada } from "./AcoesEmLote";

/**
 * Enviar várias demandas para um quadro (o seu pessoal ou um projeto de que
 * você participa): um cartão por demanda, já vinculado a ela.
 *
 * A etapa pode ser uma só para todas ou escolhida por status: as
 * selecionadas são agrupadas pelo status atual e cada grupo vai para uma
 * etapa (com sugestão pronta; dá para deixar um grupo de fora). Assim dá para
 * mandar centenas de demandas de uma vez, cada uma no estágio em que está.
 * Demandas que já estão naquele quadro são puladas.
 */

const LOTE = 200;
const NAO_ENVIAR = "__nao__";
const SEM_STATUS = "__sem_status__";

type ModoEtapa = "status" | "uma";
interface StatusInfo { slug: string; nome: string; cor?: string | null; ordem: number; is_final?: boolean }

/** Etapa sugerida para um status: mesmo nome > regra do quadro > final/inicial. */
function etapaSugerida(status: StatusInfo | undefined, colunas: KanbanBoardColuna[], statusList: StatusInfo[]): string {
  if (colunas.length === 0) return NAO_ENVIAR;
  const primeiraAberta = (colunas.find((c) => !colunaEhFinal(c)) ?? colunas[0]).id;
  if (!status) return primeiraAberta;
  const mesmoNome = colunas.find((c) => {
    const nome = normalizarBusca(c.nome);
    return nome === normalizarBusca(status.nome) || nome === normalizarBusca(status.slug.replace(/_/g, " "));
  });
  if (mesmoNome) return mesmoNome.id;
  const pelaRegra = colunas.find((c) => sugerirStatusParaColuna(etapaComoKanban(c), statusList as any) === status.slug);
  if (pelaRegra) return pelaRegra.id;
  if (status.is_final) return colunas.find((c) => colunaEhFinal(c))?.id ?? colunas[colunas.length - 1].id;
  return primeiraAberta;
}

export function EnviarParaQuadroDialog({
  aberto, onAbertoChange, selecionadas, onConcluido,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  selecionadas: DemandaSelecionada[];
  onConcluido: () => void;
}) {
  const { user } = useAuth();
  const uid = user?.id || "";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { boards } = useKanbanBoards();
  const membros = useMembrosDeTodosQuadros();
  const { statusList } = useDemandaStatus() as { statusList: StatusInfo[] };
  const [quadroId, setQuadroId] = useState("");
  const [modo, setModo] = useState<ModoEtapa>("status");
  const [colunaUnica, setColunaUnica] = useState("");
  const [porStatus, setPorStatus] = useState<Record<string, string>>({});
  const [responsavel, setResponsavel] = useState<"demanda" | "eu">("demanda");
  const [registrar, setRegistrar] = useState(true);
  const [rodando, setRodando] = useState(false);

  // Onde a pessoa pode criar cartões: o próprio quadro pessoal e os projetos de que é membro
  const meu = boards.find((b) => b.tipo === "pessoal" && b.dono_id === uid);
  const projetos = useMemo(() => boards
    .filter((b) => (b.tipo ?? "projeto") !== "pessoal" && (b.tipo === "equipe" || (membros.get(b.id) || []).includes(uid)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [boards, membros, uid]);
  const { colunas } = useKanbanBoardColunas(quadroId || undefined);

  // Grupos por status atual (na ordem dos status do gabinete)
  const grupos = useMemo(() => {
    const cont = new Map<string, number>();
    selecionadas.forEach((d) => { const k = d.status || SEM_STATUS; cont.set(k, (cont.get(k) || 0) + 1); });
    const ordem = (k: string) => statusList.find((s) => s.slug === k)?.ordem ?? 999;
    return [...cont.entries()].sort((a, b) => ordem(a[0]) - ordem(b[0])).map(([slug, total]) => ({
      slug, total, info: statusList.find((s) => s.slug === slug),
    }));
  }, [selecionadas, statusList]);

  useEffect(() => {
    if (!aberto) return;
    setQuadroId(""); setColunaUnica(""); setPorStatus({}); setResponsavel("demanda"); setRegistrar(true);
    setModo(grupos.length > 1 ? "status" : "uma");
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ao escolher o quadro, preenche as sugestões
  useEffect(() => {
    if (!quadroId || colunas.length === 0) return;
    setColunaUnica((colunas.find((c) => !colunaEhFinal(c)) ?? colunas[0]).id);
    const sug: Record<string, string> = {};
    grupos.forEach((g) => { sug[g.slug] = etapaSugerida(g.info, colunas, statusList); });
    setPorStatus(sug);
  }, [quadroId, colunas]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = selecionadas.length;
  const nomeQuadro = quadroId === meu?.id ? "Meu quadro" : boards.find((b) => b.id === quadroId)?.nome ?? "";
  const destinoDe = (d: DemandaSelecionada) => (modo === "uma" ? colunaUnica : porStatus[d.status || SEM_STATUS] ?? NAO_ENVIAR);
  const vaoSer = selecionadas.filter((d) => { const c = destinoDe(d); return c && c !== NAO_ENVIAR; }).length;
  const pronto = !!quadroId && colunas.length > 0 && vaoSer > 0;

  const enviar = async () => {
    if (!pronto) return;
    setRodando(true);
    try {
      const alvo = selecionadas.filter((d) => { const c = destinoDe(d); return c && c !== NAO_ENVIAR; });
      const ids = alvo.map((d) => d.id);

      // 1) quais já estão neste quadro (não duplica)
      const jaEstao = new Set<string>();
      for (let i = 0; i < ids.length; i += LOTE) {
        const { data, error } = await (supabase.from("kanban_board_card_demandas") as any)
          .select("demanda_id, kanban_board_cards!inner(board_id)")
          .eq("kanban_board_cards.board_id", quadroId)
          .in("demanda_id", ids.slice(i, i + LOTE));
        if (error) throw error;
        (data ?? []).forEach((r: any) => jaEstao.add(r.demanda_id));
      }
      const novas = alvo.filter((d) => !jaEstao.has(d.id));

      // 2) responsável de cada demanda (se for o caso) e a última posição de cada etapa
      const resp = new Map<string, string | null>();
      if (responsavel === "demanda" && novas.length > 0) {
        for (let i = 0; i < novas.length; i += LOTE) {
          const { data } = await supabase.from("demandas").select("id, responsavel_id").in("id", novas.slice(i, i + LOTE).map((d) => d.id));
          (data ?? []).forEach((r: any) => resp.set(r.id, r.responsavel_id));
        }
      }
      const { data: posicoes } = await supabase.from("kanban_board_cards").select("coluna_id, ordem").eq("board_id", quadroId)
        .order("ordem", { ascending: false }).limit(5000);
      const ultima = new Map<string, number>();
      (posicoes ?? []).forEach((p: any) => { if (!ultima.has(p.coluna_id)) ultima.set(p.coluna_id, Number(p.ordem) || 0); });

      // 3) cria os cartões (cada um na sua etapa) e vincula as demandas
      let criados = 0;
      const porEtapa = new Map<string, number>();
      for (let i = 0; i < novas.length; i += LOTE) {
        const parte = novas.slice(i, i + LOTE);
        const chave = new Map<string, string>(); // "coluna|ordem" -> demanda
        const linhas = parte.map((d) => {
          const coluna = destinoDe(d);
          const ordem = (ultima.get(coluna) ?? 0) + 1;
          ultima.set(coluna, ordem);
          chave.set(`${coluna}|${ordem}`, d.id);
          return {
            board_id: quadroId, coluna_id: coluna, titulo: d.titulo || `Demanda #${d.protocolo ?? ""}`,
            responsavel_id: responsavel === "eu" ? uid : (resp.get(d.id) ?? null),
            prioridade: "media", cor: "#0f766e", ordem, created_by: uid,
          };
        });
        const { data: cards, error } = await (supabase.from("kanban_board_cards") as any).insert(linhas).select("id, coluna_id, ordem");
        if (error) throw error;
        // cada cartão volta com etapa + posição (únicas neste envio): é por elas que achamos a demanda
        const vinculos = (cards ?? [])
          .map((c: any) => ({ card_id: c.id, demanda_id: chave.get(`${c.coluna_id}|${Number(c.ordem)}`)!, coluna: c.coluna_id }))
          .filter((v: any) => v.demanda_id);
        if (vinculos.length) {
          const { error: eV } = await (supabase.from("kanban_board_card_demandas") as any)
            .insert(vinculos.map(({ card_id, demanda_id }: any) => ({ card_id, demanda_id })));
          if (eV) throw eV;
        }
        vinculos.forEach((v: any) => porEtapa.set(v.coluna, (porEtapa.get(v.coluna) || 0) + 1));
        criados += vinculos.length;
      }

      // 4) histórico na demanda
      if (registrar && criados > 0) {
        const nomeEtapa = (id: string) => colunas.find((c) => c.id === id)?.nome ?? "";
        for (let i = 0; i < novas.length; i += LOTE) {
          const linhas = novas.slice(i, i + LOTE).map((d) => ({
            demanda_id: d.id, created_by: uid, tipo_atividade: "comentario",
            titulo: `Enviada para o quadro "${nomeQuadro}"`, descricao: `Cartão criado na etapa "${nomeEtapa(destinoDe(d))}".`,
          }));
          await (supabase.from("demanda_atividades") as any).insert(linhas);
        }
      }
      await supabase.from("kanban_boards").update({ updated_at: new Date().toISOString() }).eq("id", quadroId);

      qc.invalidateQueries({ queryKey: ["kanban-board-cards", quadroId] });
      qc.invalidateQueries({ queryKey: ["quadro-extras", quadroId] });
      qc.invalidateQueries({ queryKey: ["kanban-boards"] });
      qc.invalidateQueries({ queryKey: ["inicio-minhas-tarefas"] });
      const destino = quadroId;
      const resumoEtapas = [...porEtapa.entries()].map(([c, k]) => `${k} em ${colunas.find((x) => x.id === c)?.nome ?? "?"}`).join(" · ");
      const pulos = [
        jaEstao.size > 0 ? `${jaEstao.size} já estava${jaEstao.size === 1 ? "" : "m"} no quadro` : "",
        n - alvo.length > 0 ? `${n - alvo.length} ${n - alvo.length === 1 ? "ficou" : "ficaram"} de fora (escolha sua)` : "",
      ].filter(Boolean).join(" · ");
      toast.success(criados === 0 ? `Nada novo em "${nomeQuadro}"`
        : `${criados.toLocaleString("pt-BR")} ${criados === 1 ? "cartão criado" : "cartões criados"} em "${nomeQuadro}"`, {
        description: [resumoEtapas, pulos].filter(Boolean).join(". ") || undefined,
        action: { label: "Abrir o quadro", onClick: () => navigate(`/quadros/${destino}`) },
      });
      onAbertoChange(false);
      onConcluido();
    } catch (e: any) {
      toast.error("Não foi possível enviar: " + (e?.message || "erro"));
    } finally {
      setRodando(false);
    }
  };

  const opcoesEtapa = (comNaoEnviar?: boolean) => (
    <SelectContent>
      {colunas.map((c) => (
        <SelectItem key={c.id} value={c.id}>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.cor }} />{c.nome}</span>
        </SelectItem>
      ))}
      {comNaoEnviar && (<><SelectSeparator /><SelectItem value={NAO_ENVIAR}>Não enviar</SelectItem></>)}
    </SelectContent>
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !rodando && onAbertoChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar {n.toLocaleString("pt-BR")} demanda{n === 1 ? "" : "s"} para um quadro</DialogTitle>
          <DialogDescription>
            Cada demanda vira um cartão vinculado a ela. Ao mover o cartão de etapa, o quadro oferece atualizar o status da demanda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Quadro</Label>
            <Select value={quadroId} onValueChange={setQuadroId}>
              <SelectTrigger><SelectValue placeholder="Escolha o quadro" /></SelectTrigger>
              <SelectContent>
                {meu && (
                  <SelectGroup>
                    <SelectLabel>Pessoal</SelectLabel>
                    <SelectItem value={meu.id}>Meu quadro</SelectItem>
                  </SelectGroup>
                )}
                <SelectGroup>
                  <SelectLabel>Projetos de que você participa</SelectLabel>
                  {projetos.length === 0
                    ? <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum. Entre num projeto pela página Quadros.</div>
                    : projetos.map((b) => <SelectItem key={b.id} value={b.id}>{b.icone ? `${b.icone} ` : ""}{b.nome}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {quadroId && colunas.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Etapa no quadro</Label>
                <div className="flex rounded-lg border bg-muted/30 p-0.5" role="radiogroup" aria-label="Como escolher a etapa">
                  {([["status", "Por status"], ["uma", "Uma para todas"]] as const).map(([v, r]) => (
                    <button key={v} type="button" role="radio" aria-checked={modo === v} onClick={() => setModo(v)}
                      className={`px-3 py-1 text-xs rounded-md ${modo === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>{r}</button>
                  ))}
                </div>
              </div>

              {modo === "uma" ? (
                <Select value={colunaUnica} onValueChange={setColunaUnica}>
                  <SelectTrigger><SelectValue placeholder="Escolha a etapa" /></SelectTrigger>
                  {opcoesEtapa()}
                </Select>
              ) : (
                <div className="rounded-lg border divide-y">
                  <p className="px-3 py-2 text-xs text-muted-foreground bg-muted/30">
                    Cada demanda vai para a etapa do seu status atual. Já sugerimos uma; ajuste se precisar.
                  </p>
                  {grupos.map((g) => (
                    <div key={g.slug} className="flex items-center gap-3 px-3 py-2">
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.info?.cor || "hsl(var(--muted-foreground))" }} />
                        <span className="truncate">{g.info?.nome ?? (g.slug === SEM_STATUS ? "Sem status" : g.slug)}</span>
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{g.total.toLocaleString("pt-BR")}</span>
                      </span>
                      <span className="text-muted-foreground text-xs shrink-0" aria-hidden>→</span>
                      <Select value={porStatus[g.slug] ?? NAO_ENVIAR} onValueChange={(v) => setPorStatus((m) => ({ ...m, [g.slug]: v }))}>
                        <SelectTrigger className="h-8 w-[44%] text-xs" aria-label={`Etapa para ${g.info?.nome ?? g.slug}`}><SelectValue /></SelectTrigger>
                        {opcoesEtapa(true)}
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Responsável pelo cartão</Label>
            <div className="flex rounded-lg border bg-muted/30 p-0.5 w-fit" role="radiogroup" aria-label="Responsável pelo cartão">
              {([["demanda", "O da demanda"], ["eu", "Eu"]] as const).map(([v, r]) => (
                <button key={v} type="button" role="radio" aria-checked={responsavel === v} onClick={() => setResponsavel(v)}
                  className={`px-3 py-1 text-xs rounded-md ${responsavel === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>{r}</button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={registrar} onCheckedChange={(v) => setRegistrar(!!v)} className="mt-0.5" />
            <span>Registrar nas atividades de cada demanda <span className="text-muted-foreground">(o histórico mostra para qual quadro foi)</span></span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onAbertoChange(false)} disabled={rodando}>Cancelar</Button>
          <Button onClick={enviar} disabled={!pronto || rodando}>
            {rodando ? "Enviando…" : `Enviar ${vaoSer.toLocaleString("pt-BR")}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
