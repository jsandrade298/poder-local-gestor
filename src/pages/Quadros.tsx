import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { CreateBoardDialog } from "@/components/kanban/CreateBoardDialog";
import { Avatar } from "@/components/quadros/CartaoProjetoDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useKanbanBoards } from "@/hooks/useKanbanBoards";
import { useMembrosDeTodosQuadros, usePessoasGabinete, colunaEhFinal } from "@/hooks/useQuadros";
import { fetchAll } from "@/lib/fetchAll";
import { cn } from "@/lib/utils";

/**
 * Quadros: o trabalho do gabinete em um lugar.
 *  - Equipe (Produção Legislativa) e Meu quadro: abrem o quadro de sempre.
 *  - Projetos: quadros com membros (todos veem, membros editam).
 */

interface Resumo { total: number; concluidos: number; atrasados: number }
type Filtro = "todos" | "meus" | "projetos";

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

function CartaoQuadro({ para, icone, cor, tipo, nome, descricao, resumo, membros, rotulo }: {
  para: string; icone: string; cor: string; tipo: string; nome: string; descricao?: string | null;
  resumo: Resumo; membros?: { id: string; nome?: string }[]; rotulo?: React.ReactNode;
}) {
  return (
    <Link to={para} className="group rounded-xl border bg-card p-4 shadow-sm hover:border-primary transition-colors flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-center gap-3 min-w-0">
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
  );
}

