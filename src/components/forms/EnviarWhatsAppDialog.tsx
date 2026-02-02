import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { MessageSquare, Send, Loader2, Upload, X, Image, Video, FileAudio, FileText, AlertCircle, Minimize2, BarChart3, Plus } from "lucide-react";
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
} from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RelatoriosWhatsAppDialog } from "./RelatoriosWhatsAppDialog";

interface EnviarWhatsAppDialogProps {
  municipesSelecionados?: string[];
}

interface MediaFile {
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
}

// Variáveis disponíveis para substituição
const VARIAVEIS = [
  { codigo: "{nome}", descricao: "Nome completo", campo: "nome" },
  { codigo: "{primeiro_nome}", descricao: "Primeiro nome", campo: "primeiro_nome" },
  { codigo: "{telefone}", descricao: "Telefone", campo: "telefone" },
  { codigo: "{email}", descricao: "E-mail", campo: "email" },
  { codigo: "{bairro}", descricao: "Bairro", campo: "bairro" },
  { codigo: "{protocolo}", descricao: "Protocolo da demanda", campo: "protocolo" },
  { codigo: "{assunto}", descricao: "Assunto da demanda", campo: "assunto" },
  { codigo: "{status}", descricao: "Status da demanda", campo: "status" },
  { codigo: "{data}", descricao: "Data atual", campo: "data" },
  { codigo: "{hora}", descricao: "Hora atual", campo: "hora" },
];

