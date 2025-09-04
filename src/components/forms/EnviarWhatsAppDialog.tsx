import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { MessageSquare, Send, Loader2, Smartphone, Upload, X, Image, Video, FileAudio, FileText, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [tempoMinimo, setTempoMinimo] = useState(1);
  const [tempoMaximo, setTempoMaximo] = useState(3);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [searchMunicipe, setSearchMunicipe] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar munícipes com telefone
  const { data: municipes } = useQuery({
    queryKey: ["municipes-whatsapp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipes")
        .select("id, nome, telefone")
        .not("telefone", "is", null)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  // Buscar instâncias WhatsApp conectadas
  const { data: instances, isLoading: loadingInstances } = useQuery({
    queryKey: ["whatsapp-instances-connected"],
    queryFn: async () => {
      // Primeiro buscar as instâncias do banco
      const { data: dbInstances, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("active", true);

      if (error) throw error;

      // Verificar status de cada instância via edge function
      const instancesWithStatus = await Promise.all(
        dbInstances.map(async (instance) => {
          try {
            const { data: statusData } = await supabase.functions.invoke("configurar-evolution", {
              body: {
                action: "instance_status",
                instanceName: instance.instance_name
              }
            });

            return {
              ...instance,
              connected: statusData?.status === "connected",
              profileName: statusData?.profileName,
              phoneNumber: statusData?.phoneNumber
            };
          } catch (error) {
            console.error(`Erro ao verificar status da instância ${instance.instance_name}:`, error);
            return {
              ...instance,
              connected: false
            };
          }
        })
      );

      // Retornar apenas instâncias conectadas
      return instancesWithStatus.filter(instance => instance.connected);
    },
    enabled: open, // Só executa quando o dialog está aberto
  });

  const enviarWhatsApp = useMutation({
    mutationFn: async ({ telefones, mensagem, incluirTodos, instanceName, tempoMinimo, tempoMaximo, mediaFiles }: {
      telefones: string[];
      mensagem: string;
      incluirTodos: boolean;
      instanceName: string;
      tempoMinimo: number;
      tempoMaximo: number;
      mediaFiles: MediaFile[];
    }) => {
      // Função para sanitizar nome do arquivo
      const sanitizeKey = (original: string) => {
        return `${Date.now()}-${original}`
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
          .replace(/[^\w.-]+/g, '_');                       // troca espaços, () etc por _
      };

      // Upload de arquivos de mídia para o Supabase Storage com URL assinada
      const uploadedMedia = [];
      for (const media of mediaFiles) {
        const sanitizedFileName = sanitizeKey(media.file.name);
        
        const { error: uploadError } = await supabase.storage
          .from('demanda-anexos')
          .upload(sanitizedFileName, media.file, { 
            upsert: true, 
            contentType: media.file.type 
          });

        if (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          throw new Error(`Erro ao fazer upload do arquivo ${media.file.name}: ${uploadError.message}`);
        }

        // Criar URL assinada (válida por 1 hora)
        const { data: signedData, error: signError } = await supabase.storage
          .from('demanda-anexos')
          .createSignedUrl(sanitizedFileName, 60 * 60);

        if (signError) {
          console.error('Erro ao criar URL assinada:', signError);
          throw new Error(`Erro ao criar URL do arquivo ${media.file.name}: ${signError.message}`);
        }

        uploadedMedia.push({
          type: media.type,
          url: signedData.signedUrl,
          filename: sanitizedFileName,
          fileName: media.file.name // nome original para exibição
        });
      }

      const { data, error } = await supabase.functions.invoke("enviar-whatsapp-zapi", {
        body: { 
          telefones, 
          mensagem, 
          incluirTodos, 
          instanceName, 
          tempoMinimo, 
          tempoMaximo,
          mediaFiles: uploadedMedia
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Mensagens enviadas!",
        description: `${data.resumo.sucessos} mensagens enviadas com sucesso. ${data.resumo.erros} erros.`,
      });
      setOpen(false);
      setMensagem("");
      setSelectedMunicipes([]);
      setIncluirTodos(false);
      setSelectedInstance("");
      setTempoMinimo(1);
      setTempoMaximo(3);
      setMediaFiles([]);
      setSearchMunicipe("");
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar mensagens",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEnviar = () => {
    if (!mensagem.trim() && mediaFiles.length === 0) {
      toast({
        title: "Erro",
        description: "Digite uma mensagem ou adicione um arquivo de mídia",
        variant: "destructive",
      });
      return;
    }

    if (!selectedInstance) {
      toast({
        title: "Erro",
        description: "Selecione uma instância WhatsApp conectada",
        variant: "destructive",
      });
      return;
    }

    if (tempoMinimo < 1 || tempoMaximo < tempoMinimo) {
      toast({
        title: "Erro",
        description: "Configure tempos válidos (mínimo >= 1s e máximo >= mínimo)",
        variant: "destructive",
      });
      return;
    }

    if (!incluirTodos && selectedMunicipes.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione ao menos um munícipe ou marque 'Enviar para todos'",
        variant: "destructive",
      });
      return;
    }

    const telefones = incluirTodos 
      ? [] 
      : selectedMunicipes
          .map(id => municipes?.find(m => m.id === id)?.telefone)
          .filter(Boolean) as string[];

    enviarWhatsApp.mutate({ 
      telefones, 
      mensagem, 
      incluirTodos, 
      instanceName: selectedInstance,
      tempoMinimo,
      tempoMaximo,
      mediaFiles
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede o limite de 100MB`,
          variant: "destructive",
        });
        return;
      }

      let type: MediaFile['type'];
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else type = 'document';

      const url = URL.createObjectURL(file);
      setMediaFiles(prev => [...prev, { file, type, url }]);
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

  const totalSelecionados = incluirTodos 
    ? municipes?.length || 0
    : selectedMunicipes.length;

  const toggleMunicipe = (municipeId: string) => {
    setSelectedMunicipes(prev => 
      prev.includes(municipeId)
        ? prev.filter(id => id !== municipeId)
        : [...prev, municipeId]
    );
  };

  // Filtrar munícipes baseado na busca
  const filteredMunicipes = municipes?.filter(m => 
    !selectedMunicipes.includes(m.id) && 
    (m.nome.toLowerCase().includes(searchMunicipe.toLowerCase()) ||
     m.telefone.includes(searchMunicipe))
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Enviar WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar Mensagem WhatsApp</DialogTitle>
          <DialogDescription>
            Envie mensagens WhatsApp para munícipes selecionados ou todos os cadastrados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="instancia">Instância WhatsApp</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["whatsapp-instances-connected"] })}
                disabled={loadingInstances}
                className="gap-1 h-8"
              >
                <RefreshCw className={`h-3 w-3 ${loadingInstances ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
            {loadingInstances ? (
              <div className="flex items-center gap-2 mt-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Verificando instâncias conectadas...</span>
              </div>
            ) : instances && instances.length > 0 ? (
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma instância WhatsApp conectada" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.instance_name}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <Smartphone className="h-4 w-4" />
                        <span>{instance.display_name}</span>
                        {instance.phoneNumber && (
                          <span className="text-muted-foreground">({instance.phoneNumber})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 p-3 border border-destructive/50 rounded-md bg-destructive/10">
                <p className="text-sm text-destructive">
                  Nenhuma instância WhatsApp conectada encontrada. 
                  Vá para Configurações → WhatsApp para conectar uma instância.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tempo-minimo">Tempo mínimo entre envios (segundos)</Label>
              <Input
                id="tempo-minimo"
                type="number"
                min="1"
                value={tempoMinimo}
                onChange={(e) => setTempoMinimo(parseInt(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="tempo-maximo">Tempo máximo entre envios (segundos)</Label>
              <Input
                id="tempo-maximo"
                type="number"
                min="1"
                value={tempoMaximo}
                onChange={(e) => setTempoMaximo(parseInt(e.target.value) || 3)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Arquivos de Mídia</Label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="media-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('media-upload')?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Adicionar Arquivos
                </Button>
                <span className="text-sm text-muted-foreground">
                  Imagens, vídeos, áudios, documentos (máx 100MB)
                </span>
              </div>

              {mediaFiles.length > 0 && (
                <div className="space-y-2">
                  {mediaFiles.map((media, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      {getMediaIcon(media.type)}
                      <span className="flex-1 text-sm truncate">{media.file.name}</span>
                      <Badge variant="secondary">{media.type}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMediaFile(index)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea
              id="mensagem"
              placeholder="Digite sua mensagem aqui (opcional se enviando arquivos)..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              className="mt-1"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="incluir-todos"
              checked={incluirTodos}
              onCheckedChange={(checked) => {
                setIncluirTodos(checked as boolean);
                if (checked) {
                  setSelectedMunicipes([]);
                }
              }}
            />
            <Label htmlFor="incluir-todos">
              Enviar para todos os munícipes cadastrados ({municipes?.length || 0})
            </Label>
          </div>

          {!incluirTodos && (
            <div>
              <Label>Selecionar Munícipes</Label>
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedMunicipes.map(id => {
                    const municipe = municipes?.find(m => m.id === id);
                    return municipe ? (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {municipe.nome}
                        <button
                          onClick={() => toggleMunicipe(id)}
                          className="ml-1 hover:bg-red-200 rounded-full p-0.5"
                        >
                          ×
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>

                <div>
                  <Input
                    placeholder="Buscar munícipe por nome ou telefone..."
                    value={searchMunicipe}
                    onChange={(e) => setSearchMunicipe(e.target.value)}
                    className="mb-2"
                  />
                </div>

                <Select onValueChange={(value) => {
                  toggleMunicipe(value);
                  setSearchMunicipe(""); // Limpar busca após selecionar
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um munícipe para adicionar" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {filteredMunicipes && filteredMunicipes.length > 0 ? (
                      filteredMunicipes.map((municipe) => (
                        <SelectItem key={municipe.id} value={municipe.id}>
                          {municipe.nome} - {municipe.telefone}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-results" disabled>
                        {searchMunicipe ? "Nenhum munícipe encontrado" : "Todos os munícipes já foram selecionados"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-muted-foreground">
              {totalSelecionados} destinatário{totalSelecionados !== 1 ? 's' : ''} selecionado{totalSelecionados !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleEnviar}
                disabled={enviarWhatsApp.isPending || !selectedInstance || (instances && instances.length === 0)}
                className="gap-2"
              >
                {enviarWhatsApp.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar Mensagem
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}