export default function Quadros() {
  const { user } = useAuth();
  const uid = user?.id || "";
  const { boards, isLoading, isError } = useKanbanBoards() as any;
  const membrosPorQuadro = useMembrosDeTodosQuadros();
  const { porId } = usePessoasGabinete();
  const [filtro, setFiltro] = useState<Filtro>(() => {
    try { return (localStorage.getItem("quadros-filtro") as Filtro) || "todos"; } catch { return "todos"; }
  });
  const escolher = (f: Filtro) => { setFiltro(f); try { localStorage.setItem("quadros-filtro", f); } catch { /* sem storage */ } };
  const [criando, setCriando] = useState(false);

  // Resumo dos projetos (cartões por coluna) e dos quadros de equipe/pessoal
  const resumos = useQuery({
    queryKey: ["quadros-resumos", uid],
    enabled: !!uid,
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const [colunas, cards, equipeDem, equipeTar, meuDem, meuTar] = await Promise.all([
        supabase.from("kanban_board_colunas").select("id, nome, slug"),
        fetchAll((f, t) => supabase.from("kanban_board_cards").select("id, board_id, coluna_id, data_prazo").is("arquivado_em", null).order("id").range(f, t) as any),
        fetchAll((f, t) => supabase.from("demanda_kanbans").select("id, kanban_position, demandas!inner(data_prazo)").eq("kanban_type", "producao-legislativa").order("id").range(f, t) as any),
        supabase.from("tarefas").select("kanban_position, data_prazo").eq("kanban_type", "producao-legislativa"),
        supabase.from("demanda_kanbans").select("kanban_position, demandas!inner(data_prazo)").eq("kanban_type", uid),
        supabase.from("tarefas").select("kanban_position, data_prazo").eq("kanban_type", uid),
      ]);
      if (colunas.error) throw colunas.error;
      const final = new Set((colunas.data || []).filter(colunaEhFinal).map((c: any) => c.id));
      const porQuadro = new Map<string, Resumo>();
      (cards as any[]).forEach((c) => {
        const r = porQuadro.get(c.board_id) || { total: 0, concluidos: 0, atrasados: 0 };
        r.total++;
        if (final.has(c.coluna_id)) r.concluidos++;
        else if (c.data_prazo && c.data_prazo < hoje) r.atrasados++;
        porQuadro.set(c.board_id, r);
      });
      const doKanban = (itens: any[]): Resumo => itens.reduce((r, i) => {
        const prazo = i.data_prazo ?? i.demandas?.data_prazo;
        r.total++;
        if (i.kanban_position === "feito") r.concluidos++;
        else if (prazo && prazo < hoje) r.atrasados++;
        return r;
      }, { total: 0, concluidos: 0, atrasados: 0 });
      return {
        porQuadro,
        equipe: doKanban([...(equipeDem as any[]), ...((equipeTar as any).data || [])]),
        meu: doKanban([...(((meuDem as any).data) || []), ...(((meuTar as any).data) || [])]),
      };
    },
    staleTime: 60_000,
  });

  const projetos = useMemo(() => (boards || []).map((b: any) => {
    const ids = membrosPorQuadro.get(b.id) || [];
    return { ...b, membros: ids.map((id) => ({ id, nome: porId.get(id)?.nome })), souMembro: ids.includes(uid) };
  }), [boards, membrosPorQuadro, porId, uid]);

  const mostrarFixos = filtro !== "projetos";
  const listaProjetos = projetos.filter((p: any) => filtro !== "meus" || p.souMembro);
  const vazio = { total: 0, concluidos: 0, atrasados: 0 };

  if (isError) return <ErrorState what="os quadros" onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5 md:container md:mx-auto md:px-4 max-w-[1400px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Quadros</h1>
          <p className="text-sm text-muted-foreground">O trabalho do gabinete em um lugar: o quadro da equipe, o seu e os projetos.</p>
        </div>
        <Button className="gap-1.5 self-start" onClick={() => setCriando(true)}><Plus className="h-4 w-4" /> Novo projeto</Button>
      </div>

      <div className="flex rounded-lg border bg-muted/30 p-0.5 w-fit" role="radiogroup" aria-label="Mostrar">
        {([["todos", "Todos"], ["meus", "Meus quadros"], ["projetos", "Projetos"]] as const).map(([v, r]) => (
          <button key={v} type="button" role="radio" aria-checked={filtro === v} onClick={() => escolher(v)}
            className={cn("px-3 py-1.5 text-sm rounded-md", filtro === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>{r}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mostrarFixos && (
            <CartaoQuadro para="/kanban?quadro=producao-legislativa" icone="🏛️" cor="#2563eb" tipo="Equipe" nome="Produção Legislativa"
              descricao="Quadro do gabinete: demandas e tarefas da equipe." resumo={resumos.data?.equipe || vazio}
              rotulo={<span className="rounded-full bg-muted text-[11px] px-2 py-0.5 flex items-center gap-1"><Users className="h-3 w-3" /> Equipe</span>} />
          )}
          {mostrarFixos && (
            <CartaoQuadro para={`/kanban?quadro=${uid}`} icone="🗂️" cor="#0f766e" tipo="Pessoal" nome="Meu quadro"
              descricao="Suas tarefas e demandas." resumo={resumos.data?.meu || vazio}
              membros={[{ id: uid, nome: porId.get(uid)?.nome }]} />
          )}
          {listaProjetos.map((p: any) => (
            <CartaoQuadro key={p.id} para={`/quadros/${p.id}`} icone={p.icone} cor={p.cor} tipo="Projeto" nome={p.nome}
              descricao={p.descricao} resumo={resumos.data?.porQuadro.get(p.id) || vazio} membros={p.membros}
              rotulo={p.souMembro
                ? <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Você participa</span>
                : <span className="rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1"><Lock className="h-3 w-3" /> Só leitura</span>} />
          ))}
          <button type="button" onClick={() => setCriando(true)}
            className="rounded-xl border-2 border-dashed min-h-[160px] grid place-items-center text-muted-foreground hover:text-primary hover:border-primary font-medium">
            + Novo projeto
          </button>
        </div>
      )}

      {!isLoading && filtro === "meus" && listaProjetos.length === 0 && (
        <p className="text-sm text-muted-foreground">Você ainda não participa de nenhum projeto. Abra um projeto e use "Pedir para participar", ou crie um novo.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Projetos: todo o gabinete pode ver; só os membros editam. Qualquer pessoa pode criar um projeto e já entra como membro.
      </p>

      <CreateBoardDialog open={criando} onOpenChange={setCriando} />
    </div>
  );
}
