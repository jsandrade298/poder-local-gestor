import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Save, X, Trash2, Calendar, User, AlertTriangle, Edit, CheckSquare,
  MessageSquare, Plus, Send, Clock, Palette,
} from "lucide-react";
import { useKanbanBoardCards, useKanbanBoardColunas, KanbanBoardCard } from "@/hooks/useKanbanBoards";
import { useBoardCardChecklist, useBoardCardComentarios } from "@/hooks/useBoardCardExtras";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatDateOnly } from "@/lib/dateUtils";
import { Linkify } from "@/components/ui/Linkify";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CORES_CARD = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6b7280",
];

interface BoardCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  card?: KanbanBoardCard | null;
  defaultColunaId?: string;
}

export function BoardCardDialog({ open, onOpenChange, boardId, card, defaultColunaId }: BoardCardDialogProps) {
  const { createCard, updateCard, deleteCard } = useKanbanBoardCards(boardId);
  const { colunas } = useKanbanBoardColunas(boardId);
  const isEditing = !!card?.id;

  const { items: checklistItems, addItem, toggleItem, deleteItem, total: checkTotal, done: checkDone, percent: checkPercent } =
    useBoardCardChecklist(isEditing ? card?.id : undefined);
  const { comentarios, addComentario } =
    useBoardCardComentarios(isEditing ? card?.id : undefined);

  const [activeTab, setActiveTab] = useState("detalhes");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [novoItemTexto, setNovoItemTexto] = useState("");
  const [novoComentario, setNovoComentario] = useState("");

  const [form, setForm] = useState({
    titulo: "", descricao: "", responsavel_id: "", prioridade: "media",
    cor: "#3b82f6", data_prazo: "", coluna_id: "",
  });

  useEffect(() => {
    if (card) {
      setForm({
        titulo: card.titulo || "", descricao: card.descricao || "",
        responsavel_id: card.responsavel_id || "", prioridade: card.prioridade || "media",
        cor: card.cor || "#3b82f6", data_prazo: card.data_prazo || "",
        coluna_id: card.coluna_id || "",
      });
      setIsEditMode(false);
      setActiveTab("detalhes");
    } else {
      setForm({ titulo: "", descricao: "", responsavel_id: "", prioridade: "media",
        cor: "#3b82f6", data_prazo: "", coluna_id: defaultColunaId || colunas[0]?.id || "" });
      setIsEditMode(true);
      setActiveTab("detalhes");
    }
    setNovoItemTexto("");
    setNovoComentario("");
  }, [card, open, defaultColunaId, colunas]);

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-gabinete'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome')
        .neq('role_no_tenant', 'representante').order('nome');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const getResponsavelNome = (id: string | null | undefined) => {
    if (!id) return 'Não definido';
    return usuarios.find(u => u.id === id)?.nome || 'Não definido';
  };
  const getColunaNome = (id: string) => colunas.find(c => c.id === id)?.nome || '—';
  const getPrioridadeLabel = (p: string) => ({ baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }[p] || p);
  const getPrioridadeColor = (p: string) => ({ baixa: '#22c55e', media: '#f59e0b', alta: '#ef4444', urgente: '#dc2626' }[p] || '#6b7280');
  const isOverdue = card?.data_prazo && new Date(card.data_prazo + 'T23:59:59') < new Date();
  const isPending = createCard.isPending || updateCard.isPending;

  const handleSave = () => {
    if (!form.titulo.trim()) return;
    if (isEditing) {
      updateCard.mutate({ id: card!.id, titulo: form.titulo, descricao: form.descricao || null,
        responsavel_id: form.responsavel_id || null, prioridade: form.prioridade,
        cor: form.cor, data_prazo: form.data_prazo || null, coluna_id: form.coluna_id } as any);
      setIsEditMode(false);
    } else {
      createCard.mutate({ coluna_id: form.coluna_id, titulo: form.titulo,
        descricao: form.descricao || undefined, responsavel_id: form.responsavel_id || undefined,
        prioridade: form.prioridade, cor: form.cor, data_prazo: form.data_prazo || undefined });
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (card?.id) { deleteCard.mutate(card.id); setShowDeleteConfirm(false); onOpenChange(false); }
  };

  const handleAddChecklistItem = () => {
    if (!novoItemTexto.trim()) return;
    addItem.mutate(novoItemTexto.trim());
    setNovoItemTexto("");
  };

  const handleAddComentario = () => {
    if (!novoComentario.trim()) return;
    addComentario.mutate(novoComentario.trim());
    setNovoComentario("");
  };

  // ── Form fields (shared between create and edit modes) ──
  const renderForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Título *</Label>
        <Input value={form.titulo} onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))}
          placeholder="O que precisa ser feito?" autoFocus />
      </div>
      <div className="space-y-2">
        <Label>Coluna</Label>
        <Select value={form.coluna_id} onValueChange={(v) => setForm(f => ({ ...f, coluna_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {colunas.map(col => (
              <SelectItem key={col.id} value={col.id}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.cor }} />{col.nome}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Responsável</Label>
          <Select value={form.responsavel_id || "__none__"}
            onValueChange={(v) => setForm(f => ({ ...f, responsavel_id: v === "__none__" ? "" : v }))}>
            <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <Select value={form.prioridade} onValueChange={(v) => setForm(f => ({ ...f, prioridade: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Prazo</Label>
        <Input type="date" value={form.data_prazo} onChange={(e) => setForm(f => ({ ...f, data_prazo: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Cor do card</Label>
        <div className="flex gap-2">
          {CORES_CARD.map(cor => (
            <button key={cor} type="button" onClick={() => setForm(f => ({ ...f, cor }))}
              className={`w-7 h-7 rounded-full border-2 transition-all ${form.cor === cor ? "border-gray-800 dark:border-white scale-110" : "border-transparent hover:scale-105"}`}
              style={{ backgroundColor: cor }} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
          placeholder="Detalhes do card..." rows={3} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {isEditing ? (
          <>
            <Button variant="outline" onClick={() => setIsEditMode(false)} disabled={isPending}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.titulo.trim() || isPending}>
              <Save className="h-4 w-4 mr-2" />{isPending ? "Salvando..." : "Salvar"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              <X className="h-4 w-4 mr-2" />Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!form.titulo.trim() || !form.coluna_id || isPending}>
              <Save className="h-4 w-4 mr-2" />{isPending ? "Salvando..." : "Criar Card"}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  // ── Create mode: simple form ──
  if (!isEditing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Card</DialogTitle></DialogHeader>
          {renderForm()}
        </DialogContent>
      </Dialog>
    );
  }

  // ── View/Edit mode: with tabs ──
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 min-w-0">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: card?.cor || '#3b82f6' }} />
                <span className="truncate">{card?.titulo}</span>
              </DialogTitle>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditMode(!isEditMode)}
                  title={isEditMode ? "Visualizar" : "Editar"}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700"
                  onClick={() => setShowDeleteConfirm(true)} title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {isEditMode ? (
            <div className="overflow-y-auto flex-1 pr-1">{renderForm()}</div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
                <TabsTrigger value="detalhes" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Edit className="h-3.5 w-3.5" />Detalhes
                </TabsTrigger>
                <TabsTrigger value="checklist" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <CheckSquare className="h-3.5 w-3.5" />Checklist
                  {checkTotal > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{checkDone}/{checkTotal}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="comentarios" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <MessageSquare className="h-3.5 w-3.5" />Comentários
                  {comentarios.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{comentarios.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              {/* ── Detalhes ── */}
              <TabsContent value="detalhes" className="space-y-4 mt-4 overflow-y-auto flex-1 pr-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1" style={{
                    borderColor: colunas.find(c => c.id === card?.coluna_id)?.cor,
                    color: colunas.find(c => c.id === card?.coluna_id)?.cor }}>
                    {getColunaNome(card?.coluna_id || '')}
                  </Badge>
                  <Badge variant="outline" style={{
                    borderColor: getPrioridadeColor(card?.prioridade || 'media'),
                    color: getPrioridadeColor(card?.prioridade || 'media') }}>
                    {getPrioridadeLabel(card?.prioridade || 'media')}
                  </Badge>
                  {isOverdue && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Atrasado</Badge>}
                </div>

                {card?.descricao ? (
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium">Descrição</h3>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                      <Linkify>{card.descricao}</Linkify>
                    </div>
                  </div>
                ) : <p className="text-sm text-muted-foreground italic">Sem descrição</p>}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium flex items-center gap-1.5"><User className="h-4 w-4" />Responsável</h3>
                    <p className="text-sm text-muted-foreground">{getResponsavelNome(card?.responsavel_id)}</p>
                  </div>
                  {card?.data_prazo && (
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-medium flex items-center gap-1.5"><Calendar className="h-4 w-4" />Prazo</h3>
                      <p className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{formatDateOnly(card.data_prazo)}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium flex items-center gap-1.5"><Palette className="h-4 w-4" />Cor</h3>
                    <div className="w-5 h-5 rounded border" style={{ backgroundColor: card?.cor || '#3b82f6' }} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium flex items-center gap-1.5"><Clock className="h-4 w-4" />Criado em</h3>
                    <p className="text-sm text-muted-foreground">{card?.created_at ? formatDateTime(card.created_at) : '—'}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-medium">Criado por</h3>
                  <p className="text-sm text-muted-foreground">{card?.criador?.nome || 'Usuário'}</p>
                </div>
              </TabsContent>

              {/* ── Checklist ── */}
              <TabsContent value="checklist" className="space-y-4 mt-4 overflow-y-auto flex-1 pr-1">
                {checkTotal > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{checkDone}/{checkTotal} concluídos ({checkPercent}%)</span>
                    </div>
                    <Progress value={checkPercent} className="h-2" />
                  </div>
                )}
                <div className="space-y-1">
                  {checklistItems.map((item) => (
                    <div key={item.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg group transition-colors hover:bg-muted/50 ${item.concluido ? 'opacity-60' : ''}`}>
                      <Checkbox checked={item.concluido}
                        onCheckedChange={(checked) => toggleItem.mutate({ itemId: item.id, concluido: !!checked })} />
                      <span className={`flex-1 text-sm ${item.concluido ? 'line-through text-muted-foreground' : ''}`}>{item.texto}</span>
                      <Button variant="ghost" size="sm"
                        className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteItem.mutate(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {checkTotal === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum item no checklist. Adicione abaixo.</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Input value={novoItemTexto} onChange={(e) => setNovoItemTexto(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                    placeholder="Adicionar item ao checklist..." className="flex-1" />
                  <Button size="sm" onClick={handleAddChecklistItem} disabled={!novoItemTexto.trim() || addItem.isPending}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              {/* ── Comentários ── */}
              <TabsContent value="comentarios" className="space-y-4 mt-4 overflow-y-auto flex-1 pr-1">
                <div className="space-y-2">
                  <Textarea value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleAddComentario(); } }}
                    placeholder="Escrever um comentário... (Ctrl+Enter para enviar)" rows={3} className="resize-none" />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleAddComentario}
                      disabled={!novoComentario.trim() || addComentario.isPending} className="gap-1.5">
                      <Send className="h-3.5 w-3.5" />{addComentario.isPending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {comentarios.map((c) => (
                    <div key={c.id} className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{c.autor?.nome?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                          <span className="text-sm font-medium">{c.autor?.nome || 'Usuário'}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap pl-9"><Linkify>{c.texto}</Linkify></div>
                    </div>
                  ))}
                  {comentarios.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda. Seja o primeiro!</p>}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{card?.titulo}"? O checklist e os comentários também serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
