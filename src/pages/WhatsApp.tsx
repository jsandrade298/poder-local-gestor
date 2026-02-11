import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle, Cake, Send, Clock, Users, Paperclip, X,
  CheckSquare, Square, FileText, AlertCircle, Sparkles, Eye, Plus,
  Image, Video, FileAudio, Wifi, WifiOff, Timer, Zap, ChevronRight,
  Save, TestTube, RefreshCw, Phone, EyeOff, Gauge,
  BellRing
} from "lucide-react";

// ========== INTERFACES ==========

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  status: string;
  phone_number?: string;
}

interface Aniversariante {
  id: string;
  nome: string;
  telefone: string;
  data_nascimento: string;
  bairro?: string;
}

interface WhatsAppConfig {
  instancia_aniversario: string;
  mensagem_aniversario: string;
  aniversario_ativo: boolean;
  tempo_minimo_aniversario: number;
  tempo_maximo_aniversario: number;
  instancia_demandas: string;
  mensagem_demandas: string;
  demandas_ativo: boolean;
  tempo_minimo_demandas: number;
  tempo_maximo_demandas: number;
}

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

// ========== VARIÁVEIS DISPONÍVEIS ==========

const VARIAVEIS_ANIVERSARIO = [
  { codigo: "{nome}", descricao: "Nome completo", exemplo: "Maria da Silva", icone: "👤" },
  { codigo: "{primeiro_nome}", descricao: "Primeiro nome", exemplo: "Maria", icone: "🙋" },
  { codigo: "{bairro}", descricao: "Bairro", exemplo: "Centro", icone: "📍" },
  { codigo: "{data}", descricao: "Data atual", exemplo: new Date().toLocaleDateString('pt-BR'), icone: "📅" },
  { codigo: "{hora}", descricao: "Hora atual", exemplo: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), icone: "🕐" },
];

const VARIAVEIS_DEMANDAS = [
  { codigo: "{nome}", descricao: "Nome completo", exemplo: "João Santos", icone: "👤" },
  { codigo: "{primeiro_nome}", descricao: "Primeiro nome", exemplo: "João", icone: "🙋" },
  { codigo: "{status}", descricao: "Status da demanda", exemplo: "Em Andamento", icone: "📊" },
  { codigo: "{protocolo}", descricao: "Protocolo", exemplo: "2026-0042", icone: "🔖" },
  { codigo: "{titulo}", descricao: "Título da demanda", exemplo: "Buraco na Rua XV", icone: "📝" },
  { codigo: "{bairro}", descricao: "Bairro", exemplo: "Vila Assunção", icone: "📍" },
  { codigo: "{data}", descricao: "Data atual", exemplo: new Date().toLocaleDateString('pt-BR'), icone: "📅" },
  { codigo: "{hora}", descricao: "Hora atual", exemplo: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), icone: "🕐" },
];

// ========== COMPONENTE PRINCIPAL ==========

