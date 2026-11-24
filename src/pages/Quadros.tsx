import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { CreateBoardDialog } from "@/components/kanban/CreateBoardDialog";
import { Avatar } from "@/components/quadros/CartaoProjetoDrawer";
import { AcoesProjeto } from "@/components/quadros/AcoesProjeto";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useKanbanBoards } from "@/hooks/useKanbanBoards";
import { useMembrosDeTodosQuadros, usePessoasGabinete, colunaEhFinal, garantirQuadroPessoal } from "@/hooks/useQuadros";
import { fetchAll } from "@/lib/fetchAll";
import { cn } from "@/lib/utils";

/**
 * Quadros: o trabalho do gabinete em um lugar.
 *  - Equipe (Produção Legislativa): todo o gabinete edita.
 *  - Meu quadro (pessoal): o gabinete vê, só o dono edita.
 *  - Projetos: quadros com membros (todos veem, membros editam).
 * Tudo no mesmo modelo e na mesma tela (/quadros/:id).
 */

interface Resumo { total: number; concluidos: number; atrasados: number }
type Filtro = "todos" | "meus";

function Progresso({ r }: { r: Resumo }) {
  if (!r.total) return <p className="text-xs text-muted-foreground">Ainda sem cartões</p>;
  const pct = Math.round((r.concluidos / r.total) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>{r.concluidos} de {r.total} concluídos</span><span>{pct}%</span></div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function CartaoQuadro({ para, icone, cor, tipo, nome, descricao, resumo, membros, rotulo, acoes }: {
  para: string; icone: string; cor: string; tipo: string; nome: string; descricao?: string | null;
  resumo: Resumo; membros?: { id: string; nome?: string }[]; rotulo?: React.ReactNode;
  /** Menu ⋯ (fica fora do link, para o clique não abrir o quadro) */
  acoes?: React.ReactNode;
}) {
  return (
    <div className="relative flex">
    {acoes && <div className="absolute right-2 top-2 z-10">{acoes}</div>}
    <Link to={para} className="group flex-1 rounded-xl border bg-card p-4 shadow-sm hover:border-primary transition-colors flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className={cn("flex items-center gap-3 min-w-0", acoes && "pr-8")}>
        <span className="h-10 w-10 rounded-lg grid place-items-center text-xl shrink-0" style={{ background: `${cor}22` }}>{icone}</span>
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground font-semibold">{tipo}</div>
          <h3 className="font-semibold truncate">{nome}</h3>
        </div>
      </div>
      {descricao && <p className="text-xs text-muted-foreground line-clamp-2">{descricao}</p>}
      <Progresso r={resumo} />
      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className="flex -space-x-1.5">{(membros || []).slice(0, 5).map((m) => <Avatar key={m.id} id={m.id} nome={m.nome} size={24} />)}
          {(membros || []).length > 5 && <span className="h-6 min-w-6 px-1 rounded-full bg-muted text-[10px] grid place-items-center ring-2 ring-background">+{(membros || []).length - 5}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {resumo.atrasados > 0 && <span className="rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold px-2 py-0.5">{resumo.atrasados} atrasado{resumo.atrasados > 1 ? "s" : ""}</span>}
          {rotulo}
        </div>
      </div>
    </Link>
    </div>
  );
}

export default function Quadros() {
  const { user, profile } = useAuth();
  const uid = user?.id || "";
  const navigate = useNavigate();
  const { boards, isLoading, isError } = useKanbanBoards() as any;
  const membrosPorQuadro = useMembrosDeTodosQuadros();
  const { porId } = usePessoasGabinete();
  const [filtro, setFiltro] = useState<Filtro>(() => {
    try { const f = localStorage.getItem("quadros-filtro"); return f === "meus" ? "meus" : "todos"; } catch { return "todos"; }
  });
  const escolher = (f: Filtro) => { setFiltro(f); try { localStorage.setItem("quadros-filtro", f); } catch { /* sem storage */ } };
  const [criando, setCriando] = useState(false);
  const [abrindoMeu, setAbrindoMeu] = useState(false);

  // Resumo de todos os quadros (cartões por etapa), sem o limite de mil
  const resumos = useQuery({
    queryKey: ["quadros-resumos", uid],
    enabled: !!uid,
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const [colunas, cards] = await Promise.all([
        fetchAll((f, t) => supabase.from("kanban_board_colunas").select("id, nome, slug").order("id").range(f, t) as any),
        fetchAll((f, t) => supabase.from("kanban_board_cards").select("id, board_id, coluna_id, data_prazo").is("arquivado_em", null).order("id").range(f, t) as any),
      ]);
      const final = new Set((colunas as any[]).filter(colunaEhFinal).map((c) => c.id));
      const porQuadro = new Map<string, Resumo>();
      (cards as any[]).forEach((c) => {
        const r = porQuadro.get(c.board_id) || { total: 0, concluidos: 0, atrasados: 0 };
        r.total++;
        if (final.has(c.coluna_id)) r.concluidos++;
        else if (c.data_prazo && c.data_prazo < hoje) r.atrasados++;
        porQuadro.set(c.board_id, r);
      });
      return { porQuadro };
    },
    staleTime: 60_000,
  });

  const todos = useMemo(() => (boards || []).map((b: any) => {
    const ids = membrosPorQuadro.get(b.id) || [];
    return { ...b, membros: ids.map((id) => ({ id, nome: porId.get(id)?.nome })), souMembro: ids.includes(uid) };
  }), [boards, membrosPorQuadro, porId, uid]);

  const equipe = todos.filter((b: any) => b.tipo === "equipe");
  const meu = todos.find((b: any) => b.tipo === "pessoal" && b.dono_id === uid);
  const projetos = todos.filter((b: any) => (b.tipo ?? "projeto") === "projeto" && (filtro !== "meus" || b.souMembro));
  const pessoaisDosOutros = todos.filter((b: any) => b.tipo === "pessoal" && b.dono_id !== uid)
    .sort((a: any, b: any) => (porId.get(a.dono_id)?.nome || a.nome).localeCompare(porId.get(b.dono_id)?.nome || b.nome, "pt-BR"));
  const vazio: Resumo = { total: 0, concluidos: 0, atrasados: 0 };
  const resumo = (id: string): Resumo => resumos.data?.porQuadro.get(id) || vazio;

  const abrirMeuQuadro = async () => {
    if (meu) return navigate(`/quadros/${meu.id}`);
    setAbrindoMeu(true);
    try { navigate(`/quadros/${await garantirQuadroPessoal(uid, profile?.nome)}`); }
    catch { setAbrindoMeu(false); }
  };

  if (isError) return <ErrorState what="os quadros" onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-6 md:container md:mx-auto md:px-4 max-w-[1400px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Quadros</h1>
          <p className="text-sm text-muted-foreground">O trabalho do gabinete em um lugar: o seu quadro e os projetos.</p>
        </div>
        <Button className="gap-1.5 self-start" onClick={() => setCriando(true)}><Plus className="h-4 w-4" /> Novo projeto</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : (
        <>
          {/* Dia a dia: equipe + meu quadro */}
          <section className="space-y-2" aria-labelledby="sec-dia">
            <h2 id="sec-dia" className="text-sm font-semibold text-muted-foreground">Seu quadro</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {equipe.map((b: any) => (
                <CartaoQuadro key={b.id} para={`/quadros/${b.id}`} icone={b.icone} cor={b.cor} tipo="Equipe" nome={b.nome}
                  descricao="Demandas e tarefas da equipe. Todo o gabinete edita." resumo={resumo(b.id)}
                  rotulo={<span className="rounded-full bg-muted text-[11px] px-2 py-0.5 flex items-center gap-1"><Users className="h-3 w-3" /> Todo o gabinete</span>} />
              ))}
              {meu ? (
                <CartaoQuadro para={`/quadros/${meu.id}`} icone={meu.icone} cor={meu.cor} tipo="Pessoal" nome="Meu quadro"
                  descricao="Suas tarefas. O gabinete acompanha; só você edita." resumo={resumo(meu.id)}
                  membros={[{ id: uid, nome: porId.get(uid)?.nome }]}
                  acoes={<AcoesProjeto board={meu} podeEditar />} />
              ) : (
                <button type="button" onClick={abrirMeuQuadro} disabled={abrindoMeu}
                  className="rounded-xl border bg-card p-4 shadow-sm hover:border-primary transition-colors text-left flex flex-col gap-2">
                  <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground font-semibold">Pessoal</span>
                  <span className="font-semibold">Meu quadro</span>
                  <span className="text-xs text-muted-foreground">{abrindoMeu ? "Criando…" : "Um lugar para as suas tarefas. Toque para começar."}</span>
                </button>
              )}
            </div>
          </section>

          {/* Projetos */}
          <section className="space-y-2" aria-labelledby="sec-proj">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="sec-proj" className="text-sm font-semibold text-muted-foreground">Projetos</h2>
              <div className="flex rounded-lg border bg-muted/30 p-0.5" role="radiogroup" aria-label="Quais projetos">
                {([["todos", "Todos"], ["meus", "Que participo"]] as const).map(([v, r]) => (
                  <button key={v} type="button" role="radio" aria-checked={filtro === v} onClick={() => escolher(v)}
                    className={cn("px-3 py-1 text-xs rounded-md", filtro === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>{r}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projetos.map((p: any) => (
                <CartaoQuadro key={p.id} para={`/quadros/${p.id}`} icone={p.icone} cor={p.cor} tipo="Projeto" nome={p.nome}
                  descricao={p.descricao} resumo={resumo(p.id)} membros={p.membros}
                  acoes={<AcoesProjeto board={p} podeEditar={p.souMembro} />}
                  rotulo={p.souMembro
                    ? <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Você participa</span>
                    : <span className="rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1"><Lock className="h-3 w-3" /> Só leitura</span>} />
              ))}
              <button type="button" onClick={() => setCriando(true)}
                className="rounded-xl border-2 border-dashed min-h-[140px] grid place-items-center text-muted-foreground hover:text-primary hover:border-primary font-medium">
                + Novo projeto
              </button>
            </div>
            {filtro === "meus" && projetos.length === 0 && (
              <p className="text-sm text-muted-foreground">Você ainda não participa de nenhum projeto. Abra um projeto e use "Pedir para participar", ou crie um novo.</p>
            )}
          </section>

          {/* Quadros pessoais da equipe (para acompanhar) */}
          {pessoaisDosOutros.length > 0 && (
            <details className="group rounded-xl border bg-card">
              <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Quadros pessoais da equipe <span className="text-muted-foreground font-normal">({pessoaisDosOutros.length})</span></span>
                <span className="text-xs text-muted-foreground group-open:hidden">Mostrar</span>
                <span className="text-xs text-muted-foreground hidden group-open:inline">Esconder</span>
              </summary>
              <div className="divide-y border-t">
                {pessoaisDosOutros.map((b: any) => {
                  const r = resumo(b.id);
                  const abertos = r.total - r.concluidos;
                  return (
                    <Link key={b.id} to={`/quadros/${b.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                      <Avatar id={b.dono_id} nome={porId.get(b.dono_id)?.nome} size={26} />
                      <span className="text-sm flex-1 min-w-0 truncate">{porId.get(b.dono_id)?.nome || b.nome}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{abertos} em aberto</span>
                      {r.atrasados > 0 && <span className="rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold px-2 py-0.5 shrink-0">{r.atrasados} atrasado{r.atrasados > 1 ? "s" : ""}</span>}
                    </Link>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground px-4 py-2 border-t">Para acompanhar. Só o dono edita o próprio quadro; quem estiver incluído num cartão edita aquele cartão.</p>
            </details>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Projetos: todo o gabinete pode ver; só os membros editam. Qualquer pessoa pode criar um projeto e já entra como membro.
      </p>

      <CreateBoardDialog open={criando} onOpenChange={setCriando} />
    </div>
  );
}
