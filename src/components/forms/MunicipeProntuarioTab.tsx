import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Plus, 
  MessageSquare, 
  Phone, 
  Users, 
  MapPin, 
  Edit3,
  Trash2,
  Edit,
  Calendar,
  Handshake,
  Mail,
  FileText
} from "lucide-react";
import { formatDateTime } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const formSchema = z.object({
  tipo_atividade: z.string().min(1, "Tipo de atividade é obrigatório"),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  data_atividade: z.string().min(1, "Data da atividade é obrigatória"),
});

interface MunicipeProntuarioTabProps {
  municipeId: string;
}

const tiposAtividade = [
  { value: "anotacao", label: "Anotação", icon: FileText, color: "bg-gray-500" },
  { value: "ligacao", label: "Ligação Telefônica", icon: Phone, color: "bg-blue-500" },
  { value: "reuniao", label: "Reunião", icon: Users, color: "bg-purple-500" },
  { value: "visita", label: "Visita", icon: MapPin, color: "bg-red-500" },
  { value: "email", label: "E-mail", icon: Mail, color: "bg-yellow-600" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "bg-green-500" },
  { value: "evento", label: "Evento/Atividade", icon: Calendar, color: "bg-orange-500" },
  { value: "atendimento", label: "Atendimento Presencial", icon: Handshake, color: "bg-cyan-500" },
];

export function MunicipeProntuarioTab({ municipeId }: MunicipeProntuarioTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_atividade: "anotacao",
      titulo: "",
      descricao: "",
      data_atividade: (() => {
        const now = new Date();
        return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      })(),
    },
  });

  // Buscar atividades do munícipe
  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ['municipe-atividades', municipeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipe_atividades')
        .select(`
          *,
          created_by_profile:profiles!fk_municipe_atividades_created_by (
            nome,
            email
          )
        `)
        .eq('municipe_id', municipeId)
        .order('data_atividade', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!municipeId,
  });

  // Criar nova atividade
  const createActivity = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from('municipe_atividades')
        .insert({
          municipe_id: municipeId,
          created_by: user.user.id,
          ...values,
          data_atividade: new Date(values.data_atividade).toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Registro criado!",
        description: "O registro foi adicionado ao prontuário.",
      });
      form.reset({
        tipo_atividade: "anotacao",
        titulo: "",
        descricao: "",
        data_atividade: (() => {
          const now = new Date();
          return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        })(),
      });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['municipe-atividades', municipeId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Atualizar atividade
  const updateActivity = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: z.infer<typeof formSchema> }) => {
      const { error } = await supabase
        .from('municipe_atividades')
        .update({
          ...values,
          data_atividade: new Date(values.data_atividade).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Registro atualizado!",
        description: "O registro foi atualizado com sucesso.",
      });
      setEditingActivity(null);
      setShowForm(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['municipe-atividades', municipeId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Deletar atividade
  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('municipe_atividades')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Registro excluído!",
        description: "O registro foi removido do prontuário.",
      });
      queryClient.invalidateQueries({ queryKey: ['municipe-atividades', municipeId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    if (editingActivity) {
      updateActivity.mutate({ id: editingActivity.id, values });
    } else {
      createActivity.mutate(values);
    }
  };

  const handleEdit = (atividade: any) => {
    setEditingActivity(atividade);
    const dataAtividade = new Date(atividade.data_atividade);
    form.reset({
      tipo_atividade: atividade.tipo_atividade,
      titulo: atividade.titulo,
      descricao: atividade.descricao || "",
      data_atividade: new Date(dataAtividade.getTime() - (dataAtividade.getTimezoneOffset() * 60000)).toISOString().slice(0, 16),
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingActivity(null);
    setShowForm(false);
    form.reset();
  };

  const getTipoAtividade = (tipo: string) => {
    return tiposAtividade.find(t => t.value === tipo) || tiposAtividade[0];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Carregando prontuário...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botão para adicionar nova atividade */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Novo Registro
        </Button>
      )}

      {/* Formulário de nova atividade */}
      {showForm && (
        <Card>
          <CardContent className="p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo_atividade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Interação</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposAtividade.map((tipo) => {
                              const IconComponent = tipo.icon;
                              return (
                                <SelectItem key={tipo.value} value={tipo.value}>
                                  <div className="flex items-center gap-2">
                                    <IconComponent className="h-4 w-4" />
                                    {tipo.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="data_atividade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data e Hora</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título / Assunto</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Reunião sobre demanda de iluminação" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição / Anotações</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva os detalhes da interação, acordos, próximos passos..."
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createActivity.isPending || updateActivity.isPending}
                  >
                    {editingActivity ? "Atualizar" : "Salvar"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Timeline de atividades */}
      <div className="space-y-3">
        {atividades.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <div className="text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum registro no prontuário.</p>
                <p className="text-sm">Clique em "Novo Registro" para começar a documentar interações.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          atividades.map((atividade, index) => {
            const tipoAtividade = getTipoAtividade(atividade.tipo_atividade);
            const IconComponent = tipoAtividade.icon;
            
            return (
              <div key={atividade.id} className="relative">
                {index < atividades.length - 1 && (
                  <div className="absolute left-6 top-14 bottom-0 w-px bg-border" />
                )}
                
                <Card className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Ícone do tipo de atividade */}
                      <div className={`p-2 rounded-full ${tipoAtividade.color} text-white flex-shrink-0`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      
                      {/* Conteúdo da atividade */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {tipoAtividade.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(atividade.data_atividade)}
                            </span>
                          </div>
                          
                          {/* Ações da atividade */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(atividade)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteActivity.mutate(atividade.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        
                        <h4 className="font-medium text-sm mb-1">{atividade.titulo}</h4>
                        
                        {atividade.descricao && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
                            {atividade.descricao}
                          </p>
                        )}
                        
                        {/* Informações do usuário */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px]">
                              {atividade.created_by_profile?.nome?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {atividade.created_by_profile?.nome || "Usuário"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