const WhatsApp = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [config, setConfig] = useState<WhatsAppConfig>({
    instancia_aniversario: '',
    mensagem_aniversario: 'Olá {primeiro_nome}, feliz aniversário! 🎉🎂 Desejamos um dia repleto de alegria e felicidade!',
    aniversario_ativo: false,
    tempo_minimo_aniversario: 1,
    tempo_maximo_aniversario: 3,
    instancia_demandas: '',
    mensagem_demandas: 'Olá {nome}, sua demanda "{titulo}" (protocolo {protocolo}) foi atualizada para: {status}. Obrigado por utilizar nossos serviços!',
    demandas_ativo: false,
    tempo_minimo_demandas: 1,
    tempo_maximo_demandas: 3,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
  const [aniversariantesSelecionados, setAniversariantesSelecionados] = useState<Set<string>>(new Set());
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [enviandoTesteDemanda, setEnviandoTesteDemanda] = useState(false);
  const [demandas, setDemandas] = useState<any[]>([]);
  const [demandaSelecionada, setDemandaSelecionada] = useState<string>('');
  const [showPreviewAniversario, setShowPreviewAniversario] = useState(false);
  const [showPreviewDemanda, setShowPreviewDemanda] = useState(false);
  const [activeTab, setActiveTab] = useState('aniversario');
  const textareaAniversarioRef = useRef<HTMLTextAreaElement>(null);
  const textareaDemandaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchInstances();
    fetchConfig();
    fetchAniversariantes();
    fetchDemandas();
  }, []);

  // ========== FETCH FUNCTIONS ==========

  const fetchInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, display_name, status, phone_number')
        .eq('active', true)
        .order('display_name');

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error);
      toast.error('Erro ao carregar instâncias do WhatsApp');
    }
  };

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'whatsapp_instancia_aniversario',
          'whatsapp_mensagem_aniversario',
          'whatsapp_aniversario_ativo',
          'whatsapp_tempo_minimo_aniversario',
          'whatsapp_tempo_maximo_aniversario',
          'whatsapp_instancia_demandas',
          'whatsapp_mensagem_demandas',
          'whatsapp_demandas_ativo',
          'whatsapp_tempo_minimo_demandas',
          'whatsapp_tempo_maximo_demandas',
        ]);

      if (error) throw error;

      const configMap = data?.reduce((acc, item) => {
        acc[item.chave] = item.valor;
        return acc;
      }, {} as Record<string, string>) || {};

      setConfig({
        instancia_aniversario: configMap.whatsapp_instancia_aniversario || '',
        mensagem_aniversario: configMap.whatsapp_mensagem_aniversario || 'Olá {primeiro_nome}, feliz aniversário! 🎉🎂 Desejamos um dia repleto de alegria e felicidade!',
        aniversario_ativo: configMap.whatsapp_aniversario_ativo === 'true',
        tempo_minimo_aniversario: parseInt(configMap.whatsapp_tempo_minimo_aniversario) || 1,
        tempo_maximo_aniversario: parseInt(configMap.whatsapp_tempo_maximo_aniversario) || 3,
        instancia_demandas: configMap.whatsapp_instancia_demandas || '',
        mensagem_demandas: configMap.whatsapp_mensagem_demandas || 'Olá {nome}, sua demanda "{titulo}" (protocolo {protocolo}) foi atualizada para: {status}. Obrigado por utilizar nossos serviços!',
        demandas_ativo: configMap.whatsapp_demandas_ativo === 'true',
        tempo_minimo_demandas: parseInt(configMap.whatsapp_tempo_minimo_demandas) || 1,
        tempo_maximo_demandas: parseInt(configMap.whatsapp_tempo_maximo_demandas) || 3,
      });
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const fetchDemandas = async () => {
    try {
      const { data, error } = await supabase
        .from('demandas')
        .select(`
          id,
          titulo,
          protocolo,
          municipes (nome, telefone, bairro)
        `)
        .not('municipes.telefone', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDemandas(data || []);
    } catch (error) {
      console.error('Erro ao buscar demandas:', error);
    }
  };

  const fetchAniversariantes = async () => {
    try {
      const hoje = new Date();
      const mes = hoje.getMonth() + 1;
      const dia = hoje.getDate();

      const { data, error } = await supabase
        .from('municipes')
        .select('id, nome, telefone, data_nascimento, bairro')
        .not('data_nascimento', 'is', null)
        .not('telefone', 'is', null);

      if (error) throw error;

      const aniversariantesHoje = (data || []).filter(municipe => {
        if (!municipe.data_nascimento) return false;
        const dataString = municipe.data_nascimento;
        const [, mesNasc, diaNasc] = dataString.split('-').map(Number);
        return mesNasc === mes && diaNasc === dia;
      });

      setAniversariantes(aniversariantesHoje);
      setAniversariantesSelecionados(new Set(aniversariantesHoje.map(a => a.id)));
    } catch (error) {
      console.error('Erro ao buscar aniversariantes:', error);
    }
  };

  // ========== ACTIONS ==========

  const saveConfig = async () => {
    setSaving(true);
    try {
      const configsToSave = [
        { chave: 'whatsapp_instancia_aniversario', valor: config.instancia_aniversario },
        { chave: 'whatsapp_mensagem_aniversario', valor: config.mensagem_aniversario },
        { chave: 'whatsapp_aniversario_ativo', valor: config.aniversario_ativo.toString() },
        { chave: 'whatsapp_tempo_minimo_aniversario', valor: config.tempo_minimo_aniversario.toString() },
        { chave: 'whatsapp_tempo_maximo_aniversario', valor: config.tempo_maximo_aniversario.toString() },
        { chave: 'whatsapp_instancia_demandas', valor: config.instancia_demandas },
        { chave: 'whatsapp_mensagem_demandas', valor: config.mensagem_demandas },
        { chave: 'whatsapp_demandas_ativo', valor: config.demandas_ativo.toString() },
        { chave: 'whatsapp_tempo_minimo_demandas', valor: config.tempo_minimo_demandas.toString() },
        { chave: 'whatsapp_tempo_maximo_demandas', valor: config.tempo_maximo_demandas.toString() },
      ];

      for (const configItem of configsToSave) {
        const { error } = await supabase
          .from('configuracoes')
          .upsert({
            chave: configItem.chave,
            valor: configItem.valor,
            descricao: `Configuração automática do WhatsApp - ${configItem.chave.replace('whatsapp_', '')}`
          }, { onConflict: 'chave' });

        if (error) throw error;
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  // ========== VARIÁVEIS ==========

  const inserirVariavel = (codigo: string, tipo: 'aniversario' | 'demandas') => {
    const textarea = tipo === 'aniversario' ? textareaAniversarioRef.current : textareaDemandaRef.current;
    const campo = tipo === 'aniversario' ? 'mensagem_aniversario' : 'mensagem_demandas';
    const valorAtual = config[campo];

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const novoValor = valorAtual.substring(0, start) + codigo + valorAtual.substring(end);
      setConfig(prev => ({ ...prev, [campo]: novoValor }));
      setTimeout(() => {
        textarea.focus();
        const newPos = start + codigo.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 10);
    } else {
      setConfig(prev => ({ ...prev, [campo]: valorAtual + codigo }));
    }
  };

  const previewMensagem = (template: string, tipo: 'aniversario' | 'demandas') => {
    const vars = tipo === 'aniversario' ? VARIAVEIS_ANIVERSARIO : VARIAVEIS_DEMANDAS;
    let preview = template;
    vars.forEach(v => {
      const regex = new RegExp(v.codigo.replace(/[{}]/g, '\\$&'), 'gi');
      preview = preview.replace(regex, v.exemplo);
    });
    return preview;
  };

  const temVariaveis = (texto: string) => /\{[^}]+\}/.test(texto);

  const contarVariaveis = (texto: string) => {
    const matches = texto.match(/\{[^}]+\}/g);
    return matches ? new Set(matches.map(m => m.toLowerCase())).size : 0;
  };

  // ========== MEDIA ==========

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        let type: MediaFile['type'] = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';
        setMediaFiles(prev => [...prev, { file, preview, type }]);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getMediaIcon = (type: MediaFile['type']) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <FileAudio className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // ========== ANIVERSARIANTES ==========

  const toggleAniversariante = (id: string) => {
    setAniversariantesSelecionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleTodosAniversariantes = () => {
    if (aniversariantesSelecionados.size === aniversariantes.length) {
      setAniversariantesSelecionados(new Set());
    } else {
      setAniversariantesSelecionados(new Set(aniversariantes.map(a => a.id)));
    }
  };

  const formatarData = (dataString: string) => {
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // ========== ENVIO TESTE ANIVERSÁRIO ==========

  const enviarMensagemTeste = async () => {
    if (!config.instancia_aniversario) {
      toast.error('Selecione uma instância primeiro');
      return;
    }
    if (aniversariantesSelecionados.size === 0) {
      toast.error('Selecione pelo menos um aniversariante');
      return;
    }

    setEnviandoTeste(true);
    try {
      const mediaData = await Promise.all(
        mediaFiles.map(async (mediaFile) => {
          const arrayBuffer = await mediaFile.file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64 = btoa(binary);
          return { filename: mediaFile.file.name, mimetype: mediaFile.file.type, data: base64 };
        })
      );

      const aniversariantesFiltrados = aniversariantes.filter(a =>
        aniversariantesSelecionados.has(a.id)
      );

      const telefones = aniversariantesFiltrados.map(a => ({
        id: a.id, nome: a.nome, telefone: a.telefone, bairro: a.bairro || ''
      }));

      const { data, error } = await supabase.functions.invoke('enviar-whatsapp-aniversario-completo', {
        body: {
          telefones,
          mensagem: config.mensagem_aniversario,
          instanceName: config.instancia_aniversario,
          tempoMinimo: config.tempo_minimo_aniversario || 2,
          tempoMaximo: config.tempo_maximo_aniversario || 4,
          mediaFiles: mediaData,
          teste: true
        }
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Erro na função');
      toast.success(`Teste enviado para ${aniversariantesSelecionados.size} aniversariante(s)!`);
    } catch (error: any) {
      console.error('Erro ao enviar teste:', error);
      toast.error(`Erro: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setEnviandoTeste(false);
    }
  };

  // ========== COMPUTED ==========

  const connectedInstances = instances.filter(i => i.status === 'connected');
  const disconnectedCount = instances.filter(i => i.status !== 'connected').length;

  // ========== RENDER HELPERS ==========

  const renderWhatsAppPreview = (template: string, tipo: 'aniversario' | 'demandas', contactName: string, contactIcon: React.ReactNode) => (
    <div className="relative rounded-xl overflow-hidden">
      <div className="bg-[#075e54] dark:bg-[#1f2c34] px-4 py-2.5 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
          {contactIcon}
        </div>
        <div>
          <p className="text-white text-sm font-medium">{contactName}</p>
          <p className="text-green-200 text-[10px]">online</p>
        </div>
      </div>
      <div className="bg-[#e5ddd5] dark:bg-[#0b141a] p-4 min-h-[140px]">
        <div className="flex justify-center mb-3">
          <span className="bg-white/80 dark:bg-[#182229] text-[10px] text-gray-500 dark:text-gray-400 px-3 py-1 rounded-md shadow-sm">
            HOJE
          </span>
        </div>
        <div className="max-w-[85%] ml-auto">
          <div className="bg-[#dcf8c6] dark:bg-[#005c4b] rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
            <p className="text-sm text-[#303030] dark:text-[#e9edef] whitespace-pre-wrap leading-relaxed">
              {previewMensagem(template, tipo)}
            </p>
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <svg className="w-4 h-3 text-[#53bdeb]" viewBox="0 0 16 11" fill="currentColor">
                <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.434.434 0 0 0-.329-.139.468.468 0 0 0-.34.161.449.449 0 0 0-.111.329.444.444 0 0 0 .131.32l2.396 2.396a.456.456 0 0 0 .329.139.501.501 0 0 0 .381-.178l6.5-8.014a.456.456 0 0 0 .102-.34.449.449 0 0 0-.173-.291z" />
                <path d="M14.757.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.434.434 0 0 0-.329-.139.468.468 0 0 0-.34.161.449.449 0 0 0-.111.329.444.444 0 0 0 .131.32l2.396 2.396a.456.456 0 0 0 .329.139.501.501 0 0 0 .381-.178l6.5-8.014a.456.456 0 0 0 .102-.34.449.449 0 0 0-.173-.291z" />
              </svg>
            </div>
          </div>
        </div>
        {tipo === 'aniversario' && mediaFiles.length > 0 && (
          <div className="max-w-[85%] ml-auto mt-1">
            <div className="bg-[#dcf8c6] dark:bg-[#005c4b] rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-[#667781]">
                <Paperclip className="h-3 w-3" />
                {mediaFiles.length} anexo(s)
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="absolute bottom-2 left-3">
        <Badge variant="secondary" className="text-[10px] gap-1 bg-black/40 text-white border-0 backdrop-blur-sm">
          <Eye className="h-3 w-3" />
          Prévia com dados de exemplo
        </Badge>
      </div>
    </div>
  );

  const renderVariaveis = (
    variaveis: typeof VARIAVEIS_ANIVERSARIO,
    tipo: 'aniversario' | 'demandas'
  ) => (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variáveis — clique para inserir</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
        {variaveis.map(v => (
          <TooltipProvider key={v.codigo}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all text-left group"
                  onClick={() => inserirVariavel(v.codigo, tipo)}
                >
                  <span className="text-sm">{v.icone}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">{v.descricao}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{v.codigo}</p>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Exemplo: <span className="font-medium">{v.exemplo}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );

  const renderTimingSlider = (
    label: string,
    description: string,
    min: number,
    max: number,
    onMinChange: (val: number) => void,
    onMaxChange: (val: number) => void
  ) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4 text-blue-500" />
          {label}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Mínimo</Label>
              <Badge variant="outline" className="text-xs font-mono tabular-nums">{min}s</Badge>
            </div>
            <Slider
              value={[min]}
              onValueChange={([val]) => {
                onMinChange(val);
                if (val > max) onMaxChange(val);
              }}
              min={1}
              max={30}
              step={1}
              className="cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Máximo</Label>
              <Badge variant="outline" className="text-xs font-mono tabular-nums">{max}s</Badge>
            </div>
            <Slider
              value={[max]}
              onValueChange={([val]) => {
                onMaxChange(val);
                if (val < min) onMinChange(val);
              }}
              min={1}
              max={60}
              step={1}
              className="cursor-pointer"
            />
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30">
          <p className="text-[11px] text-blue-600 dark:text-blue-400 text-center">
            Espera aleatória de <strong>{min}s</strong> a <strong>{max}s</strong> para simular envio natural
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // ========== LOADING ==========

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-green-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-green-500 animate-spin" />
              <MessageCircle className="absolute inset-0 m-auto h-5 w-5 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
      </div>
    );
  }

  // ========== RENDER ==========

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-6xl">

      {/* ============ HEADER ============ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-green-500 to-emerald-600 p-6 md:p-8 text-white shadow-xl shadow-green-500/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20">
              <MessageCircle className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">WhatsApp</h1>
              <p className="text-green-100 text-sm mt-0.5">Mensagens automáticas e configurações de envio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { fetchInstances(); fetchAniversariantes(); fetchDemandas(); }}
              className="gap-2 text-white/90 hover:text-white hover:bg-white/15 border border-white/20"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button
              onClick={saveConfig}
              disabled={saving}
              className="gap-2 bg-white text-green-700 hover:bg-white/90 font-semibold shadow-lg"
            >
              {saving ? (
                <><RefreshCw className="h-4 w-4 animate-spin" />Salvando...</>
              ) : (
                <><Save className="h-4 w-4" />Salvar Tudo</>
              )}
            </Button>
          </div>
        </div>
        {/* Status pills */}
        <div className="relative z-10 flex flex-wrap gap-2 mt-4">
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs border border-white/10">
            <div className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
            <span>{connectedInstances.length} instância(s) online</span>
          </div>
          {disconnectedCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-500/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs border border-red-300/20">
              <div className="h-1.5 w-1.5 rounded-full bg-red-300" />
              <span>{disconnectedCount} offline</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs border border-white/10">
            <Cake className="h-3 w-3" />
            <span>{aniversariantes.length} aniversariante(s) hoje</span>
          </div>
        </div>
      </div>

      {/* ============ INSTÂNCIAS ============ */}
      {instances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {instances.map((instance) => {
            const isConnected = instance.status === 'connected';
            return (
              <Card key={instance.id} className={`group transition-all duration-200 hover:shadow-md ${
                isConnected
                  ? 'border-green-200/60 dark:border-green-800/40 hover:border-green-300 dark:hover:border-green-700'
                  : 'border-red-200/40 dark:border-red-900/30 opacity-60'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`relative p-2.5 rounded-xl transition-colors ${
                      isConnected
                        ? 'bg-green-50 dark:bg-green-900/20 group-hover:bg-green-100 dark:group-hover:bg-green-900/30'
                        : 'bg-red-50 dark:bg-red-900/20'
                    }`}>
                      {isConnected ? (
                        <Wifi className="h-4 w-4 text-green-600" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-red-500" />
                      )}
                      {isConnected && (
                        <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{instance.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {instance.phone_number || instance.instance_name}
                      </p>
                    </div>
                    <Badge
                      variant={isConnected ? 'default' : 'destructive'}
                      className={`text-[10px] font-medium ${isConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100' : ''}`}
                    >
                      {isConnected ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {instances.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <WifiOff className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-base">Nenhuma instância configurada</p>
            <p className="text-sm text-muted-foreground mt-1">Configure uma instância na página de gerenciamento</p>
          </CardContent>
        </Card>
      )}

      {/* ============ TABS PRINCIPAIS ============ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <Zap className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold tracking-tight">Mensagens Automáticas</h2>
            <p className="text-xs text-muted-foreground">Configure mensagens personalizadas com variáveis dinâmicas</p>
          </div>
        </div>

        <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-xl">
          <TabsTrigger
            value="aniversario"
            className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all"
          >
            <Cake className="h-4 w-4" />
            <span className="font-medium">Aniversários</span>
            {config.aniversario_ativo && <div className="h-2 w-2 rounded-full bg-green-500" />}
          </TabsTrigger>
          <TabsTrigger
            value="demandas"
            className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all"
          >
            <FileText className="h-4 w-4" />
            <span className="font-medium">Demandas</span>
            {config.demandas_ativo && <div className="h-2 w-2 rounded-full bg-green-500" />}
          </TabsTrigger>
        </TabsList>

        {/* ========== ABA ANIVERSÁRIOS ========== */}
        <TabsContent value="aniversario" className="mt-4 space-y-4">

          {/* Status + Instância */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${config.aniversario_ativo ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                    <BellRing className={`h-4 w-4 ${config.aniversario_ativo ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">Envio Automático Diário</CardTitle>
                    <CardDescription className="text-xs">Mensagens enviadas às 10:00h para aniversariantes do dia</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={config.aniversario_ativo}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, aniversario_ativo: checked }))}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Phone className="h-3.5 w-3.5 text-green-600" />
                  Instância para Aniversários
                </Label>
                <Select
                  value={config.instancia_aniversario}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, instancia_aniversario: value }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.instance_name}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          {instance.display_name}
                          {instance.phone_number && <span className="text-xs text-muted-foreground">({instance.phone_number})</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {connectedInstances.length === 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1"><WifiOff className="h-3 w-3" />Nenhuma instância conectada</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Editor de Mensagem */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  Mensagem de Aniversário
                </CardTitle>
                <div className="flex items-center gap-2">
                  {temVariaveis(config.mensagem_aniversario) && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      {contarVariaveis(config.mensagem_aniversario)} variáve{contarVariaveis(config.mensagem_aniversario) > 1 ? 'is' : 'l'}
                    </Badge>
                  )}
                  <Button
                    variant={showPreviewAniversario ? "default" : "outline"}
                    size="sm"
                    className={`h-7 text-xs gap-1.5 ${showPreviewAniversario ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    onClick={() => setShowPreviewAniversario(prev => !prev)}
                  >
                    {showPreviewAniversario ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showPreviewAniversario ? 'Editar' : 'Prévia'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showPreviewAniversario ? (
                renderWhatsAppPreview(config.mensagem_aniversario, 'aniversario', 'Maria da Silva', <Cake className="h-4 w-4 text-white" />)
              ) : (
                <>
                  <Textarea
                    ref={textareaAniversarioRef as React.RefObject<HTMLTextAreaElement>}
                    value={config.mensagem_aniversario}
                    onChange={(e) => setConfig(prev => ({ ...prev, mensagem_aniversario: e.target.value }))}
                    placeholder="Olá {primeiro_nome}! 🎂🎉&#10;&#10;Hoje é seu dia especial!"
                    className="min-h-[130px] font-mono text-sm resize-none"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{config.mensagem_aniversario.length} caracteres</span>
                  </div>
                </>
              )}
              {!showPreviewAniversario && renderVariaveis(VARIAVEIS_ANIVERSARIO, 'aniversario')}
            </CardContent>
          </Card>

          {/* Timing + Mídias lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderTimingSlider(
              'Intervalo entre Envios',
              'Tempo de espera entre cada mensagem de aniversário',
              config.tempo_minimo_aniversario,
              config.tempo_maximo_aniversario,
              (val) => setConfig(prev => ({ ...prev, tempo_minimo_aniversario: val })),
              (val) => setConfig(prev => ({ ...prev, tempo_maximo_aniversario: val }))
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-purple-500" />
                  Mídias Anexas
                </CardTitle>
                <CardDescription className="text-xs">Imagens, vídeos, áudios ou documentos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer hover:border-green-400/60 hover:bg-green-50/30 dark:hover:bg-green-950/10 transition-all group">
                    <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors">
                      <Plus className="h-5 w-5 text-muted-foreground group-hover:text-green-600 transition-colors" />
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-green-600 transition-colors">Clique para adicionar</span>
                    <Input
                      type="file"
                      multiple
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {mediaFiles.length > 0 && (
                    <div className="space-y-1.5">
                      {mediaFiles.map((media, index) => (
                        <div key={index} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2 group hover:bg-muted/60 transition-colors">
                          <div className="p-1 rounded bg-background">{getMediaIcon(media.type)}</div>
                          <span className="flex-1 truncate text-xs font-medium">{media.file.name}</span>
                          <Badge variant="outline" className="text-[9px] uppercase">{media.type}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMediaFile(index)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aniversariantes do Dia */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-500" />
                    Aniversariantes de Hoje
                  </CardTitle>
                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-100">
                    {aniversariantes.length}
                  </Badge>
                </div>
                {aniversariantes.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={toggleTodosAniversariantes} className="h-8 text-xs gap-1.5">
                      {aniversariantesSelecionados.size === aniversariantes.length ? (
                        <><CheckSquare className="h-3.5 w-3.5" /> Desmarcar</>
                      ) : (
                        <><Square className="h-3.5 w-3.5" /> Marcar Todos</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={enviarMensagemTeste}
                      disabled={!config.instancia_aniversario || aniversariantesSelecionados.size === 0 || enviandoTeste}
                      className="h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700"
                    >
                      {enviandoTeste ? (
                        <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
                      ) : (
                        <><Send className="h-3.5 w-3.5" /> Enviar ({aniversariantesSelecionados.size})</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {aniversariantes.length === 0 ? (
                <div className="text-center py-8 rounded-xl bg-muted/20 border border-dashed">
                  <div className="inline-flex p-3 rounded-full bg-muted/50 mb-3">
                    <Cake className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhum aniversariante hoje</p>
                </div>
              ) : (
                <>
                  <ScrollArea className="h-52 rounded-lg border">
                    <div className="p-2 space-y-1">
                      {aniversariantes.map((a) => (
                        <div
                          key={a.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                            aniversariantesSelecionados.has(a.id)
                              ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 shadow-sm'
                              : 'hover:bg-muted/50 border border-transparent'
                          }`}
                          onClick={() => toggleAniversariante(a.id)}
                        >
                          <Checkbox checked={aniversariantesSelecionados.has(a.id)} className="pointer-events-none" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{a.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.telefone} • {formatarData(a.data_nascimento)}
                              {a.bairro && ` • ${a.bairro}`}
                            </p>
                          </div>
                          <span className="text-lg flex-shrink-0">🎂</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    {aniversariantesSelecionados.size} de {aniversariantes.length} selecionados
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ABA DEMANDAS ========== */}
        <TabsContent value="demandas" className="mt-4 space-y-4">

          {/* Status + Instância */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${config.demandas_ativo ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                    <Zap className={`h-4 w-4 ${config.demandas_ativo ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">Notificações de Demandas</CardTitle>
                    <CardDescription className="text-xs">Enviar mensagem automática quando o status de uma demanda mudar</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={config.demandas_ativo}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, demandas_ativo: checked }))}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Phone className="h-3.5 w-3.5 text-green-600" />
                  Instância para Demandas
                </Label>
                <Select
                  value={config.instancia_demandas}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, instancia_demandas: value }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.instance_name}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          {instance.display_name}
                          {instance.phone_number && <span className="text-xs text-muted-foreground">({instance.phone_number})</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {connectedInstances.length === 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1"><WifiOff className="h-3 w-3" />Nenhuma instância conectada</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Editor de Mensagem */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  Mensagem de Notificação
                </CardTitle>
                <div className="flex items-center gap-2">
                  {temVariaveis(config.mensagem_demandas) && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      {contarVariaveis(config.mensagem_demandas)} variáve{contarVariaveis(config.mensagem_demandas) > 1 ? 'is' : 'l'}
                    </Badge>
                  )}
                  <Button
                    variant={showPreviewDemanda ? "default" : "outline"}
                    size="sm"
                    className={`h-7 text-xs gap-1.5 ${showPreviewDemanda ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    onClick={() => setShowPreviewDemanda(prev => !prev)}
                  >
                    {showPreviewDemanda ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showPreviewDemanda ? 'Editar' : 'Prévia'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showPreviewDemanda ? (
                renderWhatsAppPreview(config.mensagem_demandas, 'demandas', 'João Santos', <FileText className="h-4 w-4 text-white" />)
              ) : (
                <>
                  <Textarea
                    ref={textareaDemandaRef as React.RefObject<HTMLTextAreaElement>}
                    value={config.mensagem_demandas}
                    onChange={(e) => setConfig(prev => ({ ...prev, mensagem_demandas: e.target.value }))}
                    placeholder='Olá {nome}! Sua demanda "{titulo}" foi atualizada para: {status}.'
                    className="min-h-[130px] font-mono text-sm resize-none"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{config.mensagem_demandas.length} caracteres</span>
                  </div>
                </>
              )}
              {!showPreviewDemanda && renderVariaveis(VARIAVEIS_DEMANDAS, 'demandas')}

              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200/50 dark:border-blue-800/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    A mensagem é enviada automaticamente sempre que o status de uma demanda for alterado.
                    O munícipe precisa ter telefone cadastrado para receber a notificação.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timing de Demandas */}
          {renderTimingSlider(
            'Intervalo entre Envios',
            'Tempo de espera entre envios quando múltiplas demandas são notificadas',
            config.tempo_minimo_demandas,
            config.tempo_maximo_demandas,
            (val) => setConfig(prev => ({ ...prev, tempo_minimo_demandas: val })),
            (val) => setConfig(prev => ({ ...prev, tempo_maximo_demandas: val }))
          )}

          {/* Teste de Notificação */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TestTube className="h-4 w-4 text-orange-500" />
                Teste de Notificação
              </CardTitle>
              <CardDescription className="text-xs">Selecione uma demanda para enviar uma mensagem de teste ao munícipe</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Demanda para teste</Label>
                  <Select value={demandaSelecionada} onValueChange={setDemandaSelecionada}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione uma demanda" />
                    </SelectTrigger>
                    <SelectContent>
                      {demandas.map((demanda) => {
                        const municipeData = demanda.municipes as any;
                        return (
                          <SelectItem key={demanda.id} value={demanda.id}>
                            <span className="text-xs">
                              #{demanda.protocolo} — {demanda.titulo}
                              {municipeData?.nome && ` (${municipeData.nome})`}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={async () => {
                    setEnviandoTesteDemanda(true);
                    try {
                      if (!demandaSelecionada) { toast.error('Selecione uma demanda'); return; }
                      const demandaEscolhida = demandas.find(d => d.id === demandaSelecionada);
                      if (!demandaEscolhida) { toast.error('Demanda não encontrada'); return; }
                      const municipeData = demandaEscolhida.municipes as any;
                      await supabase.functions.invoke('whatsapp-notificar-demanda', {
                        body: {
                          demanda_id: demandaEscolhida.id,
                          municipe_nome: municipeData.nome,
                          municipe_telefone: municipeData.telefone,
                          municipe_bairro: municipeData.bairro || '',
                          status: 'Em Andamento (TESTE)',
                          titulo_demanda: demandaEscolhida.titulo,
                          protocolo: demandaEscolhida.protocolo
                        }
                      });
                      toast.success(`Teste enviado para ${municipeData.nome}!`);
                    } catch (error) {
                      console.error('Erro:', error);
                      toast.error('Erro ao enviar teste');
                    } finally {
                      setEnviandoTesteDemanda(false);
                    }
                  }}
                  disabled={!config.instancia_demandas || !config.demandas_ativo || !demandaSelecionada || enviandoTesteDemanda}
                  className="gap-2 h-10 bg-green-600 hover:bg-green-700"
                >
                  {enviandoTesteDemanda ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Enviar Teste</>
                  )}
                </Button>
              </div>
              {demandas.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">Nenhuma demanda com telefone encontrada</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsApp;
