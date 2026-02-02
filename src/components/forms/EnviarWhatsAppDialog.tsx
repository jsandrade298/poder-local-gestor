import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageSquare, Send, Loader2, Upload, X, Image, Video, FileAudio, FileText,
  MapPin, User, BarChart3, Eye, Shuffle, Smile, Plus, Trash2, RefreshCw
} from "lucide-react";

interface EnviarWhatsAppDialogProps {
  municipesSelecionados?: string[];
  demandaData?: { protocolo?: string; assunto?: string; status?: string; };
}

interface MediaFile {
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
}

type TipoMensagem = 'texto' | 'imagem' | 'video' | 'audio' | 'documento' | 'localizacao' | 'contato' | 'enquete';

const TABS_CONFIG = [
  { id: 'texto' as TipoMensagem, label: 'Texto', icon: MessageSquare },
  { id: 'imagem' as TipoMensagem, label: 'Imagem', icon: Image },
  { id: 'video' as TipoMensagem, label: 'Vídeo', icon: Video },
  { id: 'audio' as TipoMensagem, label: 'Áudio', icon: FileAudio },
  { id: 'documento' as TipoMensagem, label: 'Doc', icon: FileText },
  { id: 'localizacao' as TipoMensagem, label: 'Local', icon: MapPin },
  { id: 'contato' as TipoMensagem, label: 'Contato', icon: User },
  { id: 'enquete' as TipoMensagem, label: 'Enquete', icon: BarChart3 },
];

const EMOJIS_REACAO = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥'];

const VARIAVEIS = [
  { chave: 'nome', desc: 'Nome completo' },
  { chave: 'primeiro_nome', desc: 'Primeiro nome' },
  { chave: 'telefone', desc: 'Telefone' },
  { chave: 'protocolo', desc: 'Protocolo' },
  { chave: 'assunto', desc: 'Assunto' },
  { chave: 'status', desc: 'Status' },
  { chave: 'data', desc: 'Data atual' },
  { chave: 'hora', desc: 'Hora atual' },
];

