import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditMunicipeDialogProps {
  municipe: any;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditMunicipeDialog({ municipe, trigger, open: externalOpen, onOpenChange: externalOnOpenChange }: EditMunicipeDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Usar controle externo se fornecido, senão usar controle interno
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "São Paulo",
    cep: "",
    complemento: "",
    data_nascimento: "",
    observacoes: "",
    tag_ids: [] as string[]
  });

  // Atualizar formData quando municipe muda
  useEffect(() => {
    if (municipe) {
      setFormData({
        nome: municipe.nome || "",
        telefone: municipe.telefone || "",
        email: municipe.email || "",
        logradouro: "",
        numero: "",
        bairro: municipe.bairro || "",
        cidade: municipe.cidade || "São Paulo",
        cep: municipe.cep || "",
        complemento: "",
        data_nascimento: municipe.data_nascimento || "",
        observacoes: municipe.observacoes || "",
        tag_ids: []
      });
    }
  }, [municipe]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Processar endereço existente para separar em campos
  useEffect(() => {
    if (municipe?.endereco) {
      const enderecoParts = municipe.endereco.split(',');
      if (enderecoParts.length > 0) {
        const logradouroNumero = enderecoParts[0].trim();
        const numeroMatch = logradouroNumero.match(/(\d+)\s*$/);
        
        if (numeroMatch) {
          const numero = numeroMatch[1];
          const logradouro = logradouroNumero.replace(/\s*\d+\s*$/, '').trim();
          setFormData(prev => ({
            ...prev,
            logradouro,
            numero
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            logradouro: logradouroNumero
          }));
        }
      }
      
      // Verificar se há complemento (após hífen)
      if (enderecoParts.length > 1) {
        const complemento = enderecoParts.slice(1).join(',').replace(/^\s*-\s*/, '').trim();
        setFormData(prev => ({
          ...prev,
          complemento
        }));
      }
    }
  }, [municipe]);

  // Buscar tags disponíveis
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar tags atuais do munícipe
  const { data: currentTags = [] } = useQuery({
    queryKey: ['municipe-tags', municipe?.id],
    queryFn: async () => {
      if (!municipe?.id) return [];
      
      const { data, error } = await supabase
        .from('municipe_tags')
        .select('tag_id, tags(id, nome, cor)')
        .eq('municipe_id', municipe.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!municipe?.id && open
  });

  // Carregar tags atuais quando currentTags mudar
  useEffect(() => {
    if (currentTags && currentTags.length > 0) {
      setFormData(prev => ({
        ...prev,
        tag_ids: currentTags.map((ct: any) => ct.tag_id)
      }));
    }
  }, [currentTags]);

  const updateMunicipe = useMutation({
    mutationFn: async (data: typeof formData) => {
      console.log('Iniciando atualização do munícipe:', municipe.id, data);
      
      // Montar endereço completo
      let endereco = '';
      if (data.logradouro) {
        endereco = data.logradouro;
        if (data.numero) endereco += `, ${data.numero}`;
        if (data.complemento) endereco += ` - ${data.complemento}`;
      }

      // Atualizar dados do munícipe
      const { error: updateError, data: updateData } = await supabase
        .from('municipes')
        .update({
          nome: data.nome,
          telefone: data.telefone || null,
          email: data.email || null,
          endereco: endereco || null,
          bairro: data.bairro || null,
          cidade: data.cidade,
          cep: data.cep || null,
          data_nascimento: data.data_nascimento || null,
          observacoes: data.observacoes || null
        })
        .eq('id', municipe.id)
        .select();

      console.log('Resultado da atualização:', { updateError, updateData });

      if (updateError) throw updateError;

      // Gerenciar tags
      // Primeiro, remover todas as tags existentes
      const { error: deleteError } = await supabase
        .from('municipe_tags')
        .delete()
        .eq('municipe_id', municipe.id);

      if (deleteError) {
        console.warn('Erro ao remover tags existentes:', deleteError);
      }

      // Adicionar novas tags
      if (formData.tag_ids.length > 0) {
        const tagInserts = formData.tag_ids.map(tagId => ({
          municipe_id: municipe.id,
          tag_id: tagId
        }));

        const { error: tagError } = await supabase
          .from('municipe_tags')
          .insert(tagInserts);

        if (tagError) {
          console.warn('Erro ao atualizar tags:', tagError);
        }
      }

      return true;
    },
    onSuccess: () => {
      toast({
        title: "Munícipe atualizado com sucesso!",
        description: "As informações foram salvas no sistema."
      });
      queryClient.invalidateQueries({ queryKey: ['municipes'] });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar munícipe",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) {
      toast({
        title: "Campo obrigatório",
        description: "O nome é obrigatório.",
        variant: "destructive"
      });
      return;
    }
    updateMunicipe.mutate(formData);
  };

  // Funções para gerenciar tags múltiplas
  const handleTagToggle = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId]
    }));
  };

  const removeTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.filter(id => id !== tagId)
    }));
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm">
      <Edit className="h-4 w-4 mr-2" />
      Editar
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Munícipe</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Pessoais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informações Pessoais</h3>
            
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento</Label>
              <Input
                id="data_nascimento"
                type="date"
                value={formData.data_nascimento}
                onChange={(e) => setFormData(prev => ({ ...prev, data_nascimento: e.target.value }))}
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Endereço</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input
                  id="logradouro"
                  value={formData.logradouro}
                  onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
                  placeholder="Rua, Avenida, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  value={formData.numero}
                  onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                  placeholder="123"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
                  placeholder="Centro, Vila Nova, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                  placeholder="São Paulo"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  value={formData.cep}
                  onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value }))}
                  placeholder="00000-000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={formData.complemento}
                  onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
                  placeholder="Apt, Bloco, etc."
                />
              </div>
            </div>
          </div>

          {/* Tag e Observações */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informações Adicionais</h3>
            
            <div className="space-y-2">
              <Label>Tags</Label>
              
              {/* Tags selecionadas */}
              {formData.tag_ids.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                  {formData.tag_ids.map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    return tag ? (
                      <Badge 
                        key={tag.id} 
                        variant="secondary"
                        className="flex items-center gap-1"
                        style={{ 
                          backgroundColor: `${tag.cor}20`,
                          borderColor: tag.cor,
                          color: tag.cor
                        }}
                      >
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: tag.cor }}
                        />
                        {tag.nome}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:bg-white/20 rounded-full" 
                          onClick={() => removeTag(tag.id)}
                        />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              
              {/* Seletor de tags */}
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-tag-${tag.id}`}
                      checked={formData.tag_ids.includes(tag.id)}
                      onCheckedChange={() => handleTagToggle(tag.id)}
                    />
                    <label
                      htmlFor={`edit-tag-${tag.id}`}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tag.cor }}
                      />
                      {tag.nome}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações adicionais sobre o munícipe"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMunicipe.isPending}>
              {updateMunicipe.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}