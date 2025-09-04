import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Plus, 
  MessageSquare, 
  Phone, 
  Mail, 
  Users, 
  MapPin, 
  Edit3,
  Calendar,
  Clock,
  Trash2,
  Edit
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

interface DemandaAtividadesTabProps {
  demandaId: string;
}

const tiposAtividade = [
  { value: "comentario", label: "Comentário", icon: MessageSquare, color: "bg-blue-500" },
  { value: "telefone", label: "Ligação", icon: Phone, color: "bg-green-500" },
  { value: "email", label: "E-mail", icon: Mail, color: "bg-purple-500" },
  { value: "reuniao", label: "Reunião", icon: Users, color: "bg-orange-500" },
  { value: "visita", label: "Visita Técnica", icon: MapPin, color: "bg-red-500" },
  { value: "atualizacao", label: "Atualização", icon: Edit3, color: "bg-gray-500" },
];

export function DemandaAtividadesTab({ demandaId }: DemandaAtividadesTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_atividade: "comentario",
      titulo: "",
      descricao: "",
      data_atividade: new Date().toISOString().slice(0, 16),
    },
  });

  // Buscar atividades da demanda
  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ['demanda-atividades', demandaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demanda_atividades')
        .select(`
          *,
          created_by_profile:profiles!fk_demanda_atividades_created_by (
            nome,
            email
          )
        `)
        .eq('demanda_id', demandaId)
        .order('data_atividade', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!demandaId,
  });

  // Criar nova atividade
  const createActivity = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from('demanda_atividades')
        .insert({
          demanda_id: demandaId,
          created_by: user.user.id,
          ...values,
          data_atividade: new Date(values.data_atividade).toISOString(),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Atividade criada!",
        description: "A atividade foi registrada com sucesso.",
      });
      form.reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['demanda-atividades', demandaId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar atividade",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Atualizar atividade
  const updateActivity = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: z.infer<typeof formSchema> }) => {
      const { error } = await supabase
        .from('demanda_atividades')
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
        title: "Atividade atualizada!",
        description: "A atividade foi atualizada com sucesso.",
      });
      form.reset();
      setEditingActivity(null);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['demanda-atividades', demandaId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar atividade",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Deletar atividade
  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('demanda_atividades')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Atividade removida!",
        description: "A atividade foi removida com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['demanda-atividades', demandaId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover atividade",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (editingActivity) {
      updateActivity.mutate({ id: editingActivity.id, values });
    } else {
      createActivity.mutate(values);
    }
  };

  const handleEdit = (atividade: any) => {
    setEditingActivity(atividade);
    form.reset({
      tipo_atividade: atividade.tipo_atividade,
      titulo: atividade.titulo,
      descricao: atividade.descricao || "",
      data_atividade: new Date(atividade.data_atividade).toISOString().slice(0, 16),
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingActivity(null);
    form.reset();
  };

  const getTipoAtividade = (tipo: string) => {
    return tiposAtividade.find(t => t.value === tipo) || tiposAtividade[0];
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Carregando atividades...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de nova atividade */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Atividades</h3>
          <p className="text-sm text-muted-foreground">
            {atividades.length} atividade(s) registrada(s)
          </p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Atividade
        </Button>
      </div>

      {/* Formulário para nova atividade */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {editingActivity ? "Editar Atividade" : "Nova Atividade"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo_atividade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Atividade</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposAtividade.map((tipo) => (
                              <SelectItem key={tipo.value} value={tipo.value}>
                                <div className="flex items-center gap-2">
                                  <tipo.icon className="h-4 w-4" />
                                  {tipo.label}
                                </div>
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
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Resumo da atividade" {...field} />
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
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Detalhes da atividade..." 
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
      <div className="space-y-4">
        {atividades.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <div className="text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma atividade registrada ainda.</p>
                <p className="text-sm">Clique em "Nova Atividade" para começar.</p>
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
                  <div className="absolute left-8 top-16 bottom-0 w-px bg-border" />
                )}
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Ícone do tipo de atividade */}
                      <div className={`p-2 rounded-full ${tipoAtividade.color} text-white flex-shrink-0`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      
                      {/* Conteúdo da atividade */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {tipoAtividade.label}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatDateTime(atividade.data_atividade)}
                            </span>
                          </div>
                          
                          {/* Ações da atividade */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(atividade)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.
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
                        
                        <h4 className="font-medium text-sm mb-2">{atividade.titulo}</h4>
                        
                        {atividade.descricao && (
                          <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">
                            {atividade.descricao}
                          </p>
                        )}
                        
                        {/* Informações do usuário */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {atividade.created_by_profile?.nome?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            Por {atividade.created_by_profile?.nome || "Usuário"} em {formatDateTime(atividade.created_at)}
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