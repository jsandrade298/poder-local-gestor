import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
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
      const { data, error } = await supabase.from('eixos').select('*').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const createEixo = useMutation({
    mutationFn: async (eixo: { nome: string; descricao: string; cor: string }) => {
      const { data, error } = await supabase.from('eixos').insert([eixo]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eixos-manager'] });
      queryClient.invalidateQueries({ queryKey: ['eixos'] });
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
              <CardTitle>Eixos Existentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : eixos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        Nenhum eixo encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    eixos.map((eixo) => (
                      <TableRow key={eixo.id}>
                        <TableCell>
                          {editingId === eixo.id ? (
                            <Input
                              value={editingValues.nome}
                              onChange={(e) => setEditingValues({ ...editingValues, nome: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            eixo.nome
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === eixo.id ? (
                            <Input
                              value={editingValues.descricao}
                              onChange={(e) => setEditingValues({ ...editingValues, descricao: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            eixo.descricao || '-'
                          )}
                        </TableCell>
                        <TableCell>
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
                              {eixo.cor}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}