export function EnviarWhatsAppDialog({ municipesSelecionados = [] }: EnviarWhatsAppDialogProps) {
  const [open, setOpen] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [incluirTodos, setIncluirTodos] = useState(false);
  const [selectedMunicipes, setSelectedMunicipes] = useState<string[]>(municipesSelecionados);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [tempoMinimo, setTempoMinimo] = useState(2);
  const [tempoMaximo, setTempoMaximo] = useState(5);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [searchMunicipe, setSearchMunicipe] = useState("");
  const [sendingStatus, setSendingStatus] = useState<any>(null);
  const [lastEnvioId, setLastEnvioId] = useState<string | null>(null);
  const [showRelatorios, setShowRelatorios] = useState(false);
  
  // Opções avançadas
  const [ordemAleatoria, setOrdemAleatoria] = useState(false);
  const [reacaoAutomatica, setReacaoAutomatica] = useState<string>("");
  
  const { toast } = useToast();
  const { startSending, updateRecipientStatus, updateCountdown, setMinimized, finishSending } = useWhatsAppSending();

  // Sincronizar munícipes selecionados quando a prop mudar
  useEffect(() => {
    setSelectedMunicipes(municipesSelecionados);
  }, [municipesSelecionados]);

  // Buscar munícipes em lotes (com dados completos para variáveis)
  const { data: municipes } = useQuery({
    queryKey: ["municipes-whatsapp-completo"],
    queryFn: async () => {
      console.log('🔄 Carregando munícipes com dados completos...');
      
      let allMunicipes: Array<{ 
        id: string; 
        nome: string; 
        telefone: string;
        email?: string;
        bairro?: string;
      }> = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`📦 Carregando lote ${Math.floor(from / pageSize) + 1}...`);
        
        const { data, error } = await supabase
          .from("municipes")
          .select("id, nome, telefone, email, bairro")
          .not("telefone", "is", null)
          .order("nome")
          .range(from, from + pageSize - 1);
          
        if (error) {
          console.error('❌ Erro ao buscar munícipes:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allMunicipes = [...allMunicipes, ...data];
          hasMore = data.length === pageSize;
          from += pageSize;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`🎯 Total: ${allMunicipes.length} munícipes carregados`);
      return allMunicipes;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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

  // Função para embaralhar array (Fisher-Yates)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Mutation para enviar mensagens
  const enviarWhatsApp = useMutation({
    mutationFn: async (dados: any) => {
      // Preparar lista de destinatários com dados completos
      let recipients = incluirTodos 
        ? (municipes || []).map(m => ({ 
            id: m.id, 
            nome: m.nome, 
            telefone: m.telefone,
            email: m.email || '',
            bairro: m.bairro || ''
          }))
        : selectedMunicipes
            .map(id => {
              const municipe = municipes?.find(m => m.id === id);
              return municipe ? { 
                id: municipe.id, 
                nome: municipe.nome, 
                telefone: municipe.telefone,
                email: municipe.email || '',
                bairro: municipe.bairro || ''
              } : null;
            })
            .filter(Boolean) as { id: string; nome: string; telefone: string; email: string; bairro: string }[];

      // Aplicar ordem aleatória se configurado
      if (ordemAleatoria) {
        recipients = shuffleArray(recipients);
        console.log('🔀 Ordem aleatória aplicada');
      }

      // Iniciar tracking do progresso (MODAL APARECE AQUI)
      startSending({
        recipients: recipients.map(r => ({ id: r.id, nome: r.nome, telefone: r.telefone })),
        message: mensagem,
        instanceName: selectedInstance,
        tempoMinimo,
        tempoMaximo,
      });

      // Minimizar dialog principal e mostrar modal de progresso
      setOpen(false);
      
      // Upload de mídias para o Storage
      const uploadedMedia = [];
      
      for (const media of mediaFiles) {
        const fileName = `whatsapp/${Date.now()}-${media.file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(fileName, media.file);

        if (uploadError) {
          if (uploadError.message.includes('not found')) {
            await supabase.storage.createBucket('whatsapp-media', { public: true });
            const { error: retryError } = await supabase.storage
              .from('whatsapp-media')
              .upload(fileName, media.file);
            if (retryError) throw retryError;
          } else {
            throw uploadError;
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

      // Criar registro de envio no banco ANTES de começar
      let envioId: string | null = null;
      
      try {
        const { data: envioData, error: envioError } = await supabase
          .from('whatsapp_envios')
          .insert({
            titulo: mensagem.substring(0, 100) || 'Envio de mídia',
            tipo: uploadedMedia.length > 0 ? uploadedMedia[0].type : 'texto',
            mensagem: mensagem,
            instancia_nome: selectedInstance,
            total_destinatarios: recipients.length,
            total_enviados: 0,
            total_entregues: 0,
            total_lidos: 0,
            total_erros: 0,
            status: 'enviando',
            reacao_automatica: reacaoAutomatica || null,
          })
          .select('id')
          .single();
        
        if (!envioError && envioData) {
          envioId = envioData.id;
          setLastEnvioId(envioId);
          console.log('📋 Envio criado no banco:', envioId);
        }
      } catch (err) {
        console.warn('⚠️ Não foi possível criar registro de envio:', err);
      }

      // Contadores para estatísticas
      let totalEnviados = 0;
      let totalErros = 0;

      // ENVIO SEQUENCIAL COM COUNTDOWN
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        
        // Verificar se o envio foi cancelado
        const currentState = document.querySelector('[data-whatsapp-sending-state]')?.getAttribute('data-cancelled');
        if (currentState === 'true') {
          console.log('❌ Envio cancelado pelo usuário');
          break;
        }
        
        // Marcar como enviando
        updateRecipientStatus(recipient.id, 'sending');
        
        // COUNTDOWN REAL antes do envio
        const delay = Math.floor(Math.random() * (tempoMaximo - tempoMinimo + 1)) + tempoMinimo;
        for (let countdown = delay; countdown > 0; countdown--) {
          // Verificar cancelamento durante countdown
          const cancelledDuringCountdown = document.querySelector('[data-whatsapp-sending-state]')?.getAttribute('data-cancelled');
          if (cancelledDuringCountdown === 'true') {
            return { resumo: { total: recipients.length, sucessos: totalEnviados, erros: totalErros }, envioId };
          }
          
          updateCountdown(recipient.id, countdown);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Verificar cancelamento antes do envio
        const cancelledBeforeSend = document.querySelector('[data-whatsapp-sending-state]')?.getAttribute('data-cancelled');
        if (cancelledBeforeSend === 'true') {
          return { resumo: { total: recipients.length, sucessos: totalEnviados, erros: totalErros }, envioId };
        }
        
        try {
          // Preparar dados completos do destinatário para variáveis
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

          // Envio individual com dados completos
          const sendResult = await supabase.functions.invoke("enviar-whatsapp", {
            body: {
              // Passar destinatário completo com variáveis
              destinatarios: [destinatarioCompleto],
              mensagem,
              incluirTodos: false,
              instanceName: selectedInstance,
              tempoMinimo: 0, // Já fizemos o delay no frontend
              tempoMaximo: 0,
              mediaFiles: uploadedMedia,
              // Vincular ao registro de envio
              envioId: envioId,
              salvarHistorico: !!envioId, // Só salvar se temos envioId
              reacaoAutomatica: reacaoAutomatica || null,
            }
          });

          if (sendResult.error) {
            throw new Error(sendResult.error.message);
          }

          updateRecipientStatus(recipient.id, 'sent');
          totalEnviados++;
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          updateRecipientStatus(recipient.id, 'error', errorMsg);
          totalErros++;
          
          // Registrar erro no destinatário se temos envioId
          if (envioId) {
            try {
              await supabase
                .from('whatsapp_envios_destinatarios')
                .update({ 
                  status: 'erro',
                  erro_mensagem: errorMsg 
                })
                .eq('envio_id', envioId)
                .eq('telefone', recipient.telefone);
            } catch (e) {
              console.warn('Não foi possível atualizar status de erro');
            }
          }
        }
      }

      // Atualizar estatísticas finais do envio
      if (envioId) {
        try {
          await supabase
            .from('whatsapp_envios')
            .update({
              status: 'concluido',
              total_enviados: totalEnviados,
              total_erros: totalErros,
              concluido_em: new Date().toISOString(),
            })
            .eq('id', envioId);
            
          console.log('✅ Estatísticas do envio atualizadas');
        } catch (err) {
          console.warn('⚠️ Não foi possível atualizar estatísticas:', err);
        }
      }

      return {
        resumo: {
          total: recipients.length,
          sucessos: totalEnviados,
          erros: totalErros
        },
        envioId
      };
    },
    onSuccess: (data) => {
      setSendingStatus(data);
      finishSending();
      
      toast({
        title: "✅ Envio concluído!",
        description: `${data.resumo.sucessos} enviadas com sucesso, ${data.resumo.erros} erros.`,
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

  const handleEnviar = () => {
    if (!mensagem.trim() && mediaFiles.length === 0) {
      toast({
        title: "Atenção",
        description: "Digite uma mensagem ou adicione um arquivo",
        variant: "destructive",
      });
      return;
    }

    if (!selectedInstance) {
      toast({
        title: "Atenção",
        description: "Selecione uma instância WhatsApp",
        variant: "destructive",
      });
      return;
    }

    if (!incluirTodos && selectedMunicipes.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione destinatários ou marque 'Enviar para todos'",
        variant: "destructive",
      });
      return;
    }

    enviarWhatsApp.mutate({});
  };

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
      } else if (
        file.type.startsWith('audio/') || 
        file.name.endsWith('.m4a') || 
        file.name.endsWith('.mp3') || 
        file.name.endsWith('.wav') ||
        file.name.endsWith('.ogg') ||
        file.name.endsWith('.aac')
      ) {
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

  // Inserir variável na mensagem
  const inserirVariavel = (codigo: string) => {
    setMensagem(prev => prev + codigo);
  };

  // Preview da mensagem com variáveis substituídas (exemplo)
  const getPreviewMensagem = () => {
    let preview = mensagem;
    preview = preview.replace(/{nome}/g, 'João Silva');
    preview = preview.replace(/{primeiro_nome}/g, 'João');
    preview = preview.replace(/{telefone}/g, '(11) 99999-9999');
    preview = preview.replace(/{email}/g, 'joao@email.com');
    preview = preview.replace(/{bairro}/g, 'Centro');
    preview = preview.replace(/{protocolo}/g, 'DEM-2024-001');
    preview = preview.replace(/{assunto}/g, 'Iluminação Pública');
    preview = preview.replace(/{status}/g, 'Em Andamento');
    preview = preview.replace(/{data}/g, new Date().toLocaleDateString('pt-BR'));
    preview = preview.replace(/{hora}/g, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    return preview;
  };

  const filteredMunicipes = municipes?.filter(m => {
    if (!searchMunicipe.trim()) return true;
    return m.nome.toLowerCase().includes(searchMunicipe.toLowerCase()) ||
           m.telefone?.includes(searchMunicipe);
  }) || [];

  const totalDestinatarios = incluirTodos 
    ? (municipes?.length || 0)
    : selectedMunicipes.length;

  // Verificar se a mensagem contém variáveis
  const temVariaveis = VARIAVEIS.some(v => mensagem.includes(v.codigo));

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Enviar WhatsApp
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Enviar Mensagem WhatsApp</DialogTitle>
                <DialogDescription>
                  Configure e envie mensagens para os munícipes selecionados
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRelatorios(true)}
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Relatórios
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMinimized(true)}
                  className="gap-2"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Seleção de Instância */}
            <div>
              <Label>Instância WhatsApp *</Label>
              {loadingInstances ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Verificando instâncias...</span>
                </div>
              ) : instances && instances.length > 0 ? (
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a instância para envio" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.instanceName} value={inst.instanceName}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span>{inst.displayName}</span>
                          {inst.number && (
                            <span className="text-muted-foreground">({inst.number})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Alert className="mt-1">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma instância conectada. Configure em Configurações → WhatsApp.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Seleção de Destinatários */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="todos"
                  checked={incluirTodos}
                  onCheckedChange={(checked) => {
                    setIncluirTodos(!!checked);
                    if (checked) setSelectedMunicipes([]);
                  }}
                />
                <Label htmlFor="todos">
                  Enviar para todos os munícipes com telefone ({municipes?.length || 0})
                </Label>
              </div>

              {!incluirTodos && (
                <div className="space-y-2">
                  <Label>Selecionar Munícipes</Label>
                  
                  <div className="min-h-[80px] max-h-48 overflow-y-auto p-3 bg-muted rounded-lg border">
                    {selectedMunicipes.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {selectedMunicipes.map(id => {
                            const municipe = municipes?.find(m => m.id === id);
                            return municipe ? (
                              <Badge key={id} variant="secondary" className="gap-1 text-xs">
                                {municipe.nome}
                                <button
                                  onClick={() => setSelectedMunicipes(prev => prev.filter(mid => mid !== id))}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {selectedMunicipes.length} munícipe(s) selecionado(s)
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        Nenhum munícipe selecionado. Use a busca abaixo para adicionar.
                      </div>
                    )}
                  </div>

                  <Input
                    placeholder="Buscar munícipe por nome ou telefone..."
                    value={searchMunicipe}
                    onChange={(e) => setSearchMunicipe(e.target.value)}
                  />

                  {searchMunicipe && (
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      {filteredMunicipes.length > 0 ? (
                        filteredMunicipes.slice(0, 50).map(municipe => {
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
                                setSearchMunicipe("");
                              }}
                              className={`w-full text-left px-3 py-2 transition-colors border-b last:border-b-0 ${
                                isSelected 
                                  ? 'bg-primary/10 text-primary border-primary/20' 
                                  : 'hover:bg-muted border-border'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium">{municipe.nome}</div>
                                  <div className="text-sm text-muted-foreground">{municipe.telefone}</div>
                                </div>
                                {isSelected ? (
                                  <Badge variant="destructive" className="text-xs">Remover</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Adicionar</Badge>
                                )}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-muted-foreground">
                          Nenhum munícipe encontrado
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upload de Mídia */}
            <div>
              <Label>Arquivos de Mídia (opcional)</Label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="media-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('media-upload')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Adicionar Arquivos
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Máx. 100MB por arquivo
                  </span>
                </div>

                {mediaFiles.length > 0 && (
                  <div className="space-y-1">
                    {mediaFiles.map((media, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                        {getMediaIcon(media.type)}
                        <span className="flex-1 text-sm truncate">{media.file.name}</span>
                        <Badge variant="outline" className="text-xs">{media.type}</Badge>
                        <button onClick={() => removeMediaFile(index)}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mensagem com Variáveis */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="mensagem">Mensagem de Texto</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Inserir Variável
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Clique para inserir:
                      </div>
                      {VARIAVEIS.map((v) => (
                        <button
                          key={v.codigo}
                          onClick={() => inserirVariavel(v.codigo)}
                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded flex justify-between items-center"
                        >
                          <span>{v.descricao}</span>
                          <code className="text-xs bg-muted px-1 rounded">{v.codigo}</code>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Textarea
                id="mensagem"
                placeholder="Digite sua mensagem... Use variáveis como {nome} para personalizar"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {mensagem.length} caracteres
                {temVariaveis && " • Contém variáveis que serão substituídas"}
              </p>
            </div>

            {/* Preview da mensagem */}
            {temVariaveis && mensagem.trim() && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs font-medium text-green-700 mb-1">
                  📱 Preview (exemplo):
                </div>
                <div className="text-sm text-green-900 whitespace-pre-wrap">
                  {getPreviewMensagem()}
                </div>
              </div>
            )}

            {/* Configurações Avançadas */}
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <div className="text-sm font-medium">Configurações Avançadas</div>
              
              {/* Delay */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tempo-min" className="text-xs">Tempo mínimo (seg)</Label>
                  <Input
                    id="tempo-min"
                    type="number"
                    min="2"
                    max="60"
                    value={tempoMinimo}
                    onChange={(e) => setTempoMinimo(Math.max(2, Number(e.target.value)))}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="tempo-max" className="text-xs">Tempo máximo (seg)</Label>
                  <Input
                    id="tempo-max"
                    type="number"
                    min="2"
                    max="60"
                    value={tempoMaximo}
                    onChange={(e) => setTempoMaximo(Math.max(tempoMinimo, Number(e.target.value)))}
                    className="h-8"
                  />
                </div>
              </div>

              {/* Ordem aleatória */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ordem-aleatoria"
                  checked={ordemAleatoria}
                  onCheckedChange={(checked) => setOrdemAleatoria(!!checked)}
                />
                <Label htmlFor="ordem-aleatoria" className="text-sm">
                  Enviar em ordem aleatória (humanização)
                </Label>
              </div>

              {/* Reação automática */}
              <div>
                <Label className="text-xs">Reação automática ao receber resposta</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {['', '❤️', '👍', '🙏', '😊', '✅', '🎉', '👏', '🤝'].map((emoji) => (
                    <button
                      key={emoji || 'none'}
                      onClick={() => setReacaoAutomatica(emoji)}
                      className={`px-3 py-1.5 rounded border text-lg transition-all ${
                        reacaoAutomatica === emoji
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:bg-muted border-border'
                      }`}
                    >
                      {emoji || <span className="text-xs text-muted-foreground">Nenhuma</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resumo e Botões */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {totalDestinatarios} destinatário(s) selecionado(s)
                {ordemAleatoria && " • Ordem aleatória"}
                {reacaoAutomatica && ` • Reação: ${reacaoAutomatica}`}
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleEnviar}
                  disabled={enviarWhatsApp.isPending || !selectedInstance}
                >
                  {enviarWhatsApp.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Mensagem
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
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
