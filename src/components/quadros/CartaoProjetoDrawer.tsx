import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, Link2, MessageSquare, History, Trash2, X, Plus, Lock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useKanbanBoardCards, KanbanBoardCard, KanbanBoardColuna } from "@/hooks/useKanbanBoards";
import { useBoardCardChecklist, useBoardCardComentarios } from "@/hooks/useBoardCardExtras";
import {
  usePessoasGabinete, useColaboradoresCartao, useDemandasCartao, useBuscaDemandas,
  useHistoricoCartao, descreverHistorico, avisar, urlDoCartao, colunaEhFinal,
} from "@/hooks/useQuadros";
import { EditorRico, EditorRicoRef, ConteudoRico } from "@/components/ui/EditorRico";
import { cn } from "@/lib/utils";

export function iniciais(nome?: string | null) {
  return (nome || "?").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const CORES_AVATAR = ["#2563eb", "#0f766e", "#c2410c", "#7c3aed", "#be185d", "#0369a1", "#4d7c0f", "#b45309"];
export function corDaPessoa(id?: string | null) {
  if (!id) return "#94a3b8";
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES_AVATAR[h % CORES_AVATAR.length];
}

export function Avatar({ id, nome, size = 24 }: { id?: string | null; nome?: string | null; size?: number }) {
  return (
    <span
      className="inline-grid place-items-center rounded-full text-white font-semibold ring-2 ring-background shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4), background: corDaPessoa(id) }}
      title={nome || undefined}
      aria-label={nome || undefined}
    >
      {iniciais(nome)}
    </span>
  );
}

interface Props {
  boardId: string;
  boardNome: string;
  card: KanbanBoardCard | null;
  colunas: KanbanBoardColuna[];
  editavel: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartaoProjetoDrawer({ boardId, boardNome, card, colunas, editavel, onOpenChange }: Props) {
  const { user, profile } = useAuth();
  const uid = user?.id || "";
  const { pessoas, porId } = usePessoasGabinete();
  const { updateCard, deleteCard } = useKanbanBoardCards(boardId);
  const { items, addItem, toggleItem, deleteItem, total, done, percent } = useBoardCardChecklist(card?.id);
  const { comentarios, addComentario, deleteComentario } = useBoardCardComentarios(card?.id);
  const { colaboradores, incluir: incluirColab, remover: removerColab } = useColaboradoresCartao(card?.id, boardId);
  const { demandas, vincular, desvincular } = useDemandasCartao(card?.id, boardId);
  const historico = useHistoricoCartao(card?.id);

  const [aba, setAba] = useState("detalhes");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [novoItem, setNovoItem] = useState("");
  const [buscaDem, setBuscaDem] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const editor = useRef<EditorRicoRef>(null);
  const resultadosDem = useBuscaDemandas(buscaDem);

  useEffect(() => {
    setTitulo(card?.titulo || "");
    setDescricao(card?.descricao || "");
    setAba("detalhes");
    setBuscaDem("");
    setConfirmarExclusao(false);
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) return null;

  const url = urlDoCartao(boardId, card.id);
  const nomeEu = profile?.nome || "Alguém";
  const salvar = (campos: Partial<KanbanBoardCard>) => updateCard.mutate({ id: card.id, ...campos });

  const mudarResponsavel = (id: string) => {
    const novo = id === "ninguem" ? null : id;
    salvar({ responsavel_id: novo } as any);
    if (novo) avisar({ destinatarios: [novo], remetente: uid, tipo: "atribuicao", titulo: "Cartão atribuído a você", mensagem: `${nomeEu} deixou você responsável por "${card.titulo}" (${boardNome}).`, url });
  };

  const incluirColaborador = (id: string) => {
    incluirColab.mutate(id, {
      onSuccess: () => avisar({ destinatarios: [id], remetente: uid, tipo: "atribuicao", titulo: "Você foi incluído(a) num cartão", mensagem: `${nomeEu} incluiu você em "${card.titulo}" (${boardNome}).`, url }),
    });
  };

  const comentar = () => {
    const c = editor.current?.conteudo();
    if (!c || c.vazio) return;
    addComentario.mutate(c.html, {
      onSuccess: () => {
        editor.current?.limpar();
        if (c.mencoes.length) {
          avisar({ destinatarios: c.mencoes, remetente: uid, tipo: "mencao", titulo: "Você foi mencionado(a)", mensagem: `${nomeEu} mencionou você em "${card.titulo}" (${boardNome}).`, url });
        }
      },
    });
  };

  const adicionarItem = () => {
    const t = novoItem.trim();
    if (!t) return;
    addItem.mutate(t, { onSuccess: () => setNovoItem("") });
  };

  const naoColaboradores = pessoas.filter((p) => p.id !== card.responsavel_id && !colaboradores.includes(p.id));
  const coluna = colunas.find((c) => c.id === card.coluna_id);
  const atrasado = card.data_prazo && !colunaEhFinal(coluna || {}) && card.data_prazo < new Date().toISOString().slice(0, 10);

  return (
    <Sheet open={!!card} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col gap-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b text-left space-y-1">
          <SheetDescription className="text-[11px] uppercase tracking-wide">{boardNome}</SheetDescription>
          {editavel ? (
            <Input
              value={titulo} onChange={(e) => setTitulo(e.target.value)}
              onBlur={() => titulo.trim() && titulo !== card.titulo && salvar({ titulo: titulo.trim() })}
              className="text-base font-semibold h-10" aria-label="Título do cartão"
            />
          ) : (
            <SheetTitle className="text-base">{card.titulo}</SheetTitle>
          )}
          {!editavel && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Só leitura — só membros do projeto editam.</p>
          )}
        </SheetHeader>

        <Tabs value={aba} onValueChange={setAba} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 grid grid-cols-3">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="comentarios" className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Comentários ({comentarios.length})</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1"><History className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
          </TabsList>

          {/* ── Detalhes ── */}
          <TabsContent value="detalhes" className="data-[state=inactive]:hidden flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5 mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Etapa</label>
                <Select value={card.coluna_id} onValueChange={(v) => salvar({ coluna_id: v })} disabled={!editavel}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="prazo-cartao">Prazo {atrasado && <span className="text-destructive font-semibold">· atrasado</span>}</label>
                <Input id="prazo-cartao" type="date" className="h-9" value={card.data_prazo || ""} disabled={!editavel}
                  onChange={(e) => salvar({ data_prazo: e.target.value || null } as any)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Responsável</label>
              <Select value={card.responsavel_id || "ninguem"} onValueChange={mudarResponsavel} disabled={!editavel}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguem">Sem responsável</SelectItem>
                  {pessoas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Colaboradores</label>
              <div className="flex flex-wrap gap-2">
                {colaboradores.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2 py-0.5 text-sm">
                    <Avatar id={id} nome={porId.get(id)?.nome} size={20} />{porId.get(id)?.nome || "Pessoa"}
                    {editavel && <button type="button" onClick={() => removerColab.mutate(id)} className="text-muted-foreground hover:text-destructive" aria-label={`Remover ${porId.get(id)?.nome}`}><X className="h-3 w-3" /></button>}
                  </span>
                ))}
                {colaboradores.length === 0 && <span className="text-sm text-muted-foreground">Ninguém além do responsável.</span>}
              </div>
              {editavel && (
                <Select value="" onValueChange={incluirColaborador}>
                  <SelectTrigger className="h-9 w-full sm:w-64"><SelectValue placeholder="+ Incluir colaborador" /></SelectTrigger>
                  <SelectContent>{naoColaboradores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Demandas vinculadas ({demandas.length})</label>
              <div className="space-y-1.5">
                {demandas.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                    <Link to={`/demandas?id=${d.id}`} className="text-xs font-mono text-primary hover:underline shrink-0">#{d.protocolo}</Link>
                    <span className="text-sm truncate flex-1 min-w-0">{d.titulo}</span>
                    <StatusBadge status={d.status} size="sm" />
                    {editavel && <button type="button" onClick={() => desvincular.mutate(d.id)} className="text-muted-foreground hover:text-destructive p-1" aria-label={`Desvincular ${d.protocolo}`}><X className="h-3.5 w-3.5" /></button>}
                  </div>
                ))}
                {demandas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma demanda vinculada.</p>}
              </div>
              {editavel && (
                <div className="relative">
                  <Input value={buscaDem} onChange={(e) => setBuscaDem(e.target.value)} placeholder="Vincular demanda: protocolo, título ou munícipe…" className="h-9" />
                  {buscaDem.trim().length >= 2 && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
                      {resultadosDem.isLoading ? <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p> :
                        (resultadosDem.data || []).filter((d: any) => !demandas.some((x) => x.id === d.id)).map((d: any) => (
                          <button key={d.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 border-b last:border-0"
                            onClick={() => { vincular.mutate(d.id); setBuscaDem(""); }}>
                            <span className="text-xs font-mono text-primary shrink-0">#{d.protocolo}</span>
                            <span className="text-sm truncate">{d.titulo}</span>
                          </button>
                        ))}
                      {!resultadosDem.isLoading && (resultadosDem.data || []).length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma demanda encontrada.</p>}
                    </div>
                  )}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">O status da demanda continua sendo controlado em Demandas.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CheckSquare className="h-3.5 w-3.5" /> Checklist · {done}/{total}</label>
              {total > 0 && <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${percent}%` }} /></div>}
              <div className="space-y-1">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50 group">
                    <Checkbox checked={it.concluido} disabled={!editavel} onCheckedChange={(v) => toggleItem.mutate({ itemId: it.id, concluido: v === true })} aria-label={it.texto} />
                    <span className={cn("text-sm flex-1 min-w-0 break-words", it.concluido && "line-through text-muted-foreground")}>{it.texto}</span>
                    {editavel && <button type="button" onClick={() => deleteItem.mutate(it.id)} className="text-muted-foreground hover:text-destructive p-1 md:opacity-0 md:group-hover:opacity-100" aria-label="Excluir item"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                ))}
              </div>
              {editavel && (
                <div className="flex gap-2">
                  <Input value={novoItem} onChange={(e) => setNovoItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionarItem()} placeholder="Novo item do checklist…" className="h-9" />
                  <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={adicionarItem}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="desc-cartao">Descrição</label>
              {editavel ? (
                <Textarea id="desc-cartao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4}
                  onBlur={() => descricao !== (card.descricao || "") && salvar({ descricao: descricao || null } as any)} placeholder="Detalhes do cartão…" />
              ) : <p className="text-sm whitespace-pre-wrap">{card.descricao || <span className="text-muted-foreground">Sem descrição.</span>}</p>}
            </div>

            {editavel && (
              <div className="pt-2 border-t">
                {confirmarExclusao ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md bg-destructive/10 p-3">
                    <span className="text-sm flex-1 min-w-[200px]">Excluir de vez este cartão, com checklist, comentários e histórico? Para só tirar do caminho, mova para a etapa final.</span>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmarExclusao(false)}>Cancelar</Button>
                    <Button size="sm" variant="destructive" onClick={() => { deleteCard.mutate(card.id); onOpenChange(false); }}>Excluir cartão</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setConfirmarExclusao(true)}>
                    <Trash2 className="h-4 w-4" /> Excluir cartão…
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Comentários ── */}
          <TabsContent value="comentarios" className="data-[state=inactive]:hidden flex-1 flex flex-col min-h-0 mt-0">
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {comentarios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>}
              {comentarios.map((c) => (
                <div key={c.id} className="flex gap-2.5 group">
                  <Avatar id={c.autor_id} nome={c.autor?.nome} size={28} />
                  <div className="flex-1 min-w-0 rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium">{c.autor?.nome || "Alguém"}</span>
                      <span className="flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        {c.autor_id === uid && <button type="button" className="text-muted-foreground hover:text-destructive p-0.5 md:opacity-0 md:group-hover:opacity-100" onClick={() => deleteComentario.mutate(c.id)} aria-label="Apagar comentário"><Trash2 className="h-3 w-3" /></button>}
                      </span>
                    </div>
                    <ConteudoRico html={c.texto} />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t px-5 py-3 space-y-2">
              {editavel ? (
                <>
                  <EditorRico ref={editor} pessoas={pessoas} onEnviar={comentar} placeholder="Escrever um comentário… digite @ para mencionar" />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Ctrl+Enter envia · quem for mencionado com @ recebe um aviso</span>
                    <Button size="sm" onClick={comentar} disabled={addComentario.isPending}>Comentar</Button>
                  </div>
                </>
              ) : <p className="text-sm text-muted-foreground flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Só membros do projeto comentam.</p>}
            </div>
          </TabsContent>

          {/* ── Histórico ── */}
          <TabsContent value="historico" className="data-[state=inactive]:hidden flex-1 min-h-0 overflow-y-auto px-5 py-4 mt-0">
            {historico.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
              (historico.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem registros ainda. As mudanças passam a ficar registradas aqui.</p>
              ) : (
                <ol className="relative border-l pl-4 space-y-3">
                  {(historico.data || []).map((h: any) => (
                    <li key={h.id} className="text-sm">
                      <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-border" aria-hidden />
                      <div className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                      <div><span className="font-medium">{porId.get(h.usuario_id)?.nome || "Sistema"}</span> {descreverHistorico(h.acao, h.detalhe)}</div>
                    </li>
                  ))}
                </ol>
              )}
            <p className="text-[11px] text-muted-foreground mt-4">Etapa, prazo, responsável, colaboradores, checklist e demandas vinculadas ficam registrados automaticamente.</p>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
