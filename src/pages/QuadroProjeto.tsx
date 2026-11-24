import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  ArrowLeft, Users, Plus, Lock, AlertTriangle, CheckSquare, MessageSquare, Link2,
  MoreHorizontal, Settings2, UserPlus, Eye, Pencil, Archive, ArchiveRestore, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardColumnConfig } from "@/components/kanban/BoardColumnConfig";
import { CartaoProjetoDrawer, Avatar } from "@/components/quadros/CartaoProjetoDrawer";
import { AcoesProjeto } from "@/components/quadros/AcoesProjeto";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmarStatusDemandaDialog, MovimentoDemandaKanban, sugerirStatusParaColuna } from "@/components/kanban/ConfirmarStatusDemandaDialog";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useKanbanBoards, useKanbanBoardColunas, useKanbanBoardCards, KanbanBoardCard } from "@/hooks/useKanbanBoards";
import { useBoardCardCounts } from "@/hooks/useBoardCardExtras";
import {
  useMembrosQuadro, useExtrasDoQuadro, usePessoasGabinete, useBuscaDemandas, avisar, colunaEhFinal, useCartoesArquivados,
  etapaComoKanban, nomeDoQuadro,
} from "@/hooks/useQuadros";
import { normalizarBusca } from "@/lib/busca";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const DIAS_FINAL_VISIVEL = 30;
const hoje = () => new Date().toISOString().slice(0, 10);
const dias = (iso: string) => Math.round((new Date(iso + "T12:00:00").getTime() - new Date(hoje() + "T12:00:00").getTime()) / 86400000);

