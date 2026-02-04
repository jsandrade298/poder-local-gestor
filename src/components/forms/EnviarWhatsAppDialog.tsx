import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppSending } from "@/contexts/WhatsAppSendingContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, Send, Loader2, Upload, X, Image, Video, FileAudio, 
  FileText, AlertCircle, Users, Settings, Eye, CheckCircle2, 
  Clock, Shuffle, Heart, Plus, Search, UserCheck, Smartphone,
  BarChart3, ChevronRight, Sparkles, Info, ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RelatoriosWhatsAppDialog } from "./RelatoriosWhatsAppDialog";

interface EnviarWhatsAppDialogProps {
  municipesSelecionados?: string[];
}

interface MediaFile {
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
}

interface Municipe {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  bairro?: string;
}

// Variáveis disponíveis para substituição
const VARIAVEIS = [
  { codigo: "{nome}", descricao: "Nome completo", exemplo: "João da Silva" },
  { codigo: "{primeiro_nome}", descricao: "Primeiro nome", exemplo: "João" },
  { codigo: "{telefone}", descricao: "Telefone", exemplo: "(11) 99999-9999" },
  { codigo: "{email}", descricao: "E-mail", exemplo: "joao@email.com" },
  { codigo: "{bairro}", descricao: "Bairro", exemplo: "Centro" },
  { codigo: "{data}", descricao: "Data atual", exemplo: new Date().toLocaleDateString('pt-BR') },
  { codigo: "{hora}", descricao: "Hora atual", exemplo: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
];

// Emojis para reação automática
const EMOJIS_REACAO = ['❤️', '👍', '🙏', '😊', '✅', '🎉', '👏', '🤝', '💪', '🔥'];

// Ordem das abas
const TABS_ORDER = ['mensagem', 'destinatarios', 'config', 'preview'];

export function EnviarWhatsAppDialog({ municipesSelecionados = [] }: EnviarWhatsAppDialogProps) {
  // ========== ESTADOS ==========
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("mensagem");
  
  // Mensagem
  const [mensagem, setMensagem] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  
  // Destinatários
  const [incluirTodos, setIncluirTodos] = useState(false);
  const [selectedMunicipes, setSelectedMunicipes] = useState<string[]>(municipesSelecionados);
  const [searchMunicipe, setSearchMunicipe] = useState("");
  
  // Configurações
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [tempoMinimo, setTempoMinimo] = useState(3);
  const [tempoMaximo, setTempoMaximo] = useState(7);
  const [ordemAleatoria, setOrdemAleatoria] = useState(false);
  const [reacaoAutomatica, setReacaoAutomatica] = useState<string>("");
  
  // Relatórios
  const [showRelatorios, setShowRelatorios] = useState(false);
  const [lastEnvioId, setLastEnvioId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { startSending, updateRecipientStatus, updateCountdown, finishSending } = useWhatsAppSending();

  // Sincronizar munícipes selecionados
  useEffect(() => {
    setSelectedMunicipes(municipesSelecionados);
  }, [municipesSelecionados]);

  // ========== QUERIES ==========
  
  // Buscar munícipes
  const { data: municipes, isLoading: loadingMunicipes } = useQuery({
    queryKey: ["municipes-whatsapp-completo"],
    queryFn: async () => {
      let allMunicipes: Municipe[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from("municipes")
          .select("id, nome, telefone, email, bairro")
          .not("telefone", "is", null)
          .order("nome")
          .range(from, from + pageSize - 1);
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          allMunicipes = [...allMunicipes, ...data];
          hasMore = data.length === pageSize;
          from += pageSize;
        } else {
          hasMore = false;
        }
      }
      
      return allMunicipes;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Buscar instâncias conectadas
  const { data: instances, isLoading: loadingInstances } = useQuery({
    queryKey: ["whatsapp-instances-status"],
    queryFn: async () => {
      const specificInstances = ["gabinete-whats-01", "gabinete-whats-02", "gabinete-whats-03"];
      const connectedInstances = [];

      for (const instanceName of specificInstances) {
        try {
          const { data, error } = await supabase.functions.invoke("configurar-evolution", {
            body: { action: "instance_status", instanceName }
          });

          if (!error && data?.status === 'connected') {
            connectedInstances.push({
              instanceName,
              displayName: instanceName.replace('gabinete-whats-', 'Gabinete WhatsApp '),
              status: 'connected',
              number: data.phoneNumber
            });
          }
        } catch (error) {
          console.error(`Erro ao verificar instância ${instanceName}:`, error);
        }
      }

      return connectedInstances;
    },
    enabled: open,
    staleTime: 0,
  });

  // ========== COMPUTED ==========
  
  const filteredMunicipes = useMemo(() => {
    if (!municipes) return [];
    if (!searchMunicipe.trim()) return municipes;
    
    const search = searchMunicipe.toLowerCase();
    return municipes.filter(m => 
      m.nome.toLowerCase().includes(search) ||
      m.telefone?.includes(search) ||
      m.bairro?.toLowerCase().includes(search)
    );
  }, [municipes, searchMunicipe]);

  const selectedMunicipesList = useMemo(() => {
    if (!municipes) return [];
    return selectedMunicipes
      .map(id => municipes.find(m => m.id === id))
      .filter(Boolean) as Municipe[];
  }, [municipes, selectedMunicipes]);

  const totalDestinatarios = incluirTodos 
    ? (municipes?.length || 0)
    : selectedMunicipes.length;

  const temVariaveis = VARIAVEIS.some(v => mensagem.includes(v.codigo));

  const tempoEstimado = useMemo(() => {
    const avgDelay = (tempoMinimo + tempoMaximo) / 2;
    const totalSeconds = totalDestinatarios * avgDelay;
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `~${hours}h ${minutes % 60}min`;
    }
    return `~${minutes} minutos`;
  }, [totalDestinatarios, tempoMinimo, tempoMaximo]);

  // Validação de cada etapa
  const validacaoMensagem = mensagem.trim().length > 0 || mediaFiles.length > 0;
  const validacaoDestinatarios = incluirTodos || selectedMunicipes.length > 0;
  const validacaoConfig = selectedInstance !== "";

  // Verificar se está na última aba (preview)
  const isLastTab = activeTab === 'preview';

  // ========== FUNÇÕES ==========
  
  // Avançar para próxima aba
  const handleNext = () => {
    const currentIndex = TABS_ORDER.indexOf(activeTab);
    
    // Validar aba atual antes de avançar
    if (activeTab === 'mensagem' && !validacaoMensagem) {
      toast({ title: "Atenção", description: "Digite uma mensagem ou adicione um arquivo", variant: "destructive" });
      return;
    }
    if (activeTab === 'destinatarios' && !validacaoDestinatarios) {
      toast({ title: "Atenção", description: "Selecione ao menos um destinatário", variant: "destructive" });
      return;
    }
    if (activeTab === 'config' && !validacaoConfig) {
      toast({ title: "Atenção", description: "Selecione uma instância WhatsApp", variant: "destructive" });
      return;
    }
    
    if (currentIndex < TABS_ORDER.length - 1) {
      setActiveTab(TABS_ORDER[currentIndex + 1]);
    }
  };

  // Preview da mensagem com variáveis substituídas
  const getPreviewMensagem = (municipe?: Municipe) => {
    let preview = mensagem;
    const m = municipe || {
      nome: "João da Silva",
      telefone: "(11) 99999-9999",
      email: "joao@email.com",
      bairro: "Centro"
    };
    
    preview = preview.replace(/{nome}/gi, m.nome || '');
    preview = preview.replace(/{primeiro_nome}/gi, (m.nome || '').split(' ')[0]);
    preview = preview.replace(/{telefone}/gi, m.telefone || '');
    preview = preview.replace(/{email}/gi, m.email || '');
    preview = preview.replace(/{bairro}/gi, m.bairro || '');
    preview = preview.replace(/{data}/gi, new Date().toLocaleDateString('pt-BR'));
    preview = preview.replace(/{hora}/gi, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    
    return preview;
  };

  // Inserir variável na mensagem
  const inserirVariavel = (codigo: string) => {
    setMensagem(prev => prev + codigo);
  };

  // Upload de arquivos
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede 100MB`,
          variant: "destructive",
        });
        return;
      }

      let type: MediaFile['type'];
      
      if (file.type.startsWith('image/')) {
        type = 'image';
      } else if (file.type.startsWith('video/')) {
        type = 'video';
      } else if (file.type.startsWith('audio/') || /\.(m4a|mp3|wav|ogg|aac)$/i.test(file.name)) {
        type = 'audio';
      } else {
        type = 'document';
      }

      const url = URL.createObjectURL(file);
      setMediaFiles(prev => [...prev, { file, type, url }]);
    });

    event.target.value = '';
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const getMediaIcon = (type: MediaFile['type']) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <FileAudio className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // Embaralhar array (Fisher-Yates)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // ========== REGISTRAR NO PRONTUÁRIO ==========
  const registrarNoProntuario = async (
    municipeId: string, 
    municipeNome: string, 
    mensagemEnviada: string, 
    sucesso: boolean
  ) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase
        .from('municipe_atividades')
        .insert({
          municipe_id: municipeId,
          created_by: user.user.id,
          tipo_atividade: 'whatsapp',
          titulo: sucesso ? 'Mensagem WhatsApp enviada' : 'Tentativa de envio WhatsApp (erro)',
          descricao: mensagemEnviada.substring(0, 500) + (mensagemEnviada.length > 500 ? '...' : ''),
          data_atividade: new Date().toISOString(),
        });
      
      // Invalidar cache do prontuário
      queryClient.invalidateQueries({ queryKey: ['municipe-atividades', municipeId] });
      queryClient.invalidateQueries({ queryKey: ['municipe-atividades-count', municipeId] });
    } catch (error) {
      console.warn('Erro ao registrar no prontuário:', error);
    }
  };

  // ========== MUTATION ENVIO ==========
  
  const enviarWhatsApp = useMutation({
    mutationFn: async () => {
      // Preparar lista de destinatários
      let recipients = incluirTodos 
        ? (municipes || []).map(m => ({ 
            id: m.id, 
            nome: m.nome, 
            telefone: m.telefone,
            email: m.email || '',
            bairro: m.bairro || ''
          }))
        : selectedMunicipesList.map(m => ({ 
            id: m.id, 
            nome: m.nome, 
            telefone: m.telefone,
            email: m.email || '',
            bairro: m.bairro || ''
          }));

      // Aplicar ordem aleatória
      if (ordemAleatoria) {
        recipients = shuffleArray(recipients);
      }

      // Iniciar tracking do progresso (MODAL DE PROGRESSO APARECE)
      startSending({
        recipients: recipients.map(r => ({ id: r.id, nome: r.nome, telefone: r.telefone })),
        message: mensagem,
        instanceName: selectedInstance,
        tempoMinimo,
        tempoMaximo,
      });

      // Fechar dialog principal
      setOpen(false);
      
      // Upload de mídias
      const uploadedMedia = [];
      for (const media of mediaFiles) {
        const fileName = `whatsapp/${Date.now()}-${media.file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(fileName, media.file);

        if (uploadError) {
          if (uploadError.message.includes('not found')) {
            await supabase.storage.createBucket('whatsapp-media', { public: true });
            await supabase.storage.from('whatsapp-media').upload(fileName, media.file);
          }
        }

        const { data: urlData } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(fileName);

        uploadedMedia.push({
          type: media.type,
          url: urlData.publicUrl,
          filename: media.file.name
        });
      }

      // ========== CRIAR REGISTRO DE ENVIO NO BANCO ==========
      let envioId: string | null = null;
      
      try {
        const { data: envioData, error: envioError } = await supabase
          .from('whatsapp_envios')
          .insert({
            titulo: mensagem.substring(0, 100) || 'Envio de mídia',
            tipo: uploadedMedia.length > 0 ? uploadedMedia[0].type : 'texto',
            conteudo: { mensagem, mediaFiles: uploadedMedia },
            instancia_nome: selectedInstance,
            total_destinatarios: recipients.length,
            total_enviados: 0,
            total_entregues: 0,
            total_lidos: 0,
            total_erros: 0,
            status: 'enviando',
            ordem_aleatoria: ordemAleatoria,
            delay_min: tempoMinimo,
            delay_max: tempoMaximo,
            reacao_automatica: reacaoAutomatica || null,
            iniciado_em: new Date().toISOString(),
          })
          .select('id')
          .single();
        
        if (!envioError && envioData) {
          envioId = envioData.id;
          setLastEnvioId(envioId);
          console.log('📋 Envio criado no banco:', envioId);
        }
      } catch (err) {
        console.warn('⚠️ Erro ao criar registro:', err);
      }

      // Contadores
      let totalEnviados = 0;
      let totalErros = 0;

      // ========== LOOP SEQUENCIAL COM COUNTDOWN ==========
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        
        // Verificar cancelamento
        const cancelled = document.querySelector('[data-whatsapp-sending-state]')?.getAttribute('data-cancelled');
        if (cancelled === 'true') {
          console.log('❌ Envio cancelado');
          break;
        }
        
        // Marcar como enviando
        updateRecipientStatus(recipient.id, 'sending');
        
        // COUNTDOWN VISUAL
        const delay = Math.floor(Math.random() * (tempoMaximo - tempoMinimo + 1)) + tempoMinimo;
        for (let countdown = delay; countdown > 0; countdown--) {
          const cancelledDuring = document.querySelector('[data-whatsapp-sending-state]')?.getAttribute('data-cancelled');
          if (cancelledDuring === 'true') {
            return { resumo: { total: recipients.length, sucessos: totalEnviados, erros: totalErros }, envioId };
          }
          updateCountdown(recipient.id, countdown);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Verificar cancelamento antes do envio
        const cancelledBefore = document.querySelector('[data-whatsapp-sending-state]')?.getAttribute('data-cancelled');
        if (cancelledBefore === 'true') {
          return { resumo: { total: recipients.length, sucessos: totalEnviados, erros: totalErros }, envioId };
        }
        
        // Preparar mensagem final com variáveis substituídas
        const mensagemFinal = getPreviewMensagem(recipient as Municipe);
        
        try {
          // Preparar dados do destinatário com variáveis
          const now = new Date();
          const destinatarioCompleto = {
            id: recipient.id,
            telefone: recipient.telefone,
            nome: recipient.nome,
            primeiro_nome: recipient.nome.split(' ')[0],
            email: recipient.email,
            bairro: recipient.bairro,
            data: now.toLocaleDateString('pt-BR'),
            hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          };

          // Chamar Edge Function
          const sendResult = await supabase.functions.invoke("enviar-whatsapp", {
            body: {
              destinatarios: [destinatarioCompleto],
              mensagem,
              incluirTodos: false,
              instanceName: selectedInstance,
              tempoMinimo: 0,
              tempoMaximo: 0,
              mediaFiles: uploadedMedia,
              envioId: envioId,
              salvarHistorico: !!envioId,
              reacaoAutomatica: reacaoAutomatica || null,
            }
          });

          if (sendResult.error) {
            throw new Error(sendResult.error.message);
          }

          updateRecipientStatus(recipient.id, 'sent');
          totalEnviados++;
          
          // ========== REGISTRAR NO PRONTUÁRIO (SUCESSO) ==========
          await registrarNoProntuario(recipient.id, recipient.nome, mensagemFinal, true);
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          updateRecipientStatus(recipient.id, 'error', errorMsg);
          totalErros++;
          
          // ========== REGISTRAR NO PRONTUÁRIO (ERRO) ==========
          await registrarNoProntuario(recipient.id, recipient.nome, `[ERRO] ${errorMsg}\n\nMensagem: ${mensagemFinal}`, false);
        }
      }

      // ========== ATUALIZAR ESTATÍSTICAS FINAIS ==========
      if (envioId) {
        await supabase
          .from('whatsapp_envios')
          .update({
            status: totalErros === recipients.length ? 'erro' : 'concluido',
            total_enviados: totalEnviados,
            total_erros: totalErros,
            concluido_em: new Date().toISOString(),
          })
          .eq('id', envioId);
      }

      return {
        resumo: { total: recipients.length, sucessos: totalEnviados, erros: totalErros },
        envioId
      };
    },
    onSuccess: (data) => {
      finishSending();
      toast({
        title: "✅ Envio concluído!",
        description: `${data.resumo.sucessos} enviadas, ${data.resumo.erros} erros.`,
      });
    },
    onError: (error: any) => {
      finishSending();
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Validar e enviar
  const handleEnviar = () => {
    if (!validacaoMensagem || !validacaoDestinatarios || !validacaoConfig) {
      toast({ title: "Atenção", description: "Complete todas as etapas antes de enviar", variant: "destructive" });
      return;
    }
    enviarWhatsApp.mutate();
  };

  // ========== RENDER ==========
  
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Enviar WhatsApp
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  Enviar Mensagem WhatsApp
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Configure e envie mensagens personalizadas para seus contatos
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRelatorios(true)}
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Relatórios
              </Button>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center gap-2 mt-4">
              {[
                { id: "mensagem", label: "Mensagem", icon: MessageSquare, valid: validacaoMensagem },
                { id: "destinatarios", label: "Destinatários", icon: Users, valid: validacaoDestinatarios },
                { id: "config", label: "Configurações", icon: Settings, valid: validacaoConfig },
                { id: "preview", label: "Prévia", icon: Eye, valid: true },
              ].map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => setActiveTab(step.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                      activeTab === step.id
                        ? 'bg-green-500 text-white'
                        : step.valid
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                    }`}
                  >
                    {step.valid && activeTab !== step.id ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {index < 3 && (
                    <ChevronRight className="h-4 w-4 text-gray-300 mx-1" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content com Tabs - Área com Scroll */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            {/* TAB: Mensagem */}
            <TabsContent value="mensagem" className="flex-1 mt-0 min-h-0">
              <ScrollArea className="h-[calc(90vh-280px)]">
                <div className="px-6 py-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-green-500" />
                        Conteúdo da Mensagem
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Área de texto */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Mensagem de Texto</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  Variáveis
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="w-72 p-3">
                                <p className="font-medium mb-2">Variáveis disponíveis:</p>
                                <div className="space-y-1">
                                  {VARIAVEIS.map(v => (
                                    <button
                                      key={v.codigo}
                                      onClick={() => inserirVariavel(v.codigo)}
                                      className="w-full text-left px-2 py-1 rounded hover:bg-muted flex justify-between text-sm"
                                    >
                                      <span>{v.descricao}</span>
                                      <code className="text-xs bg-muted px-1 rounded">{v.codigo}</code>
                                    </button>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Textarea
                          placeholder="Olá {primeiro_nome}! Tudo bem?

Estamos entrando em contato para..."
                          value={mensagem}
                          onChange={(e) => setMensagem(e.target.value)}
                          rows={6}
                          className="font-mono text-sm resize-none"
                        />
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>{mensagem.length} caracteres</span>
                          {temVariaveis && (
                            <Badge variant="secondary" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              Mensagem personalizada
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Botões de variáveis rápidas */}
                      <div className="flex flex-wrap gap-2">
                        {VARIAVEIS.slice(0, 5).map(v => (
                          <Button
                            key={v.codigo}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => inserirVariavel(v.codigo)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {v.descricao}
                          </Button>
                        ))}
                      </div>

                      <Separator />

                      {/* Upload de mídia */}
                      <div>
                        <Label className="flex items-center gap-2 mb-2">
                          <Upload className="h-4 w-4" />
                          Arquivos de Mídia (opcional)
                        </Label>
                        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-green-500 transition-colors">
                          <input
                            type="file"
                            multiple
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="media-upload"
                          />
                          <label htmlFor="media-upload" className="cursor-pointer">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Clique para adicionar imagens, vídeos, áudios ou documentos
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Máximo 100MB por arquivo
                            </p>
                          </label>
                        </div>

                        {mediaFiles.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {mediaFiles.map((media, index) => (
                              <div key={index} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                                {media.type === 'image' && (
                                  <img src={media.url} alt="" className="w-12 h-12 object-cover rounded" />
                                )}
                                {media.type !== 'image' && (
                                  <div className="w-12 h-12 flex items-center justify-center bg-background rounded">
                                    {getMediaIcon(media.type)}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{media.file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {(media.file.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                                <Badge variant="outline">{media.type}</Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => removeMediaFile(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TAB: Destinatários */}
            <TabsContent value="destinatarios" className="flex-1 mt-0 min-h-0">
              <ScrollArea className="h-[calc(90vh-280px)]">
                <div className="px-6 py-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        Selecionar Destinatários
                      </CardTitle>
                      <CardDescription>
                        {municipes?.length || 0} contatos disponíveis com telefone
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Enviar para todos */}
                      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500 rounded-lg">
                            <Users className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">Enviar para todos</p>
                            <p className="text-sm text-muted-foreground">
                              {municipes?.length || 0} contatos com telefone cadastrado
                            </p>
                          </div>
                        </div>
                        <Checkbox
                          id="todos"
                          checked={incluirTodos}
                          onCheckedChange={(checked) => {
                            setIncluirTodos(!!checked);
                            if (checked) setSelectedMunicipes([]);
                          }}
                        />
                      </div>

                      {!incluirTodos && (
                        <>
                          {/* Selecionados */}
                          {selectedMunicipes.length > 0 && (
                            <div>
                              <Label className="mb-2 flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-green-500" />
                                Selecionados ({selectedMunicipes.length})
                              </Label>
                              <div className="flex flex-wrap gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 max-h-32 overflow-y-auto">
                                {selectedMunicipesList.map(m => (
                                  <Badge key={m.id} variant="secondary" className="gap-1 pr-1">
                                    {m.nome}
                                    <button
                                      onClick={() => setSelectedMunicipes(prev => prev.filter(id => id !== m.id))}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Busca */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Buscar por nome, telefone ou bairro..."
                              value={searchMunicipe}
                              onChange={(e) => setSearchMunicipe(e.target.value)}
                              className="pl-10"
                            />
                          </div>

                          {/* Lista de municipes */}
                          <div className="border rounded-lg max-h-64 overflow-y-auto">
                            {loadingMunicipes ? (
                              <div className="p-8 text-center">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Carregando contatos...</p>
                              </div>
                            ) : filteredMunicipes.length === 0 ? (
                              <div className="p-8 text-center text-muted-foreground">
                                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Nenhum contato encontrado</p>
                              </div>
                            ) : (
                              filteredMunicipes.slice(0, 100).map(municipe => {
                                const isSelected = selectedMunicipes.includes(municipe.id);
                                return (
                                  <button
                                    key={municipe.id}
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedMunicipes(prev => prev.filter(id => id !== municipe.id));
                                      } else {
                                        setSelectedMunicipes(prev => [...prev, municipe.id]);
                                      }
                                    }}
                                    className={`w-full flex items-center gap-3 p-3 text-left border-b last:border-b-0 transition-colors ${
                                      isSelected 
                                        ? 'bg-green-50 dark:bg-green-950/30' 
                                        : 'hover:bg-muted/50'
                                    }`}
                                  >
                                    <Checkbox checked={isSelected} />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">{municipe.nome}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {municipe.telefone}
                                        {municipe.bairro && ` • ${municipe.bairro}`}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                            {filteredMunicipes.length > 100 && (
                              <div className="p-3 text-center text-sm text-muted-foreground bg-muted/50">
                                Mostrando 100 de {filteredMunicipes.length} resultados. Refine a busca.
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TAB: Configurações */}
            <TabsContent value="config" className="flex-1 mt-0 min-h-0">
              <ScrollArea className="h-[calc(90vh-280px)]">
                <div className="px-6 py-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-purple-500" />
                        Instância WhatsApp
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingInstances ? (
                        <div className="flex items-center gap-2 p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Verificando conexões...</span>
                        </div>
                      ) : instances && instances.length > 0 ? (
                        <div className="grid gap-3">
                          {instances.map((inst) => (
                            <button
                              key={inst.instanceName}
                              onClick={() => setSelectedInstance(inst.instanceName)}
                              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                                selectedInstance === inst.instanceName
                                  ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                                  : 'border-border hover:border-green-300'
                              }`}
                            >
                              <div className={`w-3 h-3 rounded-full ${
                                selectedInstance === inst.instanceName ? 'bg-green-500' : 'bg-gray-300'
                              }`} />
                              <div className="flex-1 text-left">
                                <p className="font-medium">{inst.displayName}</p>
                                {inst.number && (
                                  <p className="text-sm text-muted-foreground">{inst.number}</p>
                                )}
                              </div>
                              {selectedInstance === inst.instanceName && (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Nenhuma instância conectada</AlertTitle>
                          <AlertDescription>
                            Configure uma instância WhatsApp em Configurações → WhatsApp
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        Intervalo entre Envios
                      </CardTitle>
                      <CardDescription>
                        Define o tempo de espera entre cada mensagem
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="tempo-min">Mínimo (segundos)</Label>
                          <Input
                            id="tempo-min"
                            type="number"
                            min="2"
                            max="60"
                            value={tempoMinimo}
                            onChange={(e) => setTempoMinimo(Math.max(2, Number(e.target.value)))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="tempo-max">Máximo (segundos)</Label>
                          <Input
                            id="tempo-max"
                            type="number"
                            min="2"
                            max="60"
                            value={tempoMaximo}
                            onChange={(e) => setTempoMaximo(Math.max(tempoMinimo, Number(e.target.value)))}
                          />
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        <Info className="h-4 w-4 inline mr-2" />
                        O intervalo aleatório entre {tempoMinimo}s e {tempoMaximo}s simula o comportamento humano
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        Opções Avançadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Ordem aleatória */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Shuffle className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">Ordem aleatória</p>
                            <p className="text-xs text-muted-foreground">
                              Embaralha a ordem dos destinatários
                            </p>
                          </div>
                        </div>
                        <Checkbox
                          checked={ordemAleatoria}
                          onCheckedChange={(checked) => setOrdemAleatoria(!!checked)}
                        />
                      </div>

                      {/* Reação automática */}
                      <div>
                        <Label className="flex items-center gap-2 mb-3">
                          <Heart className="h-4 w-4 text-red-500" />
                          Reação automática ao receber resposta
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setReacaoAutomatica("")}
                            className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                              reacaoAutomatica === ""
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
                            Nenhuma
                          </button>
                          {EMOJIS_REACAO.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => setReacaoAutomatica(emoji)}
                              className={`px-3 py-2 text-xl rounded-lg border transition-all ${
                                reacaoAutomatica === emoji
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TAB: Prévia */}
            <TabsContent value="preview" className="flex-1 mt-0 min-h-0">
              <ScrollArea className="h-[calc(90vh-280px)]">
                <div className="px-6 py-4 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Prévia do WhatsApp */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-green-500" />
                          Prévia da Mensagem
                        </CardTitle>
                        <CardDescription>
                          Como a mensagem aparecerá no WhatsApp
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-[#e5ddd5] dark:bg-[#0b141a] p-4 rounded-lg min-h-[200px]">
                          {/* Balão de mensagem */}
                          <div className="max-w-[85%] ml-auto">
                            {mediaFiles.length > 0 && mediaFiles[0].type === 'image' && (
                              <div className="mb-1 rounded-lg overflow-hidden">
                                <img src={mediaFiles[0].url} alt="" className="w-full" />
                              </div>
                            )}
                            <div className="bg-[#dcf8c6] dark:bg-[#005c4b] p-3 rounded-lg shadow-sm">
                              <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-100">
                                {getPreviewMensagem() || "Digite uma mensagem..."}
                              </p>
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <CheckCircle2 className="h-3 w-3 text-blue-500" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Resumo do envio */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Resumo do Envio
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Destinatários</span>
                            <span className="font-medium">{totalDestinatarios}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Instância</span>
                            <span className="font-medium">{selectedInstance || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Intervalo</span>
                            <span className="font-medium">{tempoMinimo}s - {tempoMaximo}s</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Tempo estimado</span>
                            <span className="font-medium">{tempoEstimado}</span>
                          </div>
                          {ordemAleatoria && (
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-sm text-muted-foreground">Ordem</span>
                              <Badge variant="secondary" className="gap-1">
                                <Shuffle className="h-3 w-3" />
                                Aleatória
                              </Badge>
                            </div>
                          )}
                          {reacaoAutomatica && (
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-sm text-muted-foreground">Reação automática</span>
                              <span className="text-xl">{reacaoAutomatica}</span>
                            </div>
                          )}
                          {mediaFiles.length > 0 && (
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-sm text-muted-foreground">Mídia</span>
                              <Badge variant="secondary">{mediaFiles.length} arquivo(s)</Badge>
                            </div>
                          )}
                        </div>

                        {/* Checklist de validação */}
                        <div className="space-y-2 pt-2">
                          <div className={`flex items-center gap-2 text-sm ${validacaoMensagem ? 'text-green-600' : 'text-red-500'}`}>
                            {validacaoMensagem ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            Mensagem configurada
                          </div>
                          <div className={`flex items-center gap-2 text-sm ${validacaoDestinatarios ? 'text-green-600' : 'text-red-500'}`}>
                            {validacaoDestinatarios ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            Destinatários selecionados
                          </div>
                          <div className={`flex items-center gap-2 text-sm ${validacaoConfig ? 'text-green-600' : 'text-red-500'}`}>
                            {validacaoConfig ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            Instância conectada
                          </div>
                        </div>

                        {/* Aviso sobre prontuário */}
                        <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-700 dark:text-green-300 text-xs">
                            O envio será registrado automaticamente no prontuário de cada contato.
                          </AlertDescription>
                        </Alert>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Amostra de destinatários */}
                  {!incluirTodos && selectedMunicipesList.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Amostra de Mensagens</CardTitle>
                        <CardDescription>
                          Veja como a mensagem ficará para alguns destinatários
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3">
                          {selectedMunicipesList.slice(0, 3).map(m => (
                            <div key={m.id} className="p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-medium">
                                  {m.nome.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{m.nome}</p>
                                  <p className="text-xs text-muted-foreground">{m.telefone}</p>
                                </div>
                              </div>
                              <div className="ml-10 p-2 bg-[#dcf8c6] dark:bg-[#005c4b] rounded-lg text-sm">
                                {getPreviewMensagem(m)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Footer com botões - fixo */}
            <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between flex-shrink-0">
              <div className="text-sm text-muted-foreground">
                {totalDestinatarios > 0 && (
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {totalDestinatarios} destinatário(s) • {tempoEstimado}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                
                {/* Botão dinâmico: Avançar ou Enviar */}
                {isLastTab ? (
                  <Button
                    onClick={handleEnviar}
                    disabled={enviarWhatsApp.isPending || !validacaoMensagem || !validacaoDestinatarios || !validacaoConfig}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {enviarWhatsApp.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Iniciando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Enviar Mensagem
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="gap-2"
                  >
                    Avançar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog de Relatórios */}
      <RelatoriosWhatsAppDialog 
        open={showRelatorios} 
        onOpenChange={setShowRelatorios}
        highlightEnvioId={lastEnvioId}
      />
    </>
  );
}
