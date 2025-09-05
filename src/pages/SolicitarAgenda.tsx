import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Clock, CheckCircle, XCircle, RotateCcw, MessageCircle, Edit } from "lucide-react";
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
  validador_id: z.string().min(1, "Selecione um validador"),
  data_hora_proposta: z.string().min(1, "Data e hora são obrigatórias"),
  duracao_prevista: z.string().min(1, "Informe a duração prevista"),
  participantes: z.string().min(1, "Informe os participantes"),
  local_endereco: z.string().min(1, "Informe o local ou link"),
  descricao_objetivo: z.string().min(1, "Descreva o objetivo"),
  pauta_sugerida: z.string().min(1, "Informe a pauta"),
  acompanha_mandato_ids: z.array(z.string()).min(1, "Selecione pelo menos um acompanhante"),
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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

  // Enviar solicitação
  const onSubmit = async (data: FormData) => {
    if (!user?.id) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Criar agenda
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

      // Adicionar acompanhantes
      if (data.acompanha_mandato_ids.length > 0) {
        const acompanhantes = data.acompanha_mandato_ids.map(userId => ({
          agenda_id: agenda.id,
          usuario_id: userId,
        }));

        const { error: acompError } = await supabase
          .from("agenda_acompanhantes")
          .insert(acompanhantes);

        if (acompError) throw acompError;
      }

      // Criar notificação para validador
      await supabase.from("notificacoes").insert({
        destinatario_id: data.validador_id,
        remetente_id: user.id,
        tipo: "agenda_solicitada",
        titulo: "Nova solicitação de agenda",
        mensagem: `Nova agenda: ${data.descricao_objetivo}`,
        url_destino: "/solicitar-agenda",
      });

      // Notificar acompanhantes
      if (data.acompanha_mandato_ids.length > 0) {
        const notifAcompanhantes = data.acompanha_mandato_ids.map(userId => ({
          destinatario_id: userId,
          remetente_id: user.id,
          tipo: "agenda_acompanhante",
          titulo: "Você foi adicionado em uma agenda",
          mensagem: `Agenda: ${data.descricao_objetivo}`,
          url_destino: "/solicitar-agenda",
        }));

        await supabase.from("notificacoes").insert(notifAcompanhantes);
      }

      toast({
        title: "✅ Solicitação enviada!",
        description: "Sua agenda foi registrada com sucesso",
      });

      form.reset();
      queryClient.invalidateQueries({ queryKey: ["minhas-agendas"] });
    } catch (error) {
      console.error("Erro:", error);
      toast({
        title: "Erro ao enviar",
        description: "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Buscar minhas agendas - CORRIGIDO
  const { data: minhasAgendas, isLoading: loadingMinhas } = useQuery({
    queryKey: ["minhas-agendas", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      try {
        // Buscar agendas onde sou solicitante ou validador
        const { data: agendas, error } = await supabase
          .from("agendas")
          .select(`
            *,
            agenda_acompanhantes(
              usuario_id
            )
          `)
          .or(`solicitante_id.eq.${user.id},validador_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao buscar agendas diretas:", error);
        }

        // Buscar agendas onde sou acompanhante
        const { data: acompanhamentos, error: errorAcomp } = await supabase
          .from("agenda_acompanhantes")
          .select(`
            agenda_id,
            agendas(*)
          `)
          .eq("usuario_id", user.id);

        if (errorAcomp) {
          console.error("Erro ao buscar acompanhamentos:", errorAcomp);
        }

        // Combinar resultados
        const todasAgendas = [...(agendas || [])];
        
        if (acompanhamentos) {
          acompanhamentos.forEach((item: any) => {
            if (item.agendas && !todasAgendas.find(a => a.id === item.agendas.id)) {
              todasAgendas.push({
                ...item.agendas,
                agenda_acompanhantes: []
              });
            }
          });
        }

        // Buscar nomes dos usuários separadamente
        const userIds = new Set<string>();
        todasAgendas.forEach(agenda => {
          userIds.add(agenda.solicitante_id);
          userIds.add(agenda.validador_id);
          agenda.agenda_acompanhantes?.forEach((a: any) => userIds.add(a.usuario_id));
        });

        const { data: usuarios } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", Array.from(userIds));

        const userMap = new Map(usuarios?.map(u => [u.id, u.nome]) || []);

        // Adicionar nomes aos resultados
        return todasAgendas.map(agenda => ({
          ...agenda,
          solicitante: { 
            id: agenda.solicitante_id, 
            nome: userMap.get(agenda.solicitante_id) || "Usuário"
          },
          validador: { 
            id: agenda.validador_id, 
            nome: userMap.get(agenda.validador_id) || "Usuário"
          }
        }));
      } catch (error) {
        console.error("Erro geral ao buscar agendas:", error);
        return [];
      }
    },
    enabled: !!user?.id && activeTab === "minhas",
  });

  // Buscar solicitações para validar - CORRIGIDO
  const { data: solicitacoes, isLoading: loadingSolicitacoes } = useQuery({
    queryKey: ["solicitacoes-agenda", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      try {
        // Buscar agendas onde sou validador
        const { data: agendas, error } = await supabase
          .from("agendas")
          .select(`
            *,
            agenda_acompanhantes(
              usuario_id
            )
          `)
          .eq("validador_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao buscar solicitações:", error);
          return [];
        }

        // Buscar nomes dos usuários
        const userIds = new Set<string>();
        (agendas || []).forEach(agenda => {
          userIds.add(agenda.solicitante_id);
          userIds.add(agenda.validador_id);
          agenda.agenda_acompanhantes?.forEach((a: any) => userIds.add(a.usuario_id));
        });

        const { data: usuarios } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", Array.from(userIds));

        const userMap = new Map(usuarios?.map(u => [u.id, u.nome]) || []);

        // Adicionar nomes aos resultados
        return (agendas || []).map(agenda => ({
          ...agenda,
          solicitante: { 
            id: agenda.solicitante_id, 
            nome: userMap.get(agenda.solicitante_id) || "Usuário"
          },
          validador: { 
            id: agenda.validador_id, 
            nome: userMap.get(agenda.validador_id) || "Usuário"
          }
        }));
      } catch (error) {
        console.error("Erro geral ao buscar solicitações:", error);
        return [];
      }
    },
    enabled: !!user?.id && activeTab === "solicitacoes",
  });

  // Buscar mensagens - CORRIGIDO
  const { data: mensagens } = useQuery({
    queryKey: ["agenda-mensagens", selectedAgenda?.id],
    queryFn: async () => {
      if (!selectedAgenda?.id) return [];

      try {
        const { data: msgs, error } = await supabase
          .from("agenda_mensagens")
          .select("*")
          .eq("agenda_id", selectedAgenda.id)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Erro ao buscar mensagens:", error);
          return [];
        }

        // Buscar nomes dos remetentes
        const userIds = [...new Set(msgs?.map(m => m.remetente_id) || [])];
        
        const { data: usuarios } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);

        const userMap = new Map(usuarios?.map(u => [u.id, u.nome]) || []);

        // Adicionar nomes às mensagens
        return (msgs || []).map(msg => ({
          ...msg,
          remetente: {
            id: msg.remetente_id,
            nome: userMap.get(msg.remetente_id) || "Usuário"
          }
        }));
      } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
        return [];
      }
    },
    enabled: !!selectedAgenda?.id,
  });

  // Atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ agendaId, status }: { agendaId: string; status: string }) => {
      const { error } = await supabase
        .from("agendas")
        .update({ status })
        .eq("id", agendaId);

      if (error) throw error;

      // Buscar agenda para notificar
      const { data: agenda } = await supabase
        .from("agendas")
        .select(`
          *,
          agenda_acompanhantes(usuario_id)
        `)
        .eq("id", agendaId)
        .single();

      if (agenda && user?.id) {
        // Notificar solicitante
        if (agenda.solicitante_id !== user.id) {
          await supabase.from("notificacoes").insert({
            destinatario_id: agenda.solicitante_id,
            remetente_id: user.id,
            tipo: "agenda_status",
            titulo: "Status da agenda atualizado",
            mensagem: `Sua agenda foi ${status}`,
            url_destino: "/solicitar-agenda",
          });
        }

        // Notificar acompanhantes
        const notifs = agenda.agenda_acompanhantes
          .filter((a: any) => a.usuario_id !== user.id)
          .map((a: any) => ({
            destinatario_id: a.usuario_id,
            remetente_id: user.id,
            tipo: "agenda_status",
            titulo: "Status da agenda atualizado",
            mensagem: `Agenda foi ${status}`,
            url_destino: "/solicitar-agenda",
          }));

        if (notifs.length > 0) {
          await supabase.from("notificacoes").insert(notifs);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Status atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["minhas-agendas"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-agenda"] });
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Erro ao atualizar status",
        variant: "destructive",
      });
    },
  });

  // Enviar mensagem
  const enviarMensagemMutation = useMutation({
    mutationFn: async ({ agendaId, mensagem }: { agendaId: string; mensagem: string }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("agenda_mensagens")
        .insert({
          agenda_id: agendaId,
          remetente_id: user.id,
          mensagem,
        });

      if (error) throw error;

      // Buscar participantes para notificar
      const { data: agenda } = await supabase
        .from("agendas")
        .select(`
          *,
          agenda_acompanhantes(usuario_id)
        `)
        .eq("id", agendaId)
        .single();

      if (agenda) {
        const destinatarios = new Set<string>();
        
        if (agenda.solicitante_id !== user.id) destinatarios.add(agenda.solicitante_id);
        if (agenda.validador_id !== user.id) destinatarios.add(agenda.validador_id);
        
        agenda.agenda_acompanhantes.forEach((a: any) => {
          if (a.usuario_id !== user.id) destinatarios.add(a.usuario_id);
        });

        const notifs = Array.from(destinatarios).map(dest => ({
          destinatario_id: dest,
          remetente_id: user.id,
          tipo: "agenda_mensagem",
          titulo: "Nova mensagem na agenda",
          mensagem: mensagem.substring(0, 100),
          url_destino: "/solicitar-agenda",
        }));

        if (notifs.length > 0) {
          await supabase.from("notificacoes").insert(notifs);
        }
      }
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["agenda-mensagens"] });
      toast({ title: "Mensagem enviada!" });
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Erro ao enviar mensagem",
        variant: "destructive",
      });
    },
  });

  // Logs de debug temporários
  useEffect(() => {
    if (minhasAgendas) {
      console.log("=== MINHAS AGENDAS ===");
      console.log("User ID atual:", user?.id);
      console.log("Total de agendas encontradas:", minhasAgendas.length);
      console.log("Agendas:", minhasAgendas);
    }
  }, [minhasAgendas, user?.id]);

  useEffect(() => {
    if (solicitacoes) {
      console.log("=== SOLICITAÇÕES ===");
      console.log("User ID atual:", user?.id);
      console.log("Total de solicitações:", solicitacoes.length);
      console.log("Solicitações:", solicitacoes);
    }
  }, [solicitacoes, user?.id]);

  const getStatusBadge = (status: string) => {
    const variants = {
      pendente: "secondary",
      confirmado: "default",
      recusado: "destructive",
      remarcar: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Component for status updater
  const StatusBox = ({ 
    currentStatus, 
    canUpdate, 
    onUpdateStatus 
  }: { 
    currentStatus: string; 
    canUpdate: boolean; 
    onUpdateStatus: (status: string) => void; 
  }) => {
    const [isEditing, setIsEditing] = useState(false);

    if (!canUpdate) {
      return getStatusBadge(currentStatus);
    }

    if (isEditing) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                onUpdateStatus('confirmado');
                setIsEditing(false);
              }}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                onUpdateStatus('recusado');
                setIsEditing(false);
              }}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Recusar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onUpdateStatus('remarcar');
                setIsEditing(false);
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Remarcar
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(false)}
          >
            Cancelar
          </Button>
        </div>
      );
    }

    return (
      <div 
        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
        onClick={() => setIsEditing(true)}
      >
        {getStatusBadge(currentStatus)}
        <Button size="sm" variant="outline">
          <Edit className="h-3 w-3 mr-1" />
          Atualizar
        </Button>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Sistema de Agendas</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="solicitar">Solicitar</TabsTrigger>
          <TabsTrigger value="minhas">Minhas Agendas</TabsTrigger>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
        </TabsList>

        {/* Tab Solicitar */}
        <TabsContent value="solicitar">
          <Card>
            <CardHeader>
              <CardTitle>Nova Solicitação de Agenda</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="validador_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Validador *</FormLabel>
                          <Select onValueChange={field.onChange}>
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
                                  <SelectValue placeholder="Adicionar acompanhante" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {usuarios
                                  ?.filter(u => !field.value.includes(u.id) && u.id !== user?.id)
                                  .map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                      {u.nome}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            
                            {field.value.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {field.value.map(id => {
                                  const usuario = usuarios?.find(u => u.id === id);
                                  return usuario ? (
                                    <Badge key={id} variant="secondary">
                                      {usuario.nome}
                                      <X
                                        className="h-3 w-3 ml-1 cursor-pointer"
                                        onClick={() => {
                                          field.onChange(field.value.filter(v => v !== id));
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
                              placeholder="Material necessário (opcional)..." 
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
                              placeholder="Informações adicionais (opcional)..." 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Minhas Agendas */}
        <TabsContent value="minhas">
          <Card>
            <CardHeader>
              <CardTitle>Minhas Agendas</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMinhas ? (
                <div>Carregando...</div>
              ) : (
                <div className="space-y-4">
                  {minhasAgendas?.map(agenda => (
                    <Card 
                      key={agenda.id} 
                      className="cursor-pointer hover:shadow-md"
                      onClick={() => setSelectedAgenda(agenda)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{agenda.descricao_objetivo}</h3>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(agenda.data_hora_proposta)}
                            </p>
                            <p className="text-sm">
                              Validador: {agenda.validador?.nome}
                            </p>
                          </div>
                          {getStatusBadge(agenda.status)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Solicitações */}
        <TabsContent value="solicitacoes">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações para Validar</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSolicitacoes ? (
                <div>Carregando...</div>
              ) : (
                <div className="space-y-4">
                  {solicitacoes?.map(agenda => (
                    <Card 
                      key={agenda.id}
                      className="cursor-pointer hover:shadow-md"
                      onClick={() => setSelectedAgenda(agenda)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{agenda.descricao_objetivo}</h3>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(agenda.data_hora_proposta)}
                            </p>
                            <p className="text-sm">
                              Solicitante: {agenda.solicitante?.nome}
                            </p>
                          </div>
                          {getStatusBadge(agenda.status)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Detalhes */}
      {selectedAgenda && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{selectedAgenda.descricao_objetivo}</CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedAgenda(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            
            <CardContent className="overflow-y-auto max-h-[70vh] space-y-4">
              {/* Detalhes da agenda */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Data/Hora</p>
                  <p className="text-sm">{formatDateTime(selectedAgenda.data_hora_proposta)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <StatusBox
                    currentStatus={selectedAgenda.status}
                    canUpdate={user?.id === selectedAgenda.validador_id}
                    onUpdateStatus={(status) => updateStatusMutation.mutate({
                      agendaId: selectedAgenda.id,
                      status
                    })}
                  />
                </div>
              </div>

              <Separator />

              {/* Informações completas */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Participantes</p>
                  <p className="text-sm">{selectedAgenda.participantes}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Local/Link</p>
                  <p className="text-sm">{selectedAgenda.local_endereco}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Pauta</p>
                  <p className="text-sm">{selectedAgenda.pauta_sugerida}</p>
                </div>
              </div>

              <Separator />

              {/* Chat */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Mensagens
                </h4>
                
                <ScrollArea className="h-48 border rounded-lg p-3">
                  {mensagens?.map(msg => (
                    <div
                      key={msg.id}
                      className={cn(
                        "mb-3 p-2 rounded-lg max-w-[80%]",
                        msg.remetente_id === user?.id
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-xs font-semibold">
                        {msg.remetente?.nome}
                      </p>
                      <p className="text-sm">{msg.mensagem}</p>
                      <p className="text-xs opacity-70">
                        {formatDateTime(msg.created_at)}
                      </p>
                    </div>
                  ))}
                </ScrollArea>

                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newMessage.trim()) {
                        enviarMensagemMutation.mutate({
                          agendaId: selectedAgenda.id,
                          mensagem: newMessage.trim()
                        });
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={() => {
                      if (newMessage.trim()) {
                        enviarMensagemMutation.mutate({
                          agendaId: selectedAgenda.id,
                          mensagem: newMessage.trim()
                        });
                      }
                    }}
                    disabled={!newMessage.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
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