export function EnviarWhatsAppDialog({ municipesSelecionados = [], demandaData }: EnviarWhatsAppDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TipoMensagem>('texto');
  
  // Estados de conteúdo
  const [conteudoTexto, setConteudoTexto] = useState({ mensagem: "" });
  const [conteudoImagem, setConteudoImagem] = useState({ url: "", legenda: "" });
  const [conteudoVideo, setConteudoVideo] = useState({ url: "", legenda: "" });
  const [conteudoAudio, setConteudoAudio] = useState({ url: "" });
  const [conteudoDocumento, setConteudoDocumento] = useState({ url: "", nomeArquivo: "" });
  const [conteudoLocalizacao, setConteudoLocalizacao] = useState({ latitude: "", longitude: "", nome: "", endereco: "" });
  const [conteudoContato, setConteudoContato] = useState({ nome: "", telefone: "", descricao: "" });
  const [conteudoEnquete, setConteudoEnquete] = useState({ pergunta: "", opcoes: ["", ""], multiplas: false });
  
  // Estados gerais
  const [incluirTodos, setIncluirTodos] = useState(false);
  const [selectedMunicipes, setSelectedMunicipes] = useState<string[]>(municipesSelecionados);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [tempoMinimo, setTempoMinimo] = useState(2);
  const [tempoMaximo, setTempoMaximo] = useState(5);
  const [ordemAleatoria, setOrdemAleatoria] = useState(false);
  const [reacaoAutomatica, setReacaoAutomatica] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [searchMunicipe, setSearchMunicipe] = useState("");
  const [mostrarOpcoes, setMostrarOpcoes] = useState(false);
  
  const { toast } = useToast();
  const { startSending, updateRecipientStatus, updateCountdown } = useWhatsAppSending();

  useEffect(() => {
    setSelectedMunicipes(municipesSelecionados);
  }, [municipesSelecionados]);

  // Buscar munícipes
  const { data: municipes } = useQuery({
    queryKey: ["municipes-whatsapp"],
    queryFn: async () => {
      let all: Array<{ id: string; nome: string; telefone: string }> = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from("municipes")
          .select("id, nome, telefone")
          .not("telefone", "is", null)
          .order("nome")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          all = [...all, ...data];
          hasMore = data.length === pageSize;
          from += pageSize;
        } else {
          hasMore = false;
        }
      }
      return all;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Buscar instâncias do banco
  const { data: instances, isLoading: loadingInstances, refetch: refetchInstances } = useQuery({
    queryKey: ["whatsapp-instances-db"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const filteredMunicipes = useMemo(() => {
    if (!searchMunicipe.trim() || !municipes) return [];
    const search = searchMunicipe.toLowerCase();
    return municipes.filter(m => m.nome.toLowerCase().includes(search) || m.telefone?.includes(search)).slice(0, 20);
  }, [searchMunicipe, municipes]);

  const totalDestinatarios = incluirTodos ? (municipes?.length || 0) : selectedMunicipes.length;

  // Substituir variáveis para preview
  const substituirPreview = (texto: string): string => {
    const m = municipes?.find(m => selectedMunicipes.includes(m.id));
    const vars: Record<string, string> = {
      nome: m?.nome || 'João Silva',
      primeiro_nome: (m?.nome || 'João Silva').split(' ')[0],
      telefone: m?.telefone || '(11) 99999-0000',
      protocolo: demandaData?.protocolo || '2024-00123',
      assunto: demandaData?.assunto || 'Iluminação pública',
      status: demandaData?.status || 'Em andamento',
      data: new Date().toLocaleDateString('pt-BR'),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    let result = texto;
    Object.entries(vars).forEach(([k, v]) => {
      result = result.replace(new RegExp(`\\{${k}\\}`, 'gi'), v);
    });
    return result;
  };

  const inserirVariavel = (v: string) => {
    const tag = `{${v}}`;
    switch (activeTab) {
      case 'texto': setConteudoTexto(p => ({ ...p, mensagem: p.mensagem + tag })); break;
      case 'imagem': setConteudoImagem(p => ({ ...p, legenda: p.legenda + tag })); break;
      case 'video': setConteudoVideo(p => ({ ...p, legenda: p.legenda + tag })); break;
      case 'documento': setConteudoDocumento(p => ({ ...p, nomeArquivo: p.nomeArquivo + tag })); break;
      case 'enquete': setConteudoEnquete(p => ({ ...p, pergunta: p.pergunta + tag })); break;
    }
  };

  const validarConteudo = (): string | null => {
    switch (activeTab) {
      case 'texto': if (!conteudoTexto.mensagem.trim()) return 'Digite uma mensagem'; break;
      case 'imagem': if (!conteudoImagem.url.trim() && mediaFiles.filter(m => m.type === 'image').length === 0) return 'Informe URL ou faça upload'; break;
      case 'video': if (!conteudoVideo.url.trim() && mediaFiles.filter(m => m.type === 'video').length === 0) return 'Informe URL ou faça upload'; break;
      case 'audio': if (!conteudoAudio.url.trim() && mediaFiles.filter(m => m.type === 'audio').length === 0) return 'Informe URL ou faça upload'; break;
      case 'documento': if (!conteudoDocumento.url.trim() && mediaFiles.filter(m => m.type === 'document').length === 0) return 'Informe URL ou faça upload'; break;
      case 'localizacao': if (!conteudoLocalizacao.latitude || !conteudoLocalizacao.longitude) return 'Informe latitude e longitude'; break;
      case 'contato': if (!conteudoContato.nome.trim() || !conteudoContato.telefone.trim()) return 'Informe nome e telefone'; break;
      case 'enquete': if (!conteudoEnquete.pergunta.trim()) return 'Digite a pergunta'; if (conteudoEnquete.opcoes.filter(o => o.trim()).length < 2) return 'Mínimo 2 opções'; break;
    }
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 100 * 1024 * 1024) {
        toast({ title: "Arquivo muito grande", description: `${file.name} excede 100MB`, variant: "destructive" });
        return;
      }
      let type: MediaFile['type'] = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      setMediaFiles(prev => [...prev, { file, type, url: URL.createObjectURL(file) }]);
    });
    e.target.value = '';
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const getMediaIcon = (type: MediaFile['type']) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4 text-blue-500" />;
      case 'video': return <Video className="h-4 w-4 text-purple-500" />;
      case 'audio': return <FileAudio className="h-4 w-4 text-green-500" />;
      default: return <FileText className="h-4 w-4 text-orange-500" />;
    }
  };

  // Mutation
  const enviarWhatsApp = useMutation({
    mutationFn: async () => {
      const erro = validarConteudo();
      if (erro) throw new Error(erro);
      if (!selectedInstance) throw new Error('Selecione uma instância');
      if (!incluirTodos && selectedMunicipes.length === 0) throw new Error('Selecione destinatários');

      const recipients = incluirTodos 
        ? (municipes || []).map(m => ({ id: m.id, nome: m.nome, telefone: m.telefone }))
        : selectedMunicipes.map(id => {
            const m = municipes?.find(m => m.id === id);
            return m ? { id: m.id, nome: m.nome, telefone: m.telefone } : null;
          }).filter(Boolean) as { id: string; nome: string; telefone: string }[];

      startSending({
        recipients,
        message: activeTab === 'texto' ? conteudoTexto.mensagem : `[${activeTab.toUpperCase()}]`,
        instanceName: selectedInstance,
        tempoMinimo,
        tempoMaximo,
      });

      setOpen(false);

      // Upload mídias
      const uploadedMedia = [];
      for (const media of mediaFiles) {
        const fileName = `whatsapp/${Date.now()}-${media.file.name}`;
        const { error } = await supabase.storage.from('whatsapp-media').upload(fileName, media.file);
        if (error && !error.message.includes('already exists')) {
          if (error.message.includes('not found')) {
            await supabase.storage.createBucket('whatsapp-media', { public: true });
            await supabase.storage.from('whatsapp-media').upload(fileName, media.file);
          }
        }
        const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(fileName);
        uploadedMedia.push({ type: media.type, url: urlData.publicUrl, filename: media.file.name });
      }

      // Processar envios
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        const cancelled = document.querySelector('[data-whatsapp-sending-state]')?.getAttribute('data-cancelled');
        if (cancelled === 'true') break;
        
        updateRecipientStatus(recipient.id, 'sending');
        
        const delay = Math.floor(Math.random() * (tempoMaximo - tempoMinimo + 1)) + tempoMinimo;
        for (let j = delay; j > 0; j--) {
          const c = document.querySelector('[data-whatsapp-sending-state]')?.getAttribute('data-cancelled');
          if (c === 'true') return;
          updateCountdown(recipient.id, j);
          await new Promise(r => setTimeout(r, 1000));
        }

        try {
          const varsDestinatario = {
            nome: recipient.nome,
            primeiro_nome: recipient.nome.split(' ')[0],
            telefone: recipient.telefone,
            protocolo: demandaData?.protocolo || '',
            assunto: demandaData?.assunto || '',
            status: demandaData?.status || '',
          };

          const payload: any = {
            telefones: [recipient.telefone],
            instanceName: selectedInstance,
            tempoMinimo: 0,
            tempoMaximo: 0,
            tipo: activeTab,
            variaveis: varsDestinatario,
            ordemAleatoria: false,
          };

          switch (activeTab) {
            case 'texto':
              payload.mensagem = conteudoTexto.mensagem;
              payload.mediaFiles = uploadedMedia;
              break;
            case 'imagem':
              payload.conteudo = conteudoImagem;
              payload.mediaFiles = conteudoImagem.url ? [] : uploadedMedia.filter(m => m.type === 'image');
              break;
            case 'video':
              payload.conteudo = conteudoVideo;
              payload.mediaFiles = conteudoVideo.url ? [] : uploadedMedia.filter(m => m.type === 'video');
              break;
            case 'audio':
              payload.conteudo = conteudoAudio;
              payload.mediaFiles = conteudoAudio.url ? [] : uploadedMedia.filter(m => m.type === 'audio');
              break;
            case 'documento':
              payload.conteudo = conteudoDocumento;
              payload.mediaFiles = conteudoDocumento.url ? [] : uploadedMedia.filter(m => m.type === 'document');
              break;
            case 'localizacao':
              payload.localizacao = {
                latitude: parseFloat(conteudoLocalizacao.latitude),
                longitude: parseFloat(conteudoLocalizacao.longitude),
                nome: conteudoLocalizacao.nome,
                endereco: conteudoLocalizacao.endereco
              };
              break;
            case 'contato':
              payload.contato = conteudoContato;
              break;
            case 'enquete':
              payload.enquete = {
                pergunta: conteudoEnquete.pergunta,
                opcoes: conteudoEnquete.opcoes.filter(o => o.trim()),
                multiplas: conteudoEnquete.multiplas
              };
              break;
          }

          const { error } = await supabase.functions.invoke("enviar-whatsapp", { body: payload });
          if (error) throw error;
          updateRecipientStatus(recipient.id, 'sent');
        } catch (error) {
          updateRecipientStatus(recipient.id, 'error', error instanceof Error ? error.message : 'Erro');
        }
      }

      return { total: recipients.length };
    },
    onSuccess: (data) => {
      toast({ title: "✅ Envio iniciado!", description: `Processando ${data.total} destinatários` });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Render variáveis
  const renderVariaveis = () => (
    <div className="flex flex-wrap gap-1 mt-2">
      {VARIAVEIS.map(v => (
        <Button key={v.chave} type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => inserirVariavel(v.chave)} title={v.desc}>
          {`{${v.chave}}`}
        </Button>
      ))}
    </div>
  );

  // Render preview
  const renderPreview = () => {
    const msg = activeTab === 'texto' ? substituirPreview(conteudoTexto.mensagem) : 
                activeTab === 'imagem' ? substituirPreview(conteudoImagem.legenda) :
                activeTab === 'video' ? substituirPreview(conteudoVideo.legenda) : '';

    return (
      <div className="bg-[#e5ddd5] rounded-lg p-3 min-h-[180px]">
        <div className="flex justify-end">
          <div className="bg-[#dcf8c6] rounded-lg p-3 max-w-[85%] shadow">
            {activeTab === 'texto' && <p className="text-sm whitespace-pre-wrap">{msg || 'Sua mensagem aqui...'}</p>}
            {activeTab === 'imagem' && (
              <div>
                <div className="w-full h-20 bg-gray-200 rounded flex items-center justify-center mb-2">
                  <Image size={28} className="text-gray-400" />
                </div>
                {msg && <p className="text-sm">{msg}</p>}
              </div>
            )}
            {activeTab === 'video' && (
              <div>
                <div className="w-full h-20 bg-gray-800 rounded flex items-center justify-center mb-2">
                  <Video size={28} className="text-white" />
                </div>
                {msg && <p className="text-sm">{msg}</p>}
              </div>
            )}
            {activeTab === 'audio' && (
              <div className="flex items-center gap-2 bg-white/50 rounded-full px-3 py-2">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                  <FileAudio size={14} className="text-white" />
                </div>
                <div className="flex-1 h-1 bg-gray-300 rounded"><div className="w-1/3 h-full bg-emerald-500 rounded" /></div>
                <span className="text-xs text-gray-500">0:15</span>
              </div>
            )}
            {activeTab === 'documento' && (
              <div className="flex items-center gap-3 bg-white/50 rounded p-2">
                <FileText size={28} className="text-red-500" />
                <div>
                  <p className="text-sm font-medium">{substituirPreview(conteudoDocumento.nomeArquivo) || 'documento.pdf'}</p>
                  <p className="text-xs text-gray-500">PDF</p>
                </div>
              </div>
            )}
            {activeTab === 'localizacao' && (
              <div>
                <div className="w-full h-16 bg-blue-100 rounded flex items-center justify-center mb-2">
                  <MapPin size={24} className="text-red-500" />
                </div>
                <p className="text-sm font-medium">{conteudoLocalizacao.nome || 'Local'}</p>
                <p className="text-xs text-gray-500">{conteudoLocalizacao.endereco || 'Endereço'}</p>
              </div>
            )}
            {activeTab === 'contato' && (
              <div className="flex items-center gap-3 bg-white/50 rounded p-2">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                  <User size={18} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">{conteudoContato.nome || 'Nome'}</p>
                  <p className="text-xs text-gray-500">{conteudoContato.telefone || 'Telefone'}</p>
                </div>
              </div>
            )}
            {activeTab === 'enquete' && (
              <div>
                <p className="text-sm font-medium mb-2">📊 {substituirPreview(conteudoEnquete.pergunta) || 'Pergunta'}</p>
                <div className="space-y-1">
                  {conteudoEnquete.opcoes.filter(o => o).map((op, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/50 rounded px-2 py-1">
                      <div className="w-4 h-4 border-2 border-emerald-500 rounded-full" />
                      <span className="text-sm">{op}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[10px] text-gray-500">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-emerald-500 text-xs">✓✓</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><MessageSquare className="h-4 w-4 mr-2" />Enviar WhatsApp</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />Enviar WhatsApp
          </DialogTitle>
          <DialogDescription>Envie mensagens para munícipes selecionados</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-1">
            {/* Instância */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label>Instância WhatsApp</Label>
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {instances?.map(inst => (
                      <SelectItem key={inst.id} value={inst.instance_name}>
                        {inst.display_name}{inst.phone_number && ` (${inst.phone_number})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" className="mt-6" onClick={() => refetchInstances()} disabled={loadingInstances}>
                <RefreshCw className={`h-4 w-4 ${loadingInstances ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Abas */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TipoMensagem)}>
              <TabsList className="grid grid-cols-8 h-auto">
                {TABS_CONFIG.map(tab => (
                  <TabsTrigger key={tab.id} value={tab.id} className="flex flex-col items-center gap-1 py-2 text-xs">
                    <tab.icon className="h-4 w-4" />{tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Formulário */}
                <div className="space-y-3">
                  <TabsContent value="texto" className="mt-0 space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea value={conteudoTexto.mensagem} onChange={(e) => setConteudoTexto({ mensagem: e.target.value })} placeholder="Digite..." rows={5} />
                    <p className="text-xs text-muted-foreground">*negrito* _itálico_ ~tachado~ • {conteudoTexto.mensagem.length} chars</p>
                    {renderVariaveis()}
                  </TabsContent>

                  <TabsContent value="imagem" className="mt-0 space-y-2">
                    <Label>URL da Imagem</Label>
                    <Input value={conteudoImagem.url} onChange={(e) => setConteudoImagem(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
                    <Label>Legenda</Label>
                    <Textarea value={conteudoImagem.legenda} onChange={(e) => setConteudoImagem(p => ({ ...p, legenda: e.target.value }))} rows={2} />
                    {renderVariaveis()}
                  </TabsContent>

                  <TabsContent value="video" className="mt-0 space-y-2">
                    <Label>URL do Vídeo</Label>
                    <Input value={conteudoVideo.url} onChange={(e) => setConteudoVideo(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
                    <Label>Legenda</Label>
                    <Textarea value={conteudoVideo.legenda} onChange={(e) => setConteudoVideo(p => ({ ...p, legenda: e.target.value }))} rows={2} />
                  </TabsContent>

                  <TabsContent value="audio" className="mt-0 space-y-2">
                    <Label>URL do Áudio</Label>
                    <Input value={conteudoAudio.url} onChange={(e) => setConteudoAudio({ url: e.target.value })} placeholder="https://..." />
                    <p className="text-xs text-muted-foreground">MP3, OGG, WAV - Enviado como voz</p>
                  </TabsContent>

                  <TabsContent value="documento" className="mt-0 space-y-2">
                    <Label>URL do Documento</Label>
                    <Input value={conteudoDocumento.url} onChange={(e) => setConteudoDocumento(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
                    <Label>Nome do Arquivo</Label>
                    <Input value={conteudoDocumento.nomeArquivo} onChange={(e) => setConteudoDocumento(p => ({ ...p, nomeArquivo: e.target.value }))} placeholder="Relatorio_{protocolo}.pdf" />
                    {renderVariaveis()}
                  </TabsContent>

                  <TabsContent value="localizacao" className="mt-0 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Latitude</Label><Input value={conteudoLocalizacao.latitude} onChange={(e) => setConteudoLocalizacao(p => ({ ...p, latitude: e.target.value }))} placeholder="-23.5505" /></div>
                      <div><Label>Longitude</Label><Input value={conteudoLocalizacao.longitude} onChange={(e) => setConteudoLocalizacao(p => ({ ...p, longitude: e.target.value }))} placeholder="-46.6333" /></div>
                    </div>
                    <Label>Nome do Local</Label>
                    <Input value={conteudoLocalizacao.nome} onChange={(e) => setConteudoLocalizacao(p => ({ ...p, nome: e.target.value }))} placeholder="Prefeitura" />
                    <Label>Endereço</Label>
                    <Input value={conteudoLocalizacao.endereco} onChange={(e) => setConteudoLocalizacao(p => ({ ...p, endereco: e.target.value }))} placeholder="Av. Brasil, 1000" />
                  </TabsContent>

                  <TabsContent value="contato" className="mt-0 space-y-2">
                    <Label>Nome</Label>
                    <Input value={conteudoContato.nome} onChange={(e) => setConteudoContato(p => ({ ...p, nome: e.target.value }))} placeholder="Central de Atendimento" />
                    <Label>Telefone</Label>
                    <Input value={conteudoContato.telefone} onChange={(e) => setConteudoContato(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 3333-4444" />
                    <Label>Descrição</Label>
                    <Input value={conteudoContato.descricao} onChange={(e) => setConteudoContato(p => ({ ...p, descricao: e.target.value }))} placeholder="Atendimento 8h-17h" />
                  </TabsContent>

                  <TabsContent value="enquete" className="mt-0 space-y-2">
                    <Label>Pergunta</Label>
                    <Input value={conteudoEnquete.pergunta} onChange={(e) => setConteudoEnquete(p => ({ ...p, pergunta: e.target.value }))} placeholder="Como avalia nosso atendimento?" />
                    {renderVariaveis()}
                    <Label>Opções</Label>
                    <div className="space-y-1">
                      {conteudoEnquete.opcoes.map((op, i) => (
                        <div key={i} className="flex gap-2">
                          <Input value={op} onChange={(e) => {
                            const novas = [...conteudoEnquete.opcoes];
                            novas[i] = e.target.value;
                            setConteudoEnquete(p => ({ ...p, opcoes: novas }));
                          }} placeholder={`Opção ${i + 1}`} />
                          {conteudoEnquete.opcoes.length > 2 && (
                            <Button variant="ghost" size="icon" onClick={() => setConteudoEnquete(p => ({ ...p, opcoes: p.opcoes.filter((_, idx) => idx !== i) }))}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setConteudoEnquete(p => ({ ...p, opcoes: [...p.opcoes, ''] }))}>
                        <Plus className="h-4 w-4 mr-1" />Opção
                      </Button>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={conteudoEnquete.multiplas} onCheckedChange={(c) => setConteudoEnquete(p => ({ ...p, multiplas: c as boolean }))} />
                      <span className="text-sm">Múltiplas respostas</span>
                    </label>
                  </TabsContent>

                  {/* Upload (para imagem/video/audio/doc) */}
                  {['imagem', 'video', 'audio', 'documento'].includes(activeTab) && (
                    <div className="border-t pt-3">
                      <Label>Upload</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input type="file" accept={activeTab === 'imagem' ? 'image/*' : activeTab === 'video' ? 'video/*' : activeTab === 'audio' ? 'audio/*' : '.pdf,.doc,.docx,.xls,.xlsx'} onChange={handleFileUpload} className="hidden" id="media-upload" />
                        <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('media-upload')?.click()}>
                          <Upload className="h-4 w-4 mr-2" />Escolher
                        </Button>
                      </div>
                      {mediaFiles.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {mediaFiles.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                              {getMediaIcon(m.type)}
                              <span className="flex-1 text-sm truncate">{m.file.name}</span>
                              <Button variant="ghost" size="icon" onClick={() => removeMediaFile(i)}><X className="h-3 w-3" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Preview */}
                <div>
                  <Label className="flex items-center gap-2 mb-2"><Eye className="h-4 w-4" />Preview</Label>
                  {renderPreview()}
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Destinatários</span>
                      <Badge variant="secondary">{totalDestinatarios}</Badge>
                    </div>
                    {selectedMunicipes.length > 0 && (
                      <ScrollArea className="h-16">
                        <div className="space-y-1">
                          {selectedMunicipes.slice(0, 4).map(id => {
                            const m = municipes?.find(m => m.id === id);
                            return m ? <div key={id} className="text-xs text-muted-foreground">✓ {m.nome}</div> : null;
                          })}
                          {selectedMunicipes.length > 4 && <div className="text-xs text-muted-foreground">+{selectedMunicipes.length - 4} mais</div>}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              </div>
            </Tabs>

            {/* Opções avançadas */}
            <div className="border rounded-lg">
              <button type="button" className="w-full p-3 flex items-center justify-between hover:bg-muted/50" onClick={() => setMostrarOpcoes(!mostrarOpcoes)}>
                <span className="text-sm font-medium">Opções Avançadas</span>
                <span className="text-xs">{mostrarOpcoes ? '▼' : '▶'}</span>
              </button>
              {mostrarOpcoes && (
                <div className="p-3 pt-0 space-y-3 border-t">
                  <div><Label>Título (histórico)</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Campanha Janeiro" /></div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={ordemAleatoria} onCheckedChange={(c) => setOrdemAleatoria(c as boolean)} />
                    <Shuffle className="h-4 w-4" /><span className="text-sm">Ordem aleatória</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Delay:</span>
                    <Input type="number" value={tempoMinimo} onChange={(e) => setTempoMinimo(parseInt(e.target.value) || 2)} min={1} max={60} className="w-14" />
                    <span className="text-sm">a</span>
                    <Input type="number" value={tempoMaximo} onChange={(e) => setTempoMaximo(parseInt(e.target.value) || 5)} min={1} max={60} className="w-14" />
                    <span className="text-sm text-muted-foreground">seg</span>
                  </div>
                  <div>
                    <Label className="flex items-center gap-2 mb-2"><Smile className="h-4 w-4" />Reação automática</Label>
                    <div className="flex flex-wrap gap-2">
                      {EMOJIS_REACAO.map(e => (
                        <button key={e} type="button" onClick={() => setReacaoAutomatica(reacaoAutomatica === e ? null : e)} 
                          className={`w-9 h-9 text-lg rounded-lg border-2 ${reacaoAutomatica === e ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'}`}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Destinatários */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <Label>Destinatários</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={incluirTodos} onCheckedChange={(c) => setIncluirTodos(c as boolean)} />
                  <span className="text-sm">Todos ({municipes?.length || 0})</span>
                </label>
              </div>
              {!incluirTodos && (
                <>
                  {selectedMunicipes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3 max-h-20 overflow-y-auto">
                      {selectedMunicipes.map(id => {
                        const m = municipes?.find(m => m.id === id);
                        return m ? (
                          <Badge key={id} variant="secondary" className="pr-1">
                            {m.nome}
                            <button type="button" onClick={() => setSelectedMunicipes(p => p.filter(mid => mid !== id))} className="ml-1 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                  <Input placeholder="Buscar..." value={searchMunicipe} onChange={(e) => setSearchMunicipe(e.target.value)} />
                  {searchMunicipe && (
                    <ScrollArea className="h-32 mt-2 border rounded">
                      {filteredMunicipes.length > 0 ? filteredMunicipes.map(m => {
                        const sel = selectedMunicipes.includes(m.id);
                        return (
                          <button key={m.id} type="button" onClick={() => {
                            if (sel) setSelectedMunicipes(p => p.filter(id => id !== m.id));
                            else setSelectedMunicipes(p => [...p, m.id]);
                            setSearchMunicipe("");
                          }} className={`w-full text-left px-3 py-2 border-b last:border-b-0 ${sel ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                            <div className="flex items-center justify-between">
                              <div><div className="font-medium text-sm">{m.nome}</div><div className="text-xs text-muted-foreground">{m.telefone}</div></div>
                              <Badge variant={sel ? "destructive" : "secondary"} className="text-xs">{sel ? 'Remover' : 'Add'}</Badge>
                            </div>
                          </button>
                        );
                      }) : <div className="p-3 text-center text-muted-foreground text-sm">Nenhum encontrado</div>}
                    </ScrollArea>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">{totalDestinatarios} destinatário(s)</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => enviarWhatsApp.mutate()} disabled={enviarWhatsApp.isPending || !selectedInstance || totalDestinatarios === 0}>
              {enviarWhatsApp.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Iniciando...</> : <><Send className="h-4 w-4 mr-2" />Enviar ({totalDestinatarios})</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
