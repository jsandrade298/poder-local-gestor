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

interface TemasManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemasManagerDialog({ open, onOpenChange }: TemasManagerDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState({ nome: '', descricao: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [newTema, setNewTema] = useState({ nome: '', descricao: '' });

  const queryClient = useQueryClient();

  const { data: temas = [], isLoading } = useQuery({
    queryKey: ['temas-manager'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('temas_acao')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    }
  });


  const createTema = useMutation({
    mutationFn: async (tema: { nome: string; descricao: string }) => {
      const { data, error } = await supabase.from('temas_acao').insert([tema]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temas-manager'] });
      queryClient.invalidateQueries({ queryKey: ['temas-acao'] });
      setIsCreating(false);
      setNewTema({ nome: '', descricao: '' });
      toast.success('Tema criado com sucesso!');
    }
  });

  const updateTema = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('temas_acao')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temas-manager'] });
      queryClient.invalidateQueries({ queryKey: ['temas-acao'] });
      setEditingId(null);
      toast.success('Tema atualizado com sucesso!');
    }
  });

  const deleteTema = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('temas_acao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temas-manager'] });
      queryClient.invalidateQueries({ queryKey: ['temas-acao'] });
      toast.success('Tema excluído com sucesso!');
    },
    onError: (error: any) => {
      if (error.code === '23503') {
        toast.error('Não é possível excluir este tema pois existem ações vinculadas a ele.');
      } else {
        toast.error('Erro ao excluir tema');
      }
    }
  });

  const handleEdit = (tema: any) => {
    setEditingId(tema.id);
    setEditingValues({
      nome: tema.nome,
      descricao: tema.descricao || ''
    });
  };

  const handleSave = () => {
    if (editingId) {
      updateTema.mutate({ id: editingId, updates: editingValues });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingValues({ nome: '', descricao: '' });
  };

  const handleCreate = () => {
    if (newTema.nome.trim()) {
      createTema.mutate(newTema);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Temas</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Criar novo tema */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Novo Tema
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isCreating ? (
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Tema
                </Button>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="novo-nome">Nome</Label>
                    <Input
                      id="novo-nome"
                      value={newTema.nome}
                      onChange={(e) => setNewTema({ ...newTema, nome: e.target.value })}
                      placeholder="Nome do tema"
                    />
                  </div>
                  <div>
                    <Label htmlFor="novo-descricao">Descrição</Label>
                    <Input
                      id="novo-descricao"
                      value={newTema.descricao}
                      onChange={(e) => setNewTema({ ...newTema, descricao: e.target.value })}
                      placeholder="Descrição do tema"
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

          {/* Lista de temas */}
          <Card>
            <CardHeader>
              <CardTitle>Temas Existentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : temas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        Nenhum tema encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    temas.map((tema) => (
                      <TableRow key={tema.id}>
                        <TableCell>
                          {editingId === tema.id ? (
                            <Input
                              value={editingValues.nome}
                              onChange={(e) => setEditingValues({ ...editingValues, nome: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            tema.nome
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === tema.id ? (
                            <Input
                              value={editingValues.descricao}
                              onChange={(e) => setEditingValues({ ...editingValues, descricao: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            tema.descricao || '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === tema.id ? (
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
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(tema)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => deleteTema.mutate(tema.id)}
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