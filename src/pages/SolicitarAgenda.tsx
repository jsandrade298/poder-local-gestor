import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Clock, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/dateUtils";

const formSchema = z.object({
  solicitante_id: z.string().min(1, "Selecione um solicitante"),
  validador_id: z.string().min(1, "Selecione um validador"),
  data_hora_proposta: z.string().min(1, "Data e hora da reunião são obrigatórias"),
  duracao_prevista: z.string().min(1, "Informe a duração prevista"),
  participantes: z.string().min(1, "Informe os participantes"),
  local_endereco: z.string().min(1, "Informe o local ou link da reunião"),
  descricao_objetivo: z.string().min(1, "Descreva o objetivo da reunião"),
  pauta_sugerida: z.string().min(1, "Informe a pauta sugerida"),
  acompanha_mandato_ids: z.array(z.string()).min(1, "Selecione pelo menos um responsável pelo mandato"),
  material_apoio: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const SolicitarAgenda = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("solicitar");
  const [selectedAgenda, setSelectedAgenda] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  
  // Data do pedido atual (não editável)
  const dataPedido = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      acompanha_mandato_ids: [],
      material_apoio: "",
      observacoes: "",
    },
  });

  // Buscar usuários para os selects
  const { data: usuarios, isLoading: loadingUsuarios } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!user?.id) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Inserir a agenda
      const { data: agenda, error: agendaError } = await supabase
        .from("agendas")
        .insert({
          solicitante_id: user.id,
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
        .select()
        .single();

      if (agendaError) throw agendaError;

      // Inserir os acompanhantes
      if (data.acompanha_mandato_ids.length > 0) {
        const acompanhantes = data.acompanha_mandato_ids.map(userId => ({
          agenda_id: agenda.id,
          usuario_id: userId,
        }));

        const { error: acompanhantesError } = await supabase
          .from("agenda_acompanhantes")
          .insert(acompanhantes);

        if (acompanhantesError) throw acompanhantesError;
      }

      // Criar notificação para o validador
      await supabase
        .from("notificacoes")
        .insert({
          destinatario_id: data.validador_id,
          remetente_id: user.id,
          tipo: "agenda_solicitada",
          titulo: "Nova solicitação de agenda",
          mensagem: `Nova solicitação de agenda: ${data.descricao_objetivo}`,
          url_destino: "/solicitar-agenda",
        });

      // Criar notificações para os acompanhantes
      if (data.acompanha_mandato_ids.length > 0) {
        const notificacoesAcompanhantes = data.acompanha_mandato_ids.map(userId => ({
          destinatario_id: userId,
          remetente_id: user.id,
          tipo: "agenda_solicitada",
          titulo: "Você foi adicionado em uma solicitação de agenda",
          mensagem: `Você foi adicionado como acompanhante em: ${data.descricao_objetivo}`,
          url_destino: "/solicitar-agenda",
        }));

        await supabase
          .from("notificacoes")
          .insert(notificacoesAcompanhantes);
      }

      toast({
        title: "Solicitação de agenda enviada!",
        description: "Sua solicitação foi registrada com sucesso.",
      });

      form.reset({
        acompanha_mandato_ids: [],
        material_apoio: "",
        observacoes: "",
      });

      // Atualizar as queries
      queryClient.invalidateQueries({ queryKey: ["minhas-agendas"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-agendas"] });
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao enviar a solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Buscar minhas agendas (onde sou solicitante ou acompanhante)
  const { data: minhasAgendas, isLoading: loadingMinhasAgendas } = useQuery({
    queryKey: ["minhas-agendas"],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("agendas")
        .select(`
          *,
          solicitante:profiles!agendas_solicitante_id_fkey(nome),
          validador:profiles!agendas_validador_id_fkey(nome),
          agenda_acompanhantes(
            usuario_id,
            profiles(nome)
          )
        `)
        .or(`solicitante_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && activeTab === "minhas",
  });

  // Buscar solicitações para validar (onde sou validador)
  const { data: solicitacoesAgendas, isLoading: loadingSolicitacoes } = useQuery({
    queryKey: ["solicitacoes-agendas"],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("agendas")
        .select(`
          *,
          solicitante:profiles!agendas_solicitante_id_fkey(nome),
          validador:profiles!agendas_validador_id_fkey(nome),
          agenda_acompanhantes(
            usuario_id,
            profiles(nome)
          )
        `)
        .eq("validador_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && activeTab === "solicitacoes",
  });

  // Buscar mensagens de uma agenda
  const { data: mensagens, isLoading: loadingMensagens } = useQuery({
    queryKey: ["agenda-mensagens", selectedAgenda?.id],
    queryFn: async () => {
      if (!selectedAgenda?.id) return [];

      const { data, error } = await supabase
        .from("agenda_mensagens")
        .select(`
          *,
          remetente:profiles!agenda_mensagens_remetente_id_fkey(nome)
        `)
        .eq("agenda_id", selectedAgenda.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedAgenda?.id,
  });

  // Mutation para atualizar status da agenda
  const updateStatusMutation = useMutation({
    mutationFn: async ({ agendaId, status }: { agendaId: string; status: string }) => {
      const { error } = await supabase
        .from("agendas")
        .update({ status })
        .eq("id", agendaId);

      if (error) throw error;

      // Buscar dados da agenda para criar notificações
      const { data: agenda } = await supabase
        .from("agendas")
        .select(`
          *,
          agenda_acompanhantes(usuario_id)
        `)
        .eq("id", agendaId)
        .single();

      if (agenda) {
        // Notificar solicitante
        await supabase
          .from("notificacoes")
          .insert({
            destinatario_id: agenda.solicitante_id,
            remetente_id: user!.id,
            tipo: "agenda_status",
            titulo: "Status da agenda atualizado",
            mensagem: `Sua solicitação de agenda foi ${status === 'confirmado' ? 'confirmada' : status === 'recusado' ? 'recusada' : 'marcada para remarcar'}`,
            url_destino: "/solicitar-agenda",
          });

        // Notificar acompanhantes
        if (agenda.agenda_acompanhantes.length > 0) {
          const notificacoesAcompanhantes = agenda.agenda_acompanhantes.map((acompanhante: any) => ({
            destinatario_id: acompanhante.usuario_id,
            remetente_id: user!.id,
            tipo: "agenda_status",
            titulo: "Status da agenda atualizado",
            mensagem: `A agenda que você acompanha foi ${status === 'confirmado' ? 'confirmada' : status === 'recusado' ? 'recusada' : 'marcada para remarcar'}`,
            url_destino: "/solicitar-agenda",
          }));

          await supabase
            .from("notificacoes")
            .insert(notificacoesAcompanhantes);
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Status atualizado!",
        description: "O status da agenda foi atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-agendas"] });
      queryClient.invalidateQueries({ queryKey: ["minhas-agendas"] });
    },
    onError: (error) => {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da agenda.",
        variant: "destructive",
      });
    },
  });

  // Mutation para enviar mensagem
  const enviarMensagemMutation = useMutation({
    mutationFn: async ({ agendaId, mensagem }: { agendaId: string; mensagem: string }) => {
      const { error } = await supabase
        .from("agenda_mensagens")
        .insert({
          agenda_id: agendaId,
          remetente_id: user!.id,
          mensagem,
        });

      if (error) throw error;

      // Buscar dados da agenda para criar notificações
      const { data: agenda } = await supabase
        .from("agendas")
        .select(`
          *,
          agenda_acompanhantes(usuario_id)
        `)
        .eq("id", agendaId)
        .single();

      if (agenda) {
        const destinatarios = [];
        
        // Adicionar solicitante se não for o remetente
        if (agenda.solicitante_id !== user!.id) {
          destinatarios.push(agenda.solicitante_id);
        }
        
        // Adicionar validador se não for o remetente
        if (agenda.validador_id !== user!.id) {
          destinatarios.push(agenda.validador_id);
        }
        
        // Adicionar acompanhantes que não são o remetente
        agenda.agenda_acompanhantes.forEach((acompanhante: any) => {
          if (acompanhante.usuario_id !== user!.id) {
            destinatarios.push(acompanhante.usuario_id);
          }
        });

        // Criar notificações para todos os destinatários
        if (destinatarios.length > 0) {
          const notificacoes = destinatarios.map(destinatario => ({
            destinatario_id: destinatario,
            remetente_id: user!.id,
            tipo: "agenda_mensagem",
            titulo: "Nova mensagem na agenda",
            mensagem: `Nova mensagem: ${mensagem.substring(0, 50)}${mensagem.length > 50 ? '...' : ''}`,
            url_destino: "/solicitar-agenda",
          }));

          await supabase
            .from("notificacoes")
            .insert(notificacoes);
        }
      }
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["agenda-mensagens", selectedAgenda?.id] });
      toast({
        title: "Mensagem enviada!",
        description: "Sua mensagem foi enviada com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem.",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmado':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'recusado':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'remarcar':
        return <RotateCcw className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'Confirmado';
      case 'recusado':
        return 'Recusado';
      case 'remarcar':
        return 'Remarcar';
      default:
        return 'Pendente';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-green-100 text-green-800';
      case 'recusado':
        return 'bg-red-100 text-red-800';
      case 'remarcar':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Sistema de Agendas</h1>
        <p className="text-muted-foreground">
          Gerencie suas solicitações de agenda e reuniões.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="solicitar">Solicitar Agenda</TabsTrigger>
          <TabsTrigger value="minhas">Minhas Agendas</TabsTrigger>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
        </TabsList>

        <TabsContent value="solicitar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nova Solicitação de Agenda</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Solicitante */}
                    <FormField
                      control={form.control}
                      name="solicitante_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Solicitante *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o solicitante" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {loadingUsuarios ? (
                                <SelectItem value="loading" disabled>
                                  Carregando usuários...
                                </SelectItem>
                              ) : (
                                usuarios?.map((usuario) => (
                                  <SelectItem key={usuario.id} value={usuario.id}>
                                    {usuario.nome}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Validador */}
                    <FormField
                      control={form.control}
                      name="validador_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Validador(a) *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o validador" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {loadingUsuarios ? (
                                <SelectItem value="loading" disabled>
                                  Carregando usuários...
                                </SelectItem>
                              ) : (
                                usuarios?.map((usuario) => (
                                  <SelectItem key={usuario.id} value={usuario.id}>
                                    {usuario.nome}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Data do Pedido - Não editável */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none">Data do Pedido</label>
                      <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                        {dataPedido}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Data/Hora Proposta */}
                    <FormField
                      control={form.control}
                      name="data_hora_proposta"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data/Hora Proposta para Reunião *</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Duração Prevista */}
                    <FormField
                      control={form.control}
                      name="duracao_prevista"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duração Prevista *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: 1 hora, 2h30min, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Quem Acompanha pelo Mandato - Múltipla seleção */}
                    <FormField
                      control={form.control}
                      name="acompanha_mandato_ids"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Quem Acompanha pelo Mandato *</FormLabel>
                          <div className="space-y-2">
                            <Select 
                              onValueChange={(value) => {
                                if (value && !field.value.includes(value)) {
                                  field.onChange([...field.value, value]);
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione os responsáveis" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {loadingUsuarios ? (
                                  <SelectItem value="loading" disabled>
                                    Carregando usuários...
                                  </SelectItem>
                                ) : (
                                  usuarios?.filter(usuario => !field.value.includes(usuario.id)).map((usuario) => (
                                    <SelectItem key={usuario.id} value={usuario.id}>
                                      {usuario.nome}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            
                            {/* Lista de usuários selecionados */}
                            {field.value.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {field.value.map((userId) => {
                                  const usuario = usuarios?.find(u => u.id === userId);
                                  return usuario ? (
                                    <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                                      {usuario.nome}
                                      <X 
                                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                                        onClick={() => {
                                          field.onChange(field.value.filter(id => id !== userId));
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
                  </div>

                  {/* Participantes */}
                  <FormField
                    control={form.control}
                    name="participantes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Participantes Confirmados/Convidados *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Liste os participantes confirmados e convidados..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Local/Endereço */}
                  <FormField
                    control={form.control}
                    name="local_endereco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Local / Endereço / Link de Reunião *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Informe o local, endereço ou link para reunião online..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Descrição/Objetivo */}
                  <FormField
                    control={form.control}
                    name="descricao_objetivo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição / Objetivo da Reunião *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva o objetivo e contexto da reunião..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Pauta Sugerida */}
                  <FormField
                    control={form.control}
                    name="pauta_sugerida"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pauta Sugerida *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Lista dos tópicos a serem abordados na reunião..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Material de Apoio */}
                  <FormField
                    control={form.control}
                    name="material_apoio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material de Apoio Necessário</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Informe os materiais necessários para a reunião (opcional)..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Observações */}
                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações / Informações Adicionais</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Informações adicionais relevantes (opcional)..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        form.reset({
                          acompanha_mandato_ids: [],
                          material_apoio: "",
                          observacoes: "",
                        });
                      }}
                    >
                      Limpar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="minhas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Minhas Agendas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Agendas que você solicitou ou acompanha pelo mandato
              </p>
            </CardHeader>
            <CardContent>
              {loadingMinhasAgendas ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : minhasAgendas && minhasAgendas.length > 0 ? (
                <div className="space-y-4">
                  {minhasAgendas.map((agenda: any) => (
                    <Card key={agenda.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedAgenda(agenda)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{agenda.descricao_objetivo}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDateTime(agenda.data_hora_proposta)} - {agenda.duracao_prevista}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Validador: {agenda.validador?.nome}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(agenda.status)}
                            <Badge className={getStatusColor(agenda.status)}>
                              {getStatusLabel(agenda.status)}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma agenda encontrada.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="solicitacoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações para Validar</CardTitle>
              <p className="text-sm text-muted-foreground">
                Agendas enviadas para sua validação
              </p>
            </CardHeader>
            <CardContent>
              {loadingSolicitacoes ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : solicitacoesAgendas && solicitacoesAgendas.length > 0 ? (
                <div className="space-y-4">
                  {solicitacoesAgendas.map((agenda: any) => (
                    <Card key={agenda.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedAgenda(agenda)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{agenda.descricao_objetivo}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDateTime(agenda.data_hora_proposta)} - {agenda.duracao_prevista}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Solicitante: {agenda.solicitante?.nome}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(agenda.status)}
                            <Badge className={getStatusColor(agenda.status)}>
                              {getStatusLabel(agenda.status)}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma solicitação encontrada.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de detalhes da agenda */}
      {selectedAgenda && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{selectedAgenda.descricao_objetivo}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedAgenda(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Informações da Reunião</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Data/Hora:</span> {formatDateTime(selectedAgenda.data_hora_proposta)}</p>
                    <p><span className="font-medium">Duração:</span> {selectedAgenda.duracao_prevista}</p>
                    <p><span className="font-medium">Local:</span> {selectedAgenda.local_endereco}</p>
                    <p><span className="font-medium">Solicitante:</span> {selectedAgenda.solicitante?.nome}</p>
                    <p><span className="font-medium">Validador:</span> {selectedAgenda.validador?.nome}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Status</h4>
                  <div className="flex items-center gap-2 mb-4">
                    {getStatusIcon(selectedAgenda.status)}
                    <Badge className={getStatusColor(selectedAgenda.status)}>
                      {getStatusLabel(selectedAgenda.status)}
                    </Badge>
                  </div>
                  
                  {/* Botões de ação para validador */}
                  {user?.id === selectedAgenda.validador_id && (
                    <div className="space-y-2">
                      <Button 
                        size="sm" 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => updateStatusMutation.mutate({ agendaId: selectedAgenda.id, status: 'confirmado' })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirmar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="w-full"
                        onClick={() => updateStatusMutation.mutate({ agendaId: selectedAgenda.id, status: 'recusado' })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Recusar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                        onClick={() => updateStatusMutation.mutate({ agendaId: selectedAgenda.id, status: 'remarcar' })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Remarcar
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Participantes</h4>
                <p className="text-sm">{selectedAgenda.participantes}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Pauta</h4>
                <p className="text-sm">{selectedAgenda.pauta_sugerida}</p>
              </div>

              {selectedAgenda.material_apoio && (
                <div>
                  <h4 className="font-semibold mb-2">Material de Apoio</h4>
                  <p className="text-sm">{selectedAgenda.material_apoio}</p>
                </div>
              )}

              {selectedAgenda.observacoes && (
                <div>
                  <h4 className="font-semibold mb-2">Observações</h4>
                  <p className="text-sm">{selectedAgenda.observacoes}</p>
                </div>
              )}

              <Separator />

              {/* Chat */}
              <div>
                <h4 className="font-semibold mb-4">Mensagens</h4>
                <div className="border rounded-lg p-4 space-y-4">
                  <ScrollArea className="h-64">
                    {loadingMensagens ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : mensagens && mensagens.length > 0 ? (
                      <div className="space-y-3">
                        {mensagens.map((mensagem: any) => (
                          <div key={mensagem.id} className={cn(
                            "flex",
                            mensagem.remetente_id === user?.id ? "justify-end" : "justify-start"
                          )}>
                            <div className={cn(
                              "max-w-[70%] rounded-lg p-3",
                              mensagem.remetente_id === user?.id 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-muted"
                            )}>
                              <p className="text-sm">{mensagem.mensagem}</p>
                              <p className="text-xs opacity-70 mt-1">
                                {mensagem.remetente?.nome} - {formatDateTime(mensagem.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground">Nenhuma mensagem ainda.</p>
                    )}
                  </ScrollArea>
                  
                  {/* Input para nova mensagem */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newMessage.trim()) {
                          enviarMensagemMutation.mutate({
                            agendaId: selectedAgenda.id,
                            mensagem: newMessage.trim(),
                          });
                        }
                      }}
                    />
                    <Button 
                      size="sm"
                      onClick={() => {
                        if (newMessage.trim()) {
                          enviarMensagemMutation.mutate({
                            agendaId: selectedAgenda.id,
                            mensagem: newMessage.trim(),
                          });
                        }
                      }}
                      disabled={!newMessage.trim() || enviarMensagemMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SolicitarAgenda;