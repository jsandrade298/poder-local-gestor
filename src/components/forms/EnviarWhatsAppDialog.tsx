import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { MessageSquare, Send, Loader2, Upload, X, Image, Video, FileAudio, FileText, AlertCircle } from "lucide-react";
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
import { WhatsAppProgressModal } from "./WhatsAppProgressModal";

interface EnviarWhatsAppDialogProps {
  municipesSelecionados?: string[];
}

interface MediaFile {
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
}

export function EnviarWhatsAppDialog({ municipesSelecionados = [] }: EnviarWhatsAppDialogProps) {
  const [open, setOpen] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [incluirTodos, setIncluirTodos] = useState(false);
  const [selectedMunicipes, setSelectedMunicipes] = useState<string[]>(municipesSelecionados);

  // Atualizar selectedMunicipes quando municipesSelecionados mudar
  useEffect(() => {
    setSelectedMunicipes(municipesSelecionados);
  }, [municipesSelecionados]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [tempoMinimo, setTempoMinimo] = useState(1);
  const [tempoMaximo, setTempoMaximo] = useState(3);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [searchMunicipe, setSearchMunicipe] = useState("");
  const [sendingStatus, setSendingStatus] = useState<any>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const { toast } = useToast();

  // Buscar munícipes
  const { data: municipes } = useQuery({
    queryKey: ["municipes-whatsapp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipes")
        .select("id, nome, telefone")
        .not("telefone", "is", null)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Buscar instâncias conectadas usando a edge function
  const { data: instances, isLoading: loadingInstances, refetch: refetchInstances } = useQuery({
    queryKey: ["whatsapp-instances-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("configurar-evolution", {
        body: { action: "list_instances" }
      });

      if (error) throw error;
      
      // Filtrar apenas instâncias conectadas
      return (data?.instances || []).filter(inst => inst.status === 'connected');
    },
    enabled: open,
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Mutation para enviar mensagens
  const enviarWhatsApp = useMutation({
    mutationFn: async (dados: any) => {
      // Upload de mídias para o Storage
      const uploadedMedia = [];
      
      for (const media of mediaFiles) {
        const fileName = `whatsapp/${Date.now()}-${media.file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(fileName, media.file);

        if (uploadError) {
          // Se o bucket não existir, criar e tentar novamente
          if (uploadError.message.includes('not found')) {
            // Criar bucket
            await supabase.storage.createBucket('whatsapp-media', { public: true });
            
            // Tentar upload novamente
            const { data: retryData, error: retryError } = await supabase.storage
              .from('whatsapp-media')
              .upload(fileName, media.file);
              
            if (retryError) throw retryError;
          } else {
            throw uploadError;
          }
        }

        // Obter URL pública
        const { data: urlData } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(fileName);

        uploadedMedia.push({
          type: media.type,
          url: urlData.publicUrl,
          filename: media.file.name
        });
      }

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke("enviar-whatsapp", {
        body: {
          ...dados,
          mediaFiles: uploadedMedia
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSendingStatus(data);
      
      toast({
        title: "✅ Envio concluído!",
        description: `${data.resumo.sucessos} enviadas com sucesso, ${data.resumo.erros} erros.`,
      });
      
      // Limpar formulário após sucesso
      setTimeout(() => {
        setMensagem("");
        setSelectedMunicipes([]);
        setIncluirTodos(false);
        setMediaFiles([]);
        setSendingStatus(null);
      }, 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfirmSend = () => {
    const telefones = incluirTodos 
      ? []
      : selectedMunicipes
          .map(id => municipes?.find(m => m.id === id)?.telefone)
          .filter(Boolean);

    enviarWhatsApp.mutate({
      telefones,
      mensagem,
      incluirTodos,
      instanceName: selectedInstance,
      tempoMinimo,
      tempoMaximo,
    });
  };

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

    // Abrir modal de progresso
    setShowProgressModal(true);
    setOpen(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      // Validar tamanho (máximo 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede 100MB`,
          variant: "destructive",
        });
        return;
      }

      let type: MediaFile['type'];
      
      // Detecção melhorada de tipo, especialmente para áudio
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
        console.log(`Áudio detectado: ${file.name} (${file.type})`);
      } else if (
        file.type === 'application/pdf' ||
        file.name.endsWith('.pdf') ||
        file.name.endsWith('.doc') ||
        file.name.endsWith('.docx') ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.xlsx')
      ) {
        type = 'document';
      } else {
        type = 'document'; // Fallback para documento
      }

      const url = URL.createObjectURL(file);
      setMediaFiles(prev => [...prev, { file, type, url }]);
      
      console.log(`Arquivo adicionado: ${file.name} - Tipo: ${type} - MIME: ${file.type}`);
    });

    // Reset input
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

  // Filtrar munícipes para busca
  const filteredMunicipes = municipes?.filter(m => 
    !selectedMunicipes.includes(m.id) && 
    (m.nome.toLowerCase().includes(searchMunicipe.toLowerCase()) ||
     m.telefone?.includes(searchMunicipe))
  ) || [];

  const totalDestinatarios = incluirTodos 
    ? (municipes?.length || 0)
    : selectedMunicipes.length;

  // Preparar dados dos destinatários para o modal de progresso
  const destinatariosParaModal = incluirTodos 
    ? (municipes?.filter(m => m.telefone) || [])
    : selectedMunicipes
        .map(id => municipes?.find(m => m.id === id))
        .filter((m): m is NonNullable<typeof m> => m != null && !!m.telefone);

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
          <DialogTitle>Enviar Mensagem WhatsApp</DialogTitle>
          <DialogDescription>
            Configure e envie mensagens para os munícipes selecionados
          </DialogDescription>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchInstances()}
              className="mt-1"
            >
              Atualizar instâncias
            </Button>
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
                Enviar para todos os munícipes ({municipes?.length || 0})
              </Label>
            </div>

            {!incluirTodos && (
              <div className="space-y-2">
                <Label>Selecionar Munícipes</Label>
                
                {selectedMunicipes.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                    {selectedMunicipes.map(id => {
                      const municipe = municipes?.find(m => m.id === id);
                      return municipe ? (
                        <Badge key={id} variant="secondary" className="gap-1">
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
                )}

                <Input
                  placeholder="Buscar munícipe por nome ou telefone..."
                  value={searchMunicipe}
                  onChange={(e) => setSearchMunicipe(e.target.value)}
                />

                {searchMunicipe && (
                  <div className="max-h-40 overflow-y-auto border rounded-lg">
                    {filteredMunicipes.length > 0 ? (
                      filteredMunicipes.map(municipe => (
                        <button
                          key={municipe.id}
                          onClick={() => {
                            setSelectedMunicipes(prev => [...prev, municipe.id]);
                            setSearchMunicipe("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                        >
                          <div className="font-medium">{municipe.nome}</div>
                          <div className="text-sm text-muted-foreground">{municipe.telefone}</div>
                        </button>
                      ))
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

          {/* Mensagem */}
          <div>
            <Label htmlFor="mensagem">Mensagem de Texto</Label>
            <Textarea
              id="mensagem"
              placeholder="Digite sua mensagem..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {mensagem.length} caracteres
            </p>
          </div>

          {/* Configuração de Delay */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tempo-min">Tempo mínimo (segundos)</Label>
              <Input
                id="tempo-min"
                type="number"
                min="1"
                value={tempoMinimo}
                onChange={(e) => setTempoMinimo(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="tempo-max">Tempo máximo (segundos)</Label>
              <Input
                id="tempo-max"
                type="number"
                min="1"
                value={tempoMaximo}
                onChange={(e) => setTempoMaximo(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Status de Envio */}
          {sendingStatus && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">Relatório de Envio:</div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>Total: {sendingStatus.resumo.total}</div>
                    <div className="text-green-600">Sucesso: {sendingStatus.resumo.sucessos}</div>
                    <div className="text-red-600">Erros: {sendingStatus.resumo.erros}</div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Resumo e Botões */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {totalDestinatarios} destinatário(s) selecionado(s)
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
                    Enviando...
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

    <WhatsAppProgressModal
      open={showProgressModal}
      onOpenChange={setShowProgressModal}
      destinatarios={destinatariosParaModal}
      tempoMinimo={tempoMinimo}
      tempoMaximo={tempoMaximo}
      onConfirmSend={handleConfirmSend}
      isLoading={enviarWhatsApp.isPending}
      sendingResults={sendingStatus}
    />
    </>
  );
}