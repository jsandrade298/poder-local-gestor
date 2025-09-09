import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit2, Trash2, Save, X, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";

interface EixosManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EixosManagerDialog({ open, onOpenChange }: EixosManagerDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState({ nome: '', descricao: '', cor: '#3B82F6' });
  const [isCreating, setIsCreating] = useState(false);
  const [newEixo, setNewEixo] = useState({ nome: '', descricao: '', cor: '#3B82F6' });

  const queryClient = useQueryClient();

  const { data: eixos = [], isLoading } = useQuery({
    queryKey: ['eixos-manager'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eixos').select('*').order('ordem');
      if (error) throw error;
      return data;
    }
  });

  const createEixo = useMutation({
    mutationFn: async (eixo: { nome: string; descricao: string; cor: string }) => {
      // Buscar próximo número de ordem
      const { data: maxEixo } = await supabase
        .from('eixos')
        .select('ordem')
        .order('ordem', { ascending: false })
        .limit(1);
      
      const novaOrdem = (maxEixo && maxEixo[0]?.ordem) ? maxEixo[0].ordem + 1 : 1;
      
      const { data, error } = await supabase.from('eixos').insert([
        { ...eixo, ordem: novaOrdem }
      ]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eixos-manager'] });
      queryClient.invalidateQueries({ queryKey: ['eixos'] });
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      setIsCreating(false);
      setNewEixo({ nome: '', descricao: '', cor: '#3B82F6' });
      toast.success('Eixo criado com sucesso!');
    }
  });

  const updateEixo = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('eixos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eixos-manager'] });
      queryClient.invalidateQueries({ queryKey: ['eixos'] });
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      setEditingId(null);
      toast.success('Eixo atualizado com sucesso!');
    }
  });

  const deleteEixo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('eixos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eixos-manager'] });
      queryClient.invalidateQueries({ queryKey: ['eixos'] });
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      toast.success('Eixo excluído com sucesso!');
    },
    onError: (error: any) => {
      if (error.code === '23503') {
        toast.error('Não é possível excluir este eixo pois existem ações vinculadas a ele.');
      } else {
        toast.error('Erro ao excluir eixo');
      }
    }
  });

  // Função para reordenar eixos
  const reorderEixos = useMutation({
    mutationFn: async (reorderedEixos: typeof eixos) => {
      // Atualizar todos os eixos com sua nova posição
      const updates = reorderedEixos.map((eixo, index) => 
        supabase
          .from('eixos')
          .update({ ordem: index + 1 })
          .eq('id', eixo.id)
      );
      
      const results = await Promise.all(updates);
      const errors = results.filter(result => result.error);
      if (errors.length > 0) throw errors[0].error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eixos-manager'] });
      queryClient.invalidateQueries({ queryKey: ['eixos'] });
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
    }
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Criar nova lista reordenada
    const newEixos = Array.from(eixos);
    const [reorderedItem] = newEixos.splice(sourceIndex, 1);
    newEixos.splice(destinationIndex, 0, reorderedItem);

    // Atualizar no banco
    reorderEixos.mutate(newEixos);
  };

  const handleEdit = (eixo: any) => {
    setEditingId(eixo.id);
    setEditingValues({
      nome: eixo.nome,
      descricao: eixo.descricao || '',
      cor: eixo.cor || '#3B82F6'
    });
  };

  const handleSave = () => {
    if (editingId) {
      updateEixo.mutate({ id: editingId, updates: editingValues });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingValues({ nome: '', descricao: '', cor: '#3B82F6' });
  };

  const handleCreate = () => {
    if (newEixo.nome.trim()) {
      createEixo.mutate(newEixo);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Eixos</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Criar novo eixo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Novo Eixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isCreating ? (
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Eixo
                </Button>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="novo-nome">Nome</Label>
                    <Input
                      id="novo-nome"
                      value={newEixo.nome}
                      onChange={(e) => setNewEixo({ ...newEixo, nome: e.target.value })}
                      placeholder="Nome do eixo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="novo-descricao">Descrição</Label>
                    <Input
                      id="novo-descricao"
                      value={newEixo.descricao}
                      onChange={(e) => setNewEixo({ ...newEixo, descricao: e.target.value })}
                      placeholder="Descrição do eixo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="novo-cor">Cor</Label>
                    <Input
                      id="novo-cor"
                      type="color"
                      value={newEixo.cor}
                      onChange={(e) => setNewEixo({ ...newEixo, cor: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={handleCreate} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsCreating(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de eixos */}
          <Card>
            <CardHeader>
              <CardTitle>Eixos Existentes (Arraste para reordenar)</CardTitle>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-4 p-3 bg-muted rounded-lg font-semibold text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6"></div>
                      Nome
                    </div>
                    <div>Descrição</div>
                    <div>Cor</div>
                    <div>Ações</div>
                    <div></div>
                  </div>
                  
                  <Droppable droppableId="eixos-list">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {isLoading ? (
                          <div className="p-4 text-center bg-card rounded-lg border">
                            Carregando...
                          </div>
                        ) : eixos.length === 0 ? (
                          <div className="p-4 text-center bg-card rounded-lg border">
                            Nenhum eixo encontrado
                          </div>
                        ) : (
                          eixos.map((eixo, index) => (
                            <Draggable key={eixo.id} draggableId={eixo.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  style={provided.draggableProps.style}
                                  className={`grid grid-cols-5 gap-4 p-3 bg-card rounded-lg border ${
                                    snapshot.isDragging 
                                      ? "shadow-xl bg-accent border-primary" 
                                      : "hover:bg-accent/50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div 
                                      {...provided.dragHandleProps} 
                                      className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded flex-shrink-0"
                                    >
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    {editingId === eixo.id ? (
                                      <Input
                                        value={editingValues.nome}
                                        onChange={(e) => setEditingValues({ ...editingValues, nome: e.target.value })}
                                        className="h-8 flex-1"
                                      />
                                    ) : (
                                      <span className="font-medium">{eixo.nome}</span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center">
                                    {editingId === eixo.id ? (
                                      <Input
                                        value={editingValues.descricao}
                                        onChange={(e) => setEditingValues({ ...editingValues, descricao: e.target.value })}
                                        className="h-8"
                                      />
                                    ) : (
                                      <span className="text-sm text-muted-foreground">{eixo.descricao || '-'}</span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center">
                                    {editingId === eixo.id ? (
                                      <Input
                                        type="color"
                                        value={editingValues.cor}
                                        onChange={(e) => setEditingValues({ ...editingValues, cor: e.target.value })}
                                        className="h-8 w-16"
                                      />
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-4 h-4 rounded border"
                                          style={{ backgroundColor: eixo.cor }}
                                        />
                                        <span className="text-xs font-mono">{eixo.cor}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center">
                                    {editingId === eixo.id ? (
                                      <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" onClick={handleSave}>
                                          <Save className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={handleCancel}>
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => handleEdit(eixo)}>
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          onClick={() => deleteEixo.mutate(eixo.id)}
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div></div>
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </DragDropContext>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}