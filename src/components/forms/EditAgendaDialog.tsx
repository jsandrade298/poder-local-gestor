import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const formSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  validador_id: z.string().min(1, "Selecione um validador"),
  data_hora_proposta: z.string().min(1, "Data e hora são obrigatórias"),
  duracao_prevista: z.string().min(1, "Informe a duração prevista"),
  participantes: z.string().min(1, "Informe os participantes"),
  local_endereco: z.string().min(1, "Informe o local ou link"),
  descricao_objetivo: z.string().min(1, "Descreva o objetivo"),
  pauta_sugerida: z.string().min(1, "Informe a pauta"),
  acompanha_mandato_ids: z.array(z.string()).optional(),
  material_apoio: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EditAgendaDialogProps {
  agenda: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgendaUpdated?: (updatedAgenda: any) => void;
}

export const EditAgendaDialog = ({ agenda, open, onOpenChange, onAgendaUpdated }: EditAgendaDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      acompanha_mandato_ids: [],
      material_apoio: "",
      observacoes: "",
    },
  });

  // Buscar usuários
  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar acompanhantes atuais da agenda
  const { data: acompanhantesAtuais } = useQuery({
    queryKey: ["acompanhantes-agenda", agenda?.id],
    queryFn: async () => {
      if (!agenda?.id) return [];
      
      const { data, error } = await supabase
        .from("agenda_acompanhantes")
        .select("usuario_id")
        .eq("agenda_id", agenda.id);
      
      if (error) throw error;
      return data?.map(a => a.usuario_id) || [];
    },
    enabled: !!agenda?.id && open,
  });

  // Preencher formulário quando agenda ou acompanhantes mudam
  useEffect(() => {
    if (agenda && acompanhantesAtuais) {
      const dataHora = agenda.data_hora_proposta 
        ? new Date(agenda.data_hora_proposta).toISOString().slice(0, 16)
        : "";

      form.reset({
        titulo: agenda.titulo || "",
        validador_id: agenda.validador_id || "",
        data_hora_proposta: dataHora,
        duracao_prevista: agenda.duracao_prevista || "",
        participantes: agenda.participantes || "",
        local_endereco: agenda.local_endereco || "",
        descricao_objetivo: agenda.descricao_objetivo || "",
        pauta_sugerida: agenda.pauta_sugerida || "",
        acompanha_mandato_ids: acompanhantesAtuais || [],
        material_apoio: agenda.material_apoio || "",
        observacoes: agenda.observacoes || "",
      });
    }
  }, [agenda, acompanhantesAtuais, form]);

  // Verificar se o usuário pode editar
  const canEdit = user && agenda && (
    agenda.solicitante_id === user.id ||
    agenda.validador_id === user.id ||
    (acompanhantesAtuais && acompanhantesAtuais.includes(user.id))
  );

  // Debug para entender o problema
  console.log('EditAgendaDialog - Debug:', {
    user: user?.email,
    userId: user?.id,
    agendaId: agenda?.id,
    solicitanteId: agenda?.solicitante_id,
    validadorId: agenda?.validador_id,
    acompanhantesAtuais,
    canEdit
  });

  // Atualizar agenda
  const updateAgendaMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!agenda?.id) throw new Error("ID da agenda não encontrado");

      // Atualizar dados da agenda
      const { error: agendaError } = await supabase
        .from("agendas")
        .update({
          titulo: data.titulo,
          validador_id: data.validador_id,
          data_hora_proposta: new Date(data.data_hora_proposta).toISOString(),
          duracao_prevista: data.duracao_prevista,
          participantes: data.participantes,
          local_endereco: data.local_endereco,
          descricao_objetivo: data.descricao_objetivo,
          pauta_sugerida: data.pauta_sugerida,
          material_apoio: data.material_apoio || null,
          observacoes: data.observacoes || null,
        })
        .eq("id", agenda.id);

      if (agendaError) throw agendaError;

      // Atualizar acompanhantes
      // Primeiro, remover todos os acompanhantes atuais
      const { error: deleteError } = await supabase
        .from("agenda_acompanhantes")
        .delete()
        .eq("agenda_id", agenda.id);

      if (deleteError) throw deleteError;

      // Adicionar novos acompanhantes
      if (data.acompanha_mandato_ids && data.acompanha_mandato_ids.length > 0) {
        const novosAcompanhantes = data.acompanha_mandato_ids.map(userId => ({
          agenda_id: agenda.id,
          usuario_id: userId,
        }));

        const { error: insertError } = await supabase
          .from("agenda_acompanhantes")
          .insert(novosAcompanhantes);

        if (insertError) throw insertError;
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Agenda atualizada!",
        description: "As informações foram salvas com sucesso",
      });
      
      // Invalidar queries para atualizar as listas
      queryClient.invalidateQueries({ queryKey: ["minhas-agendas"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-detalhada"] });
      
      // Atualizar o agenda no modal principal se callback fornecido
      if (onAgendaUpdated && agenda) {
        const updatedAgenda = {
          ...agenda,
          ...data,
          // Manter acompanhantes atualizados
          acompanhantes_nomes: data.acompanha_mandato_ids?.map(id => 
            usuarios?.find(u => u.id === id)
          ).filter(Boolean).map(u => ({ id: u.id, nome: u.nome })) || []
        };
        onAgendaUpdated(updatedAgenda);
      }
      
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao atualizar agenda:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    console.log('onSubmit - Debug:', {
      user: user?.email,
      canEdit,
      data
    });

    if (!canEdit) {
      toast({
        title: "Sem permissão",
        description: "Você não pode editar esta agenda",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateAgendaMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Só retorna null se temos certeza que o usuário não pode editar
  // (aguarda carregamento dos acompanhantes)
  if (acompanhantesAtuais !== undefined && !canEdit) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Agenda</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Título da Agenda *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Digite o título da agenda..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="validador_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validador *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {usuarios?.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_hora_proposta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data/Hora *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duracao_prevista"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração Prevista *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 1 hora" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="participantes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Participantes *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Liste os participantes..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="local_endereco"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Local/Endereço/Link *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Local ou link da reunião..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descricao_objetivo"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Descrição/Objetivo *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva o objetivo da reunião..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pauta_sugerida"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Pauta Sugerida *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tópicos a serem abordados..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="acompanha_mandato_ids"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Quem Acompanha pelo Mandato</FormLabel>
                    <div className="space-y-2">
                      <Select
                        onValueChange={(value) => {
                          if (value && !field.value?.includes(value)) {
                            field.onChange([...(field.value || []), value]);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Adicionar acompanhante" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {usuarios
                            ?.filter(u => !(field.value || []).includes(u.id) && u.id !== user?.id)
                            .map(u => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      
                      {field.value && field.value.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {field.value.map(id => {
                            const usuario = usuarios?.find(u => u.id === id);
                            return usuario ? (
                              <Badge key={id} variant="secondary">
                                {usuario.nome}
                                <X
                                  className="h-3 w-3 ml-1 cursor-pointer"
                                  onClick={() => {
                                    field.onChange(field.value?.filter(v => v !== id) || []);
                                  }}
                                />
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="material_apoio"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Material de Apoio</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Links, documentos, referências..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Informações adicionais..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};