export default function QuadroProjeto() {
  const { id: boardId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, profile } = useAuth();
  const uid = user?.id || "";

  const { boards, isLoading: carregandoQuadros } = useKanbanBoards();
  const board = boards.find((b) => b.id === boardId);
  const { colunas, isLoading: carregandoColunas } = useKanbanBoardColunas(boardId);
  const { cards, isLoading: carregandoCards, createCard, moveCard, archiveCard, deleteCard } = useKanbanBoardCards(boardId);
  const arquivados = useCartoesArquivados(boardId);
  // Celular: uma etapa por vez (abas no topo), sem rolar para o lado
  const celular = useIsMobile();
  const [etapaCel, setEtapaCel] = useState<string | null>(null);
  const [arquivadosAberto, setArquivadosAberto] = useState(false);
  const [cartaoExcluir, setCartaoExcluir] = useState<KanbanBoardCard | null>(null);
  const contagens = useBoardCardCounts(boardId) as any;
  const extras = useExtrasDoQuadro(boardId);
  const { membros, souMembro, incluir, remover } = useMembrosQuadro(boardId);
  const { pessoas, porId } = usePessoasGabinete();

  const [agrupar, setAgrupar] = useState<"etapa" | "pessoa">("etapa");
  const [busca, setBusca] = useState("");
  const [pessoa, setPessoa] = useState("todas");
  const [soAtrasados, setSoAtrasados] = useState(false);
  const [verAntigos, setVerAntigos] = useState(false);
  const [novoNaColuna, setNovoNaColuna] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [membrosAberto, setMembrosAberto] = useState(false);
  const [colunasAberto, setColunasAberto] = useState(false);
  const [demandaAberto, setDemandaAberto] = useState(false);
  const [buscaDemanda, setBuscaDemanda] = useState("");
  const resultadosDemanda = useBuscaDemandas(buscaDemanda);
  const [movimentos, setMovimentos] = useState<MovimentoDemandaKanban[]>([]);
  const { statusList } = useDemandaStatus();

  // Quem edita o quadro: pessoal = só o dono; projeto = membros.
  // (O banco garante o mesmo.) Responsável e colaboradores editam o próprio cartão.
  const tipo = board?.tipo ?? "projeto";
  const editavel = tipo === "pessoal" ? board?.dono_id === uid : tipo === "equipe" || souMembro;
  const podeEditar = (c: KanbanBoardCard) =>
    editavel || c.responsavel_id === uid || (extras.colab.get(c.id) || []).includes(uid);
  const dono = board?.dono_id ? porId.get(board.dono_id) : undefined;
  const nome = board ? nomeDoQuadro(board, uid) : "";

  const cartaoAberto = params.get("cartao");
  const card = cards.find((c) => c.id === cartaoAberto) || null;
  const abrir = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set("cartao", id); else p.delete("cartao");
    setParams(p, { replace: true });
  };

  const finais = useMemo(() => new Set(colunas.filter(colunaEhFinal).map((c) => c.id)), [colunas]);
  const atrasado = (c: KanbanBoardCard) => !!c.data_prazo && !finais.has(c.coluna_id) && c.data_prazo < hoje();
  const pessoasDoCartao = (c: KanbanBoardCard) => [c.responsavel_id, ...(extras.colab.get(c.id) || [])].filter(Boolean) as string[];

  const filtrados = useMemo(() => {
    const palavras = normalizarBusca(busca).split(/\s+/).filter(Boolean);
    return cards.filter((c) => {
      if (soAtrasados && !atrasado(c)) return false;
      if (pessoa !== "todas" && !pessoasDoCartao(c).includes(pessoa)) return false;
      if (palavras.length) {
        const alvo = normalizarBusca(`${c.titulo} ${c.descricao || ""} ${(extras.dems.get(c.id) || []).map((d) => d.protocolo).join(" ")}`);
        if (!palavras.every((p) => alvo.includes(p))) return false;
      }
      return true;
    });
  }, [cards, busca, pessoa, soAtrasados, extras, finais]); // eslint-disable-line react-hooks/exhaustive-deps

  const antigoNaFinal = (c: KanbanBoardCard) =>
    finais.has(c.coluna_id) && dias((c.updated_at || c.created_at).slice(0, 10)) < -DIAS_FINAL_VISIVEL;

  const grupos = useMemo(() => {
    if (agrupar === "etapa") {
      return colunas.map((col) => {
        const todos = filtrados.filter((c) => c.coluna_id === col.id).sort((a, b) => a.ordem - b.ordem);
        const visiveis = finais.has(col.id) && !verAntigos ? todos.filter((c) => !antigoNaFinal(c)) : todos;
        return { id: col.id, nome: col.nome, cor: col.cor, total: todos.length, cards: visiveis, ocultos: todos.length - visiveis.length, final: finais.has(col.id) };
      });
    }
    // Agrupar por pessoa: o que está em aberto com cada membro (responsável ou colaborador)
    const abertos = filtrados.filter((c) => !finais.has(c.coluna_id));
    const ids = [...new Set([...membros.map((m) => m.usuario_id), ...abertos.flatMap(pessoasDoCartao)])];
    const lista = ids.map((id) => {
      const doId = abertos.filter((c) => pessoasDoCartao(c).includes(id));
      return { id: "p_" + id, pessoaId: id, nome: porId.get(id)?.nome || "Pessoa", total: doId.length, cards: doId, ocultos: 0, final: false };
    }).sort((a, b) => b.total - a.total);
    const semNinguem = abertos.filter((c) => pessoasDoCartao(c).length === 0);
    if (semNinguem.length) lista.push({ id: "p_ninguem", pessoaId: "", nome: "Sem responsável", total: semNinguem.length, cards: semNinguem, ocultos: 0, final: false });
    return lista;
  }, [agrupar, colunas, filtrados, finais, verAntigos, membros, porId]); // eslint-disable-line react-hooks/exhaustive-deps
  const grupoCel = grupos.some((g: any) => g.id === etapaCel) ? etapaCel : grupos[0]?.id;

  const totalFinal = cards.filter((c) => finais.has(c.coluna_id)).length;
  const totalAtrasados = cards.filter(atrasado).length;

  /** Move o cartão e, se tiver demanda vinculada, pergunta se muda o status. */
  const mover = (c: KanbanBoardCard, colunaId: string, ordem: number) => {
    if (c.coluna_id === colunaId && c.ordem === ordem) return;
    const mudouDeEtapa = c.coluna_id !== colunaId;
    moveCard.mutate({ cardId: c.id, colunaId, ordem });
    if (!mudouDeEtapa) return;
    const col = colunas.find((x) => x.id === colunaId);
    if (!col) return;
    const destinoKanban = etapaComoKanban(col);
    const sugerido = sugerirStatusParaColuna(destinoKanban, statusList);
    const fila = (extras.dems.get(c.id) || [])
      .filter((d) => d.status && sugerido && d.status !== sugerido)
      .map((d) => ({ demanda: d, colunaDestino: destinoKanban, colunaDestinoTitulo: col.nome }));
    if (fila.length) setMovimentos((m) => [...m, ...fila]);
  };

  const onDragEnd = (r: DropResult) => {
    if (!r.destination || agrupar !== "etapa") return;
    const c = cards.find((x) => x.id === r.draggableId);
    if (!c || !podeEditar(c)) return;
    mover(c, r.destination.droppableId, r.destination.index);
  };

  const criarDeDemanda = (d: { id: string; titulo: string; responsavel_id?: string | null }) => {
    const primeira = colunas[0];
    if (!primeira) return;
    createCard.mutate(
      { coluna_id: primeira.id, titulo: d.titulo, responsavel_id: d.responsavel_id || undefined, demanda_id: d.id, cor: "#0f766e" },
      { onSuccess: () => { setDemandaAberto(false); setBuscaDemanda(""); } },
    );
  };

  const criar = (colunaId: string) => {
    const t = novoTitulo.trim();
    if (!t) { setNovoNaColuna(null); return; }
    createCard.mutate({ coluna_id: colunaId, titulo: t, responsavel_id: uid }, { onSuccess: () => { setNovoTitulo(""); } });
  };

  const pedirParaParticipar = () => {
    avisar({
      destinatarios: membros.map((m) => m.usuario_id), remetente: uid, tipo: "mencao",
      titulo: "Pedido para participar de projeto",
      mensagem: `${profile?.nome || "Alguém"} pediu para participar de "${board?.nome}". Inclua em Membros, se fizer sentido.`,
      url: `/quadros/${boardId}?membros=1`,
    }).then(() => toastSimples("Pedido enviado aos membros do projeto"));
  };
  const [aviso, setAviso] = useState<string | null>(null);
  const toastSimples = (m: string) => { setAviso(m); setTimeout(() => setAviso(null), 2500); };

  useEffect(() => { if (params.get("membros") === "1") setMembrosAberto(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (carregandoQuadros || carregandoColunas || carregandoCards) {
    return <div className="space-y-4"><Skeleton className="h-12 w-72" /><div className="flex gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-80 w-72" />)}</div></div>;
  }
  if (!board) {
    return <ErrorState what="este projeto (ele pode ter sido arquivado)" onRetry={() => navigate("/quadros")} />;
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/quadros")} aria-label="Voltar aos quadros"><ArrowLeft className="h-4 w-4" /></Button>
          <span className="h-10 w-10 rounded-lg grid place-items-center text-xl shrink-0" style={{ background: `${board.cor}22` }}>{board.icone}</span>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              {tipo === "equipe" ? "Quadro da equipe" : tipo === "pessoal" ? (board.dono_id === uid ? "Quadro pessoal" : `Quadro pessoal de ${dono?.nome?.split(" ")[0] || "colega"}`) : "Projeto"}
            </div>
            <h1 className="text-lg md:text-xl font-bold truncate">{nome}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {tipo === "projeto" && (
            <>
              <button type="button" onClick={() => setMembrosAberto(true)} className="flex items-center -space-x-1.5 hover:opacity-80" aria-label="Ver membros">
                {membros.slice(0, 6).map((m) => <Avatar key={m.usuario_id} id={m.usuario_id} nome={m.pessoa?.nome} size={28} />)}
              </button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMembrosAberto(true)}><Users className="h-4 w-4" /><span className="hidden sm:inline">Membros</span> ({membros.length})</Button>
            </>
          )}
          {tipo === "pessoal" && board.dono_id !== uid && <Avatar id={board.dono_id} nome={dono?.nome} size={28} />}
          {editavel && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setColunasAberto(true)} aria-label="Etapas"><Settings2 className="h-4 w-4" /><span className="hidden sm:inline">Etapas</span></Button>}
          {editavel && colunas[0] && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDemandaAberto(true)} aria-label="Vincular demanda"><Link2 className="h-4 w-4" /><span className="hidden sm:inline">Demanda</span></Button>}
          {editavel && colunas[0] && <Button size="sm" className="gap-1.5" onClick={() => { setNovoNaColuna(colunas[0].id); setAgrupar("etapa"); }}><Plus className="h-4 w-4" /> Cartão</Button>}
          <AcoesProjeto board={board} podeEditar={editavel} onExcluido={() => navigate("/quadros", { replace: true })} onArquivado={() => navigate("/quadros")} className="border" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Todo o gabinete vê</span>
        <span className="flex items-center gap-1"><Pencil className="h-3.5 w-3.5" />
          {tipo === "equipe" ? "Todo o gabinete edita" : tipo === "pessoal" ? (board.dono_id === uid ? "Só você edita" : `Só ${dono?.nome?.split(" ")[0] || "o dono"} edita`) : "Só membros editam"}
        </span>
        <span>{cards.length} {cards.length === 1 ? "cartão" : "cartões"} · {totalFinal} {totalFinal === 1 ? "concluído" : "concluídos"}{totalAtrasados ? ` · ${totalAtrasados} ${totalAtrasados === 1 ? "atrasado" : "atrasados"}` : ""}</span>
        {board.descricao && tipo === "projeto" && <span className="truncate max-w-full">· {board.descricao}</span>}
      </div>

      {!editavel && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-violet-50 dark:bg-violet-950/30 px-4 py-3">
          <Lock className="h-4 w-4 text-violet-700 dark:text-violet-300" />
          {tipo === "pessoal" ? (
            <span className="text-sm flex-1 min-w-[220px]">Quadro pessoal de {dono?.nome || "um colega"}: você acompanha, mas só o dono edita. Nos cartões em que você está incluído, você também edita.</span>
          ) : (
            <>
              <span className="text-sm flex-1 min-w-[220px]">Você pode acompanhar tudo neste projeto. Nos cartões em que você está incluído, você edita. Para o resto, peça para participar.</span>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={pedirParaParticipar}><UserPlus className="h-4 w-4" /> Pedir para participar</Button>
            </>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tipo === "projeto" ? "Buscar no projeto…" : "Buscar no quadro…"} className="h-9 flex-1 min-w-[160px] max-w-xs" aria-label="Buscar cartões" />
        {tipo === "pessoal" ? (
          // Ver o quadro pessoal de outra pessoa (como no Kanban antigo): só acompanhar
          <Select value={board.dono_id || ""} onValueChange={(dono) => {
            const alvo = boards.find((b) => b.tipo === "pessoal" && b.dono_id === dono);
            if (alvo) navigate(`/quadros/${alvo.id}`);
          }}>
            <SelectTrigger className="h-9 w-auto min-w-[170px] max-w-[260px] gap-1" aria-label="Ver o quadro pessoal de outra pessoa">
              <span className="text-muted-foreground shrink-0">Quadro de:</span><span className="truncate"><SelectValue /></span>
            </SelectTrigger>
            <SelectContent>
              {boards.filter((b) => b.tipo === "pessoal" && b.dono_id)
                .map((b) => ({ b, nome: b.dono_id === uid ? "Você" : (porId.get(b.dono_id!)?.nome || b.nome) }))
                .sort((x, y) => (x.b.dono_id === uid ? -1 : y.b.dono_id === uid ? 1 : x.nome.localeCompare(y.nome, "pt-BR")))
                .map(({ b, nome }) => <SelectItem key={b.id} value={b.dono_id!}>{nome}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Select value={pessoa} onValueChange={setPessoa}>
            <SelectTrigger className="h-9 w-[190px]" aria-label="Filtrar por pessoa"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Filtrar: todas as pessoas</SelectItem>
              {pessoas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button variant={soAtrasados ? "default" : "outline"} size="sm" className="h-9 gap-1.5" onClick={() => setSoAtrasados(!soAtrasados)} aria-pressed={soAtrasados}>
          <AlertTriangle className="h-3.5 w-3.5" /> Só atrasados
        </Button>
        <span className="flex-1" />
        {(arquivados.data?.length ?? 0) > 0 && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={() => setArquivadosAberto(true)}>
            <Archive className="h-3.5 w-3.5" /> Arquivados ({arquivados.data!.length})
          </Button>
        )}
        {tipo !== "pessoal" && (
          <>
            <span className="text-xs text-muted-foreground">Agrupar por</span>
            <div className="flex rounded-lg border bg-muted/30 p-0.5" role="radiogroup" aria-label="Agrupar por">
              {([["etapa", "Etapa"], ["pessoa", "Pessoa"]] as const).map(([v, r]) => (
                <button key={v} type="button" role="radio" aria-checked={agrupar === v} onClick={() => setAgrupar(v)}
                  className={cn("px-3 py-1 text-xs rounded-md", agrupar === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>{r}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Celular: escolher a etapa (ou a pessoa) */}
      {celular && grupos.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={agrupar === "etapa" ? "Etapas" : "Pessoas"}>
          {grupos.map((g: any) => (
            <button key={g.id} type="button" role="tab" aria-selected={g.id === grupoCel}
              onClick={() => setEtapaCel(g.id)}
              className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                g.id === grupoCel ? "border-primary bg-primary text-primary-foreground font-semibold" : "bg-card text-muted-foreground")}>
              {g.cor && <span className="h-2 w-2 rounded-full" style={{ background: g.cor }} aria-hidden />}
              <span className="max-w-[9rem] truncate">{g.nome}</span>
              <span className={cn("tabular-nums", g.id === grupoCel ? "opacity-80" : "")}>{g.total}</span>
            </button>
          ))}
        </div>
      )}

      {/* Colunas */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className={cn("flex gap-3 pb-3 items-start", celular ? "flex-col" : "overflow-x-auto -mx-1 px-1")}>
          {grupos.filter((g: any) => !celular || g.id === grupoCel).map((g: any) => (
            <Droppable key={g.id} droppableId={g.id} isDropDisabled={agrupar !== "etapa"}>
              {(prov, snap) => (
                <section
                  ref={prov.innerRef} {...prov.droppableProps}
                  className={cn(celular ? "w-full" : "flex-[0_0_290px]", "rounded-xl bg-muted/40 p-2.5 space-y-2 min-h-[120px]", snap.isDraggingOver && "ring-2 ring-primary/40")}
                  aria-label={g.nome}
                >
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold flex items-center gap-2 min-w-0">
                      {g.pessoaId !== undefined
                        ? (g.pessoaId ? <Avatar id={g.pessoaId} nome={g.nome} size={20} /> : <span className="h-2 w-2 rounded-full bg-muted-foreground" />)
                        : <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: g.cor }} />}
                      <span className="truncate">{g.nome}</span>
                    </h2>
                    <span className="text-[11px] rounded-full border bg-background px-2 text-muted-foreground">{g.total}</span>
                  </div>

                  {g.cards.map((c: KanbanBoardCard, i: number) => (
                    <Draggable key={c.id} draggableId={c.id} index={i} isDragDisabled={!podeEditar(c) || agrupar !== "etapa"}>
                      {(dp, ds) => (
                        <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps}
                          className={cn("group relative rounded-lg border bg-card p-2.5 shadow-sm hover:border-primary/60 transition-colors cursor-pointer", ds.isDragging && "shadow-lg rotate-1")}
                          onClick={() => abrir(c.id)}
                          role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && abrir(c.id)}
                          aria-label={c.titulo}
                        >
                          {c.cor && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r" style={{ background: c.cor }} aria-hidden />}
                          <div className="flex items-start gap-1 pl-1.5">
                            <h3 className="text-[13px] font-medium leading-snug flex-1 min-w-0 break-words">{c.titulo}</h3>
                            {podeEditar(c) && agrupar === "etapa" && (
                              <div onClick={(e) => e.stopPropagation()} className="md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 -mr-1 -mt-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Ações do cartão"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Mover para</DropdownMenuLabel>
                                    {colunas.filter((col) => col.id !== c.coluna_id).map((col) => (
                                      <DropdownMenuItem key={col.id} onClick={() => mover(c, col.id, 0)}>
                                        <span className="h-2 w-2 rounded-full mr-2" style={{ background: col.cor }} />{col.nome}
                                      </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => archiveCard.mutate(c.id)}>
                                      <Archive className="h-4 w-4 mr-2" /> Arquivar
                                    </DropdownMenuItem>
                                    {editavel && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setCartaoExcluir(c)}>
                                      <Trash2 className="h-4 w-4 mr-2" /> Excluir…
                                    </DropdownMenuItem>}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                          {(extras.dems.get(c.id) || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5 pl-1.5">
                              {(extras.dems.get(c.id) || []).slice(0, 2).map((d) => (
                                <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10.5px] font-medium px-2 py-0.5"><Link2 className="h-3 w-3" />#{d.protocolo}</span>
                              ))}
                              {(extras.dems.get(c.id) || []).length > 2 && <span className="rounded-full bg-muted text-[10.5px] px-2 py-0.5">+{(extras.dems.get(c.id) || []).length - 2}</span>}
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2 mt-2 pl-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              {c.data_prazo && (atrasado(c)
                                ? <span className="rounded-full bg-destructive/10 text-destructive font-semibold px-2 py-0.5">Atrasado {-dias(c.data_prazo)}d</span>
                                : !finais.has(c.coluna_id) && dias(c.data_prazo) <= 2
                                  ? <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold px-2 py-0.5">{dias(c.data_prazo) === 0 ? "Vence hoje" : `Vence em ${dias(c.data_prazo)}d`}</span>
                                  : <span>📅 {new Date(c.data_prazo + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>)}
                              {contagens?.checklist?.[c.id]?.total > 0 && <span className="flex items-center gap-0.5"><CheckSquare className="h-3 w-3" />{contagens.checklist[c.id].done}/{contagens.checklist[c.id].total}</span>}
                              {contagens?.comentarios?.[c.id] > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{contagens.comentarios[c.id]}</span>}
                            </div>
                            <div className="flex -space-x-1.5">{pessoasDoCartao(c).slice(0, 4).map((pid) => <Avatar key={pid} id={pid} nome={porId.get(pid)?.nome} size={22} />)}</div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {prov.placeholder}

                  {g.final && g.ocultos > 0 && (
                    <button type="button" onClick={() => setVerAntigos(true)} className="w-full rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50">
                      Mostrar {g.ocultos} concluídos há mais de {DIAS_FINAL_VISIVEL} dias
                    </button>
                  )}
                  {g.final && verAntigos && cards.some((c) => c.coluna_id === g.id && antigoNaFinal(c)) && (
                    <button type="button" onClick={() => setVerAntigos(false)} className="w-full rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:text-foreground">Recolher concluídos antigos</button>
                  )}
                  {g.cards.length === 0 && !g.ocultos && (
                    <p className="text-center text-xs text-muted-foreground py-6">{agrupar === "pessoa" ? "Nada em aberto" : "Nenhum cartão"}</p>
                  )}

                  {editavel && agrupar === "etapa" && !g.final && (
                    novoNaColuna === g.id ? (
                      <div className="space-y-1.5">
                        <Input autoFocus value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} placeholder="Título do cartão…" className="h-9"
                          onKeyDown={(e) => { if (e.key === "Enter") criar(g.id); if (e.key === "Escape") { setNovoNaColuna(null); setNovoTitulo(""); } }} />
                        <div className="flex gap-1.5"><Button size="sm" className="h-7" onClick={() => criar(g.id)}>Adicionar</Button><Button size="sm" variant="ghost" className="h-7" onClick={() => { setNovoNaColuna(null); setNovoTitulo(""); }}>Cancelar</Button></div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setNovoNaColuna(g.id)} className="w-full rounded-md border border-dashed py-1.5 text-xs text-muted-foreground hover:text-primary hover:border-primary">+ Adicionar</button>
                    )
                  )}
                </section>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      <p className="text-xs text-muted-foreground">
        {agrupar === "pessoa"
          ? "Agrupar por pessoa mostra o que está em aberto com cada pessoa (responsável ou colaborador). Para mover, volte para Etapa."
          : celular ? "Toque numa etapa acima para ver os cartões dela. Para mudar um cartão de etapa, use o menu ⋯ dele." : "Arraste os cartões entre as etapas. Atrasos aparecem sozinhos pelo prazo."}
      </p>

      {/* Membros */}
      <Dialog open={membrosAberto} onOpenChange={setMembrosAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Membros de {board.nome}</DialogTitle>
            <DialogDescription>Membros editam o projeto. O restante do gabinete pode ver, sem editar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {membros.map((m) => (
              <div key={m.usuario_id} className="flex items-center gap-2.5 rounded-md border px-3 py-2">
                <Avatar id={m.usuario_id} nome={m.pessoa?.nome} size={28} />
                <span className="text-sm flex-1">{m.pessoa?.nome}{m.usuario_id === uid && <span className="text-muted-foreground"> (você)</span>}</span>
                {(editavel || m.usuario_id === uid) && membros.length > 1 && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => remover.mutate(m.usuario_id)}>{m.usuario_id === uid ? "Sair" : "Remover"}</Button>
                )}
              </div>
            ))}
          </div>
          {editavel ? (
            <Select value="" onValueChange={(id) => incluir.mutate(id, {
              onSuccess: () => avisar({ destinatarios: [id], remetente: uid, tipo: "atribuicao", titulo: "Você entrou num projeto", mensagem: `${profile?.nome || "Alguém"} incluiu você em "${board.nome}".`, url: `/quadros/${board.id}` }),
            })}>
              <SelectTrigger><SelectValue placeholder="+ Incluir pessoa do gabinete" /></SelectTrigger>
              <SelectContent>{pessoas.filter((p) => !membros.some((m) => m.usuario_id === p.id)).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Button variant="outline" className="gap-1.5" onClick={pedirParaParticipar}><UserPlus className="h-4 w-4" /> Pedir para participar</Button>
          )}
        </DialogContent>
      </Dialog>

      {editavel && <BoardColumnConfig open={colunasAberto} onOpenChange={setColunasAberto} boardId={board.id} />}

      <CartaoProjetoDrawer
        boardId={board.id} boardNome={nome} card={card} colunas={colunas} editavel={!!card && podeEditar(card)}
        onOpenChange={(open) => !open && abrir(null)}
      />

      {aviso && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 z-50 rounded-md bg-foreground text-background px-4 py-2 text-sm shadow-lg">{aviso}</div>}

      {/* Trazer uma demanda para o quadro */}
      <Dialog open={demandaAberto} onOpenChange={(o) => { setDemandaAberto(o); if (!o) setBuscaDemanda(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Trazer demanda para {nome}</DialogTitle>
            <DialogDescription>Vira um cartão em "{colunas[0]?.nome}", já vinculado à demanda. Ao mudar de etapa, você escolhe se atualiza o status.</DialogDescription>
          </DialogHeader>
          <Input autoFocus value={buscaDemanda} onChange={(e) => setBuscaDemanda(e.target.value)} placeholder="Protocolo, título ou munícipe…" />
          <div className="max-h-72 overflow-y-auto divide-y rounded-md border">
            {buscaDemanda.trim().length < 2 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Digite ao menos 2 letras.</p>
            ) : resultadosDemanda.isLoading ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Buscando…</p>
            ) : (resultadosDemanda.data || []).length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Nenhuma demanda encontrada.</p>
            ) : (resultadosDemanda.data || []).map((d: any) => {
              const jaEsta = cards.some((c) => (extras.dems.get(c.id) || []).some((x) => x.id === d.id));
              return (
                <button key={d.id} type="button" disabled={jaEsta || createCard.isPending} onClick={() => criarDeDemanda(d)}
                  className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="text-xs font-mono text-primary shrink-0">#{d.protocolo}</span>
                  <span className="text-sm truncate flex-1">{d.titulo}</span>
                  {jaEsta && <span className="text-[11px] text-muted-foreground shrink-0">já está no quadro</span>}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Excluir cartão */}
      <AlertDialog open={!!cartaoExcluir} onOpenChange={(v) => !v && setCartaoExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o cartão "{cartaoExcluir?.titulo}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Vão junto o checklist, os comentários e o histórico. As demandas vinculadas continuam existindo.
              Para só tirar do caminho, use "Arquivar".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (cartaoExcluir) deleteCard.mutate(cartaoExcluir.id); setCartaoExcluir(null); }}>
              Excluir de vez
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Arquivados */}
      <Sheet open={arquivadosAberto} onOpenChange={setArquivadosAberto}>
        <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b text-left">
            <SheetTitle>Arquivados em {nome}</SheetTitle>
            <SheetDescription>Cartões tirados do quadro. Desarquive para voltarem à etapa em que estavam.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto divide-y">
            {(arquivados.data || []).length === 0 && <p className="p-5 text-sm text-muted-foreground">Nenhum cartão arquivado.</p>}
            {(arquivados.data || []).map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {colunas.find((col) => col.id === c.coluna_id)?.nome || "Etapa"} · arquivado em {new Date(c.arquivado_em).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                {podeEditar(c) && (
                  <>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => arquivados.desarquivar.mutate(c.id)}>
                      <ArchiveRestore className="h-3.5 w-3.5" /> Desarquivar
                    </Button>
                    {editavel && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={`Excluir ${c.titulo}`} onClick={() => setCartaoExcluir(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmarStatusDemandaDialog movimento={movimentos[0] ?? null} onClose={() => setMovimentos((m) => m.slice(1))} />
    </div>
  );
}
