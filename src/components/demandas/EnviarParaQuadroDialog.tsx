import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useKanbanBoards, useKanbanBoardColunas } from "@/hooks/useKanbanBoards";
import { colunaEhFinal, useMembrosDeTodosQuadros } from "@/hooks/useQuadros";
import { toast } from "sonner";
import type { DemandaSelecionada } from "./AcoesEmLote";

/**
 * Enviar várias demandas para um quadro (o seu pessoal ou um projeto de que
 * você participa): um cartão por demanda, já vinculado a ela. Depois, ao
 * mover o cartão de etapa, o quadro oferece atualizar o status da demanda.
 * Demandas que já estão naquele quadro são puladas.
 */

const LOTE = 200;

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
  const [quadroId, setQuadroId] = useState("");
  const [colunaId, setColunaId] = useState("");
  const [responsavel, setResponsavel] = useState<"demanda" | "eu">("demanda");
  const [registrar, setRegistrar] = useState(true);
  const [rodando, setRodando] = useState(false);

  // Onde a pessoa pode criar cartões: o próprio quadro pessoal e os projetos de que é membro
  const meu = boards.find((b) => b.tipo === "pessoal" && b.dono_id === uid);
  const projetos = useMemo(() => boards
    .filter((b) => (b.tipo ?? "projeto") !== "pessoal" && (b.tipo === "equipe" || (membros.get(b.id) || []).includes(uid)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [boards, membros, uid]);

  const { colunas } = useKanbanBoardColunas(quadroId || undefined);
  useEffect(() => { if (aberto) { setQuadroId(""); setColunaId(""); setResponsavel("demanda"); setRegistrar(true); } }, [aberto]);
  // Etapa sugerida: a primeira que não é de conclusão
  useEffect(() => {
    if (!quadroId || colunas.length === 0) return;
    if (!colunas.some((c) => c.id === colunaId)) setColunaId((colunas.find((c) => !colunaEhFinal(c)) ?? colunas[0]).id);
  }, [quadroId, colunas]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = selecionadas.length;
  const nomeQuadro = quadroId === meu?.id ? "Meu quadro" : boards.find((b) => b.id === quadroId)?.nome ?? "";

  const enviar = async () => {
    if (!quadroId || !colunaId) return;
    setRodando(true);
    try {
      const ids = selecionadas.map((d) => d.id);

      // 1) quais já estão neste quadro (não duplica)
      const jaEstao = new Set<string>();
      for (let i = 0; i < ids.length; i += LOTE) {
        const { data, error } = await (supabase.from("kanban_board_card_demandas") as any)
          .select("demanda_id, kanban_board_cards!inner(board_id, arquivado_em)")
          .eq("kanban_board_cards.board_id", quadroId)
          .in("demanda_id", ids.slice(i, i + LOTE));
        if (error) throw error;
        (data ?? []).forEach((r: any) => jaEstao.add(r.demanda_id));
      }
      const novas = selecionadas.filter((d) => !jaEstao.has(d.id));

      // 2) responsável de cada demanda (se for o caso) e ordem na etapa
      const resp = new Map<string, string | null>();
      if (responsavel === "demanda" && novas.length > 0) {
        for (let i = 0; i < novas.length; i += LOTE) {
          const { data } = await supabase.from("demandas").select("id, responsavel_id").in("id", novas.slice(i, i + LOTE).map((d) => d.id));
          (data ?? []).forEach((r: any) => resp.set(r.id, r.responsavel_id));
        }
      }
      const { data: ultimo } = await supabase.from("kanban_board_cards").select("ordem").eq("coluna_id", colunaId)
        .order("ordem", { ascending: false }).limit(1);
      let ordem = Number(ultimo?.[0]?.ordem ?? 0);

      // 3) cria os cartões e vincula as demandas
      let criados = 0;
      for (let i = 0; i < novas.length; i += LOTE) {
        const parte = novas.slice(i, i + LOTE);
        const porOrdem = new Map<number, string>();
        const linhas = parte.map((d) => {
          ordem += 1;
          porOrdem.set(ordem, d.id);
          return {
            board_id: quadroId, coluna_id: colunaId, titulo: d.titulo || `Demanda #${d.protocolo ?? ""}`,
            responsavel_id: responsavel === "eu" ? uid : (resp.get(d.id) ?? null),
            prioridade: "media", cor: "#0f766e", ordem, created_by: uid,
          };
        });
        const { data: cards, error } = await (supabase.from("kanban_board_cards") as any).insert(linhas).select("id, ordem");
        if (error) throw error;
        // cada cartão volta com a sua ordem (única neste envio): é por ela que achamos a demanda
        const vinculos = (cards ?? []).map((c: any) => ({ card_id: c.id, demanda_id: porOrdem.get(Number(c.ordem))! })).filter((v: any) => v.demanda_id);
        if (vinculos.length) {
          const { error: eV } = await (supabase.from("kanban_board_card_demandas") as any).insert(vinculos);
          if (eV) throw eV;
        }
        criados += vinculos.length;
      }

      // 4) histórico na demanda
      if (registrar && criados > 0) {
        const etapa = colunas.find((c) => c.id === colunaId)?.nome ?? "";
        for (let i = 0; i < novas.length; i += LOTE) {
          const linhas = novas.slice(i, i + LOTE).map((d) => ({
            demanda_id: d.id, created_by: uid, tipo_atividade: "comentario",
            titulo: `Enviada para o quadro "${nomeQuadro}"`, descricao: `Cartão criado na etapa "${etapa}".`,
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
      const titulo = criados === 0 ? `Nada novo em "${nomeQuadro}"`
        : `${criados.toLocaleString("pt-BR")} ${criados === 1 ? "cartão criado" : "cartões criados"} em "${nomeQuadro}"`;
      toast.success(titulo, {
        description: jaEstao.size > 0 ? `${jaEstao.size} já estava${jaEstao.size === 1 ? "" : "m"} neste quadro e ${jaEstao.size === 1 ? "foi pulada" : "foram puladas"}.` : undefined,
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

  return (
    <Dialog open={aberto} onOpenChange={(v) => !rodando && onAbertoChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar {n.toLocaleString("pt-BR")} demanda{n === 1 ? "" : "s"} para um quadro</DialogTitle>
          <DialogDescription>
            Cada demanda vira um cartão vinculado a ela. Ao mover o cartão de etapa, o quadro oferece atualizar o status da demanda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Quadro</Label>
            <Select value={quadroId} onValueChange={(v) => { setQuadroId(v); setColunaId(""); }}>
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

          {quadroId && (
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={colunaId} onValueChange={setColunaId}>
                <SelectTrigger><SelectValue placeholder="Escolha a etapa" /></SelectTrigger>
                <SelectContent>
                  {colunas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.cor }} />{c.nome}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <Button onClick={enviar} disabled={!quadroId || !colunaId || rodando}>
            {rodando ? "Enviando…" : `Enviar ${n.toLocaleString("pt-BR")}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
