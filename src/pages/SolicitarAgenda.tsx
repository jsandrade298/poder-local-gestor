import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Clock, CheckCircle, XCircle, RotateCcw, MessageCircle, Edit, Calendar, MapPin, Users, FileText, User, Clock4, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();

  // Função para fazer scroll para o final das mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };


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
        // Buscar agendas onde sou solicitante (não mais validador)
        const { data: agendas, error } = await supabase
          .from("agendas")
          .select(`
            *,
            agenda_acompanhantes(
              usuario_id
            )
          `)
          .eq("solicitante_id", user.id)
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
        },
        agenda_acompanhantes: agenda.agenda_acompanhantes?.map((a: any) => ({
          ...a,
          nome: userMap.get(a.usuario_id) || "Usuário"
        })) || []
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
        },
        agenda_acompanhantes: agenda.agenda_acompanhantes?.map((a: any) => ({
          ...a,
          nome: userMap.get(a.usuario_id) || "Usuário"
        })) || []
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

  // Auto-scroll quando mensagens mudam ou quando uma nova mensagem é enviada
  useEffect(() => {
    if (mensagens && mensagens.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [mensagens]);

  // Auto-scroll quando abre o modal E quando muda para aba mensagens
  useEffect(() => {
    if (selectedAgenda && mensagens && mensagens.length > 0) {
      // Aguarda a renderização completa da aba mensagens
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [selectedAgenda, mensagens]);

  // Buscar detalhes completos da agenda selecionada incluindo acompanhantes
  const { data: agendaDetalhada } = useQuery({
    queryKey: ["agenda-detalhada", selectedAgenda?.id],
    queryFn: async () => {
      if (!selectedAgenda?.id) return null;

      try {
        // Buscar todos os IDs dos acompanhantes
        const { data: acompanhantes, error: errorAcomp } = await supabase
          .from("agenda_acompanhantes")
          .select("usuario_id")
          .eq("agenda_id", selectedAgenda.id);

        if (errorAcomp) {
          console.error("Erro ao buscar acompanhantes:", errorAcomp);
          return { ...selectedAgenda, acompanhantes_nomes: [] };
        }

        if (!acompanhantes || acompanhantes.length === 0) {
          return { ...selectedAgenda, acompanhantes_nomes: [] };
        }

        // Buscar nomes dos acompanhantes
        const userIds = acompanhantes.map(a => a.usuario_id);
        const { data: usuarios, error: errorUsers } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);

        if (errorUsers) {
          console.error("Erro ao buscar usuários:", errorUsers);
          return { ...selectedAgenda, acompanhantes_nomes: [] };
        }

        const acompanhantesComNome = usuarios?.map(user => ({
          id: user.id,
          nome: user.nome
        })) || [];

        return {
          ...selectedAgenda,
          acompanhantes_nomes: acompanhantesComNome
        };
      } catch (error) {
        console.error("Erro geral ao buscar detalhes:", error);
        return { ...selectedAgenda, acompanhantes_nomes: [] };
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
      queryClient.invalidateQueries({ queryKey: ["agenda-detalhada"] });
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

  // Excluir agenda
  const excluirAgendaMutation = useMutation({
    mutationFn: async (agendaId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      // Primeiro, excluir mensagens relacionadas
      const { error: mensagensError } = await supabase
        .from("agenda_mensagens")
        .delete()
        .eq("agenda_id", agendaId);

      if (mensagensError) throw mensagensError;

      // Excluir acompanhantes
      const { error: acompanhantesError } = await supabase
        .from("agenda_acompanhantes")
        .delete()
        .eq("agenda_id", agendaId);

      if (acompanhantesError) throw acompanhantesError;

      // Finalmente, excluir a agenda
      const { error } = await supabase
        .from("agendas")
        .delete()
        .eq("id", agendaId)
        .eq("validador_id", user.id); // Só pode excluir se for o validador

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-agenda"] });
      toast({ title: "Solicitação excluída com sucesso!" });
      setSelectedAgenda(null); // Fechar modal se estiver aberto
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Erro ao excluir solicitação",
        description: "Verifique se você tem permissão para excluir esta agenda.",
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

  // Lógica para abrir agenda específica via parâmetros de URL (notificações)
  useEffect(() => {
    const agendaId = searchParams.get('agenda');
    
    if (agendaId) {
      // Buscar nas minhas agendas primeiro
      let agenda = minhasAgendas?.find(a => a.id === agendaId);
      
      // Se não encontrou, buscar nas solicitações
      if (!agenda) {
        agenda = solicitacoes?.find(a => a.id === agendaId);
      }
      
      if (agenda) {
        setSelectedAgenda(agenda);
        
        // Limpar o parâmetro da URL após abrir
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams, minhasAgendas, solicitacoes]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pendente: { variant: "secondary" as const, className: "" },
      confirmado: { variant: "default" as const, className: "" },
      recusado: { variant: "destructive" as const, className: "" },
      remarcar: { variant: "default" as const, className: "bg-yellow-500 text-white hover:bg-yellow-600" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: "secondary" as const, className: "" };

    return (
      <Badge 
        variant={config.variant}
        className={config.className}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getStatusBorderClass = (status: string) => {
    switch (status) {
      case 'pendente':
        return 'border-l-gray-400/50 hover:border-l-gray-400';
      case 'confirmado':
        return 'border-l-blue-500/50 hover:border-l-blue-500';
      case 'recusado':
        return 'border-l-red-500/50 hover:border-l-red-500';
      case 'remarcar':
        return 'border-l-yellow-500/50 hover:border-l-yellow-500';
      default:
        return 'border-l-primary/30 hover:border-l-primary';
    }
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
              variant="outline"
              className="border-blue-500 text-blue-500 hover:bg-blue-50 hover:text-blue-600"
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
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600"
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
              className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700"
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
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
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Minhas Agendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMinhas ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2 text-muted-foreground">Carregando agendas...</span>
                </div>
              ) : minhasAgendas && minhasAgendas.length > 0 ? (
                <div className="space-y-3">
                  {minhasAgendas.map(agenda => (
                    <Card 
                      key={agenda.id} 
                      className={cn(
                        "cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-l-4 bg-card/60 backdrop-blur",
                        getStatusBorderClass(agenda.status)
                      )}
                      onClick={() => setSelectedAgenda(agenda)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 space-y-2">
                            <h3 className="font-semibold text-base line-clamp-2 leading-tight">{agenda.descricao_objetivo}</h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {formatDateTime(agenda.data_hora_proposta)}
                              </div>
                              <div className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                Validador: {agenda.validador?.nome}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(agenda.status)}
                            <div className="text-xs text-muted-foreground">
                              {formatDateTime(agenda.created_at)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma agenda encontrada</h3>
                  <p className="text-sm text-center">
                    Você ainda não possui agendas cadastradas.
                    <br />
                    Clique em "Solicitar" para criar uma nova agenda.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Solicitações */}
        <TabsContent value="solicitacoes">
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Clock4 className="h-5 w-5" />
                Solicitações para Validar
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSolicitacoes ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2 text-muted-foreground">Carregando solicitações...</span>
                </div>
              ) : solicitacoes && solicitacoes.length > 0 ? (
                <div className="space-y-3">
                  {solicitacoes.map(agenda => (
                     <Card 
                       key={agenda.id}
                       className={cn(
                         "hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-l-4 bg-card/60 backdrop-blur",
                         getStatusBorderClass(agenda.status)
                       )}
                     >
                      <CardContent className="p-4">
                         <div className="flex justify-between items-start gap-4">
                           <div 
                             className="flex-1 space-y-2 cursor-pointer"
                             onClick={() => setSelectedAgenda(agenda)}
                           >
                             <h3 className="font-semibold text-base line-clamp-2 leading-tight">{agenda.descricao_objetivo}</h3>
                             <div className="flex items-center gap-4 text-sm text-muted-foreground">
                               <div className="flex items-center gap-1">
                                 <Calendar className="h-4 w-4" />
                                 {formatDateTime(agenda.data_hora_proposta)}
                               </div>
                               <div className="flex items-center gap-1">
                                 <User className="h-4 w-4" />
                                 Solicitante: {agenda.solicitante?.nome}
                               </div>
                             </div>
                           </div>
                           <div className="flex flex-col items-end gap-2">
                             <div className="flex items-center gap-2">
                               {getStatusBadge(agenda.status)}
                               <AlertDialog>
                                 <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                                      disabled={excluirAgendaMutation.isPending}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                 </AlertDialogTrigger>
                                 <AlertDialogContent>
                                   <AlertDialogHeader>
                                     <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                     <AlertDialogDescription>
                                       Tem certeza que deseja excluir a solicitação "{agenda.descricao_objetivo}"? Esta ação não pode ser desfeita e todos os dados relacionados (mensagens, acompanhantes) serão perdidos.
                                     </AlertDialogDescription>
                                   </AlertDialogHeader>
                                   <AlertDialogFooter>
                                     <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                     <AlertDialogAction 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         excluirAgendaMutation.mutate(agenda.id);
                                       }}
                                       className="bg-destructive hover:bg-destructive/90"
                                     >
                                       Excluir
                                     </AlertDialogAction>
                                   </AlertDialogFooter>
                                 </AlertDialogContent>
                               </AlertDialog>
                             </div>
                             <div className="text-xs text-muted-foreground">
                               {formatDateTime(agenda.created_at)}
                             </div>
                           </div>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock4 className="h-12 w-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma solicitação pendente</h3>
                  <p className="text-sm text-center">
                    Não há agendas aguardando sua validação no momento.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

        {/* Modal de Agenda com Tabs */}
        <Dialog open={!!selectedAgenda} onOpenChange={() => setSelectedAgenda(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Agenda - {selectedAgenda?.descricao_objetivo}
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="detalhes" className="flex-1 overflow-hidden" onValueChange={(value) => {
              // Quando trocar para aba mensagens, fazer scroll para o final
              if (value === "mensagens" && mensagens && mensagens.length > 0) {
                setTimeout(scrollToBottom, 100);
              }
            }}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="participantes">Participantes</TabsTrigger>
                <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
              </TabsList>

              <TabsContent value="detalhes" className="space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{selectedAgenda?.descricao_objetivo}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Local/Endereço</h4>
                      <p className="text-muted-foreground">{selectedAgenda?.local_endereco}</p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Objetivo/Descrição</h4>
                      <p className="text-muted-foreground whitespace-pre-wrap">{selectedAgenda?.descricao_objetivo}</p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Pauta Sugerida</h4>
                      <p className="text-muted-foreground whitespace-pre-wrap">{selectedAgenda?.pauta_sugerida}</p>
                    </div>

                    {selectedAgenda?.material_apoio && (
                      <div>
                        <h4 className="font-medium mb-2">Material de Apoio</h4>
                        <p className="text-muted-foreground whitespace-pre-wrap">{selectedAgenda.material_apoio}</p>
                      </div>
                    )}

                    {selectedAgenda?.observacoes && (
                      <div>
                        <h4 className="font-medium mb-2">Observações</h4>
                        <p className="text-muted-foreground whitespace-pre-wrap">{selectedAgenda.observacoes}</p>
                      </div>
                    )}

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="flex items-center gap-2">
                         <Calendar className="h-4 w-4 text-muted-foreground" />
                         <span className="text-sm">
                           <strong>Data/Hora Sugerida:</strong> {formatDateTime(selectedAgenda?.data_hora_proposta)}
                         </span>
                       </div>

                       <div className="flex items-center gap-2">
                         <Clock className="h-4 w-4 text-muted-foreground" />
                         <span className="text-sm">
                           <strong>Duração Prevista:</strong> {selectedAgenda?.duracao_prevista}
                         </span>
                       </div>

                       <div className="flex items-center gap-2">
                         <Calendar className="h-4 w-4 text-muted-foreground" />
                         <span className="text-sm">
                           <strong>Solicitado em:</strong> {formatDateTime(selectedAgenda?.data_pedido)}
                         </span>
                       </div>
                      </div>

                      {/* Seção de Status e Ações */}
                      <Separator />
                      <div className="bg-muted/20 p-4 rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Edit className="h-4 w-4" />
                          Status da Agenda
                        </h4>
                        <StatusBox
                          currentStatus={selectedAgenda?.status || ""}
                          canUpdate={user?.id === selectedAgenda?.validador_id}
                          onUpdateStatus={(status) => {
                            // Atualizar o estado local imediatamente para refletir no modal
                            if (selectedAgenda) {
                              setSelectedAgenda({ 
                                ...selectedAgenda, 
                                status: status as any 
                              });
                            }
                            updateStatusMutation.mutate({
                              agendaId: selectedAgenda?.id,
                              status
                            });
                          }}
                        />
                      </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="participantes" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Participantes da Agenda
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            <strong>Solicitante:</strong> {selectedAgenda?.solicitante?.nome}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            <strong>Validador:</strong> {selectedAgenda?.validador?.nome}
                          </span>
                        </div>
                      </div>
                    </div>

                    {agendaDetalhada?.acompanhantes_nomes && agendaDetalhada.acompanhantes_nomes.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Acompanhantes do Mandato</h4>
                        <div className="flex flex-wrap gap-2">
                          {agendaDetalhada.acompanhantes_nomes.map((acomp: any, index: number) => (
                            <Badge key={index} variant="secondary">
                              {acomp.nome}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-medium mb-2">Todos os Participantes</h4>
                      <p className="text-muted-foreground">{selectedAgenda?.participantes}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="mensagens" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Mensagens da Agenda
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                     <ScrollArea className="h-64 border rounded-lg p-3 mb-4">
                       {mensagens && mensagens.length > 0 ? (
                         <div>
                           {mensagens.map(msg => (
                             <div
                               key={msg.id}
                               className={cn(
                                 "mb-3 p-3 rounded-lg max-w-[80%]",
                                 msg.remetente_id === user?.id
                                   ? "ml-auto bg-primary text-primary-foreground"
                                   : "bg-muted"
                               )}
                             >
                               <p className="text-xs font-semibold mb-1">
                                 {msg.remetente?.nome}
                               </p>
                               <p className="text-sm">{msg.mensagem}</p>
                               <p className="text-xs opacity-70 mt-1">
                                 {formatDateTime(msg.created_at)}
                               </p>
                             </div>
                           ))}
                           <div ref={messagesEndRef} />
                         </div>
                       ) : (
                         <div className="text-center text-muted-foreground py-8">
                           <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                           <p className="text-sm">Nenhuma mensagem ainda</p>
                         </div>
                       )}
                     </ScrollArea>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite sua mensagem..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newMessage.trim()) {
                            enviarMensagemMutation.mutate({
                              agendaId: selectedAgenda?.id,
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
                              agendaId: selectedAgenda?.id,
                              mensagem: newMessage.trim()
                            });
                          }
                        }}
                        disabled={!newMessage.trim() || enviarMensagemMutation.isPending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SolicitarAgenda;