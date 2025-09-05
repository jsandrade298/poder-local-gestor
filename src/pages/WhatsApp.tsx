import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Cake, Settings, Send, Clock, Users, Paperclip, X, CheckSquare, Square, FileText, AlertCircle } from "lucide-react";
import { WhatsAppLogsViewer } from "@/components/WhatsAppLogsViewer";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  status: string;
}

interface Aniversariante {
  id: string;
  nome: string;
  telefone: string;
  data_nascimento: string;
}

interface WhatsAppConfig {
  instancia_aniversario: string;
  mensagem_aniversario: string;
  aniversario_ativo: boolean;
  instancia_demandas: string;
  mensagem_demandas: string;
  demandas_ativo: boolean;
}

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

const WhatsApp = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [config, setConfig] = useState<WhatsAppConfig>({
    instancia_aniversario: '',
    mensagem_aniversario: 'Olá {nome}, feliz aniversário! 🎉🎂 Desejamos um dia repleto de alegria e felicidade!',
    aniversario_ativo: false,
    instancia_demandas: '',
    mensagem_demandas: 'Olá {nome}, sua demanda foi atualizada para: {status}. Obrigado por utilizar nossos serviços!',
    demandas_ativo: false
  });
  const [loading, setLoading] = useState(true);
  const [demandaSelecionada, setDemandaSelecionada] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
  const [aniversariantesSelecionados, setAniversariantesSelecionados] = useState<Set<string>>(new Set());
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [enviandoTesteDemanda, setEnviandoTesteDemanda] = useState(false);
  const [demandas, setDemandas] = useState<any[]>([]);

  useEffect(() => {
    fetchInstances();
    fetchConfig();
    fetchAniversariantes();
    fetchDemandas();
  }, []);

  const fetchInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, display_name, status')
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
          'whatsapp_instancia_demandas',
          'whatsapp_mensagem_demandas',
          'whatsapp_demandas_ativo'
        ]);

      if (error) throw error;

      const configMap = data?.reduce((acc, item) => {
        acc[item.chave] = item.valor;
        return acc;
      }, {} as Record<string, string>) || {};

    setConfig({
      instancia_aniversario: configMap.whatsapp_instancia_aniversario || '',
      mensagem_aniversario: configMap.whatsapp_mensagem_aniversario || 'Olá {nome}, feliz aniversário! 🎉🎂 Desejamos um dia repleto de alegria e felicidade!',
      aniversario_ativo: configMap.whatsapp_aniversario_ativo === 'true',
      instancia_demandas: configMap.whatsapp_instancia_demandas || '',
      mensagem_demandas: configMap.whatsapp_mensagem_demandas || 'Olá {nome}, sua demanda foi atualizada para: {status}. Obrigado por utilizar nossos serviços!',
      demandas_ativo: configMap.whatsapp_demandas_ativo === 'true'
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
          municipes (nome, telefone)
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
        .select('id, nome, telefone, data_nascimento')
        .not('data_nascimento', 'is', null)
        .not('telefone', 'is', null);

      if (error) throw error;

      // Filtrar aniversariantes do dia
      const aniversariantesHoje = (data || []).filter(municipe => {
        if (!municipe.data_nascimento) return false;
        const dataNascimento = new Date(municipe.data_nascimento);
        return dataNascimento.getMonth() + 1 === mes && dataNascimento.getDate() === dia;
      });

      setAniversariantes(aniversariantesHoje);
      
      // Selecionar todos por padrão
      const todosIds = new Set(aniversariantesHoje.map(a => a.id));
      setAniversariantesSelecionados(todosIds);
    } catch (error) {
      console.error('Erro ao buscar aniversariantes:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const configsToSave = [
        { chave: 'whatsapp_instancia_aniversario', valor: config.instancia_aniversario },
        { chave: 'whatsapp_mensagem_aniversario', valor: config.mensagem_aniversario },
        { chave: 'whatsapp_aniversario_ativo', valor: config.aniversario_ativo.toString() },
        { chave: 'whatsapp_instancia_demandas', valor: config.instancia_demandas },
        { chave: 'whatsapp_mensagem_demandas', valor: config.mensagem_demandas },
        { chave: 'whatsapp_demandas_ativo', valor: config.demandas_ativo.toString() }
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        let type: 'image' | 'video' | 'audio' | 'document' = 'document';
        
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';
        
        setMediaFiles(prev => [...prev, { file, preview, type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAniversariante = (id: string) => {
    setAniversariantesSelecionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
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
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
  };

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
      // Preparar arquivos de mídia se houver
      const mediaData = await Promise.all(
        mediaFiles.map(async (mediaFile) => {
          const arrayBuffer = await mediaFile.file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64 = btoa(String.fromCharCode(...uint8Array));
          
          return {
            filename: mediaFile.file.name,
            mimetype: mediaFile.file.type,
            data: base64
          };
        })
      );

      // Filtrar aniversariantes selecionados
      const aniversariantesFiltrados = aniversariantes.filter(a => 
        aniversariantesSelecionados.has(a.id)
      );

      const telefones = aniversariantesFiltrados.map(a => ({
        id: a.id,
        nome: a.nome,
        telefone: a.telefone
      }));

      // Preparar mensagens personalizadas
      const customMessages: Record<string, string> = {};
      telefones.forEach(telefone => {
        const mensagemPersonalizada = config.mensagem_aniversario.replace('{nome}', telefone.nome);
        customMessages[telefone.telefone] = `[TESTE] ${mensagemPersonalizada}`;
      });

      const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          telefones,
          mensagem: 'Será personalizada',
          instanceName: config.instancia_aniversario,
          tempoMinimo: 2,
          tempoMaximo: 4,
          mediaFiles: mediaData,
          customMessages
        }
      });

      if (error) throw error;
      toast.success(`Mensagem de teste enviada para ${aniversariantesSelecionados.size} aniversariantes!`);
    } catch (error) {
      console.error('Erro ao enviar mensagem de teste:', error);
      toast.error('Erro ao enviar mensagem de teste');
    } finally {
      setEnviandoTeste(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-8 w-8 text-green-600" />
        <div>
          <h1 className="text-3xl font-bold">WhatsApp</h1>
          <p className="text-muted-foreground">Configure mensagens automáticas e instâncias</p>
        </div>
      </div>

      {/* Card de Status das Instâncias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Instâncias Disponíveis
          </CardTitle>
          <CardDescription>
            Instâncias do WhatsApp conectadas e disponíveis para envio
          </CardDescription>
        </CardHeader>
        <CardContent>
          {instances.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhuma instância do WhatsApp configurada
              </p>
              <Button variant="outline" className="mt-2" onClick={fetchInstances}>
                Atualizar
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {instances.map((instance) => (
                <div key={instance.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{instance.display_name}</p>
                    <p className="text-sm text-muted-foreground">{instance.instance_name}</p>
                  </div>
                  <Badge variant={instance.status === 'connected' ? 'default' : 'secondary'}>
                    {instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card de Configuração de Mensagens Automáticas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Mensagens Automáticas
          </CardTitle>
          <CardDescription>
            Configure mensagens automáticas para diferentes eventos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="aniversario" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="aniversario" className="flex items-center gap-2">
                <Cake className="h-4 w-4" />
                Aniversários
              </TabsTrigger>
              <TabsTrigger value="demandas" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Demandas
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            {/* Aba de Aniversários */}
            <TabsContent value="aniversario" className="space-y-6">
          {/* Switch para Ativar/Desativar Sistema Automático */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Sistema Automático</Label>
              <p className="text-sm text-muted-foreground">
                Ativar envio automático de mensagens de aniversário às 10:00h diariamente
              </p>
            </div>
            <Switch
              checked={config.aniversario_ativo}
              onCheckedChange={(checked) =>
                setConfig(prev => ({ ...prev, aniversario_ativo: checked }))
              }
            />
          </div>

          <Separator />

          {/* Lista de Aniversariantes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">Aniversariantes de Hoje</span>
                <Badge variant="secondary">{aniversariantes.length}</Badge>
              </div>
              {aniversariantes.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleTodosAniversariantes}
                    className="gap-2"
                  >
                    {aniversariantesSelecionados.size === aniversariantes.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {aniversariantesSelecionados.size === aniversariantes.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={enviarMensagemTeste}
                    disabled={!config.instancia_aniversario || aniversariantesSelecionados.size === 0 || enviandoTeste}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4 text-blue-600" />
                    {enviandoTeste ? 'Enviando...' : `Enviar Teste (${aniversariantesSelecionados.size})`}
                  </Button>
                </div>
              )}
            </div>

            {aniversariantes.length === 0 ? (
              <div className="text-center py-8 bg-muted/50 rounded-lg">
                <Cake className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum aniversariante hoje</p>
              </div>
            ) : (
              <ScrollArea className="h-80 border rounded-lg">
                <div className="p-3 space-y-2">
                  {aniversariantes.map((aniversariante) => (
                    <div
                      key={aniversariante.id}
                      className="flex items-center space-x-3 p-2.5 border rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={aniversariantesSelecionados.has(aniversariante.id)}
                        onCheckedChange={() => toggleAniversariante(aniversariante.id)}
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{aniversariante.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {aniversariante.telefone} • {formatarData(aniversariante.data_nascimento)}
                        </p>
                      </div>
                      <Badge variant="outline" className="flex-shrink-0 text-xs">
                        <Cake className="h-3 w-3 mr-1" />
                        Hoje
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            
            {aniversariantes.length > 0 && (
              <div className="text-xs text-muted-foreground text-center py-1">
                {aniversariantesSelecionados.size} de {aniversariantes.length} selecionados
              </div>
            )}
          </div>

          <Separator />

          {/* Seleção de Instância */}
          <div className="space-y-2">
            <Label htmlFor="instancia">Instância do WhatsApp</Label>
            <Select
              value={config.instancia_aniversario}
              onValueChange={(value) =>
                setConfig(prev => ({ ...prev, instancia_aniversario: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {instances
                  .filter(instance => instance.status === 'connected')
                  .map((instance) => (
                    <SelectItem key={instance.id} value={instance.instance_name}>
                      {instance.display_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {instances.filter(i => i.status === 'connected').length === 0 && (
              <p className="text-sm text-destructive">
                Nenhuma instância conectada disponível
              </p>
            )}
          </div>

          {/* Mensagem de Aniversário */}
          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem de Aniversário</Label>
            <Textarea
              id="mensagem"
              value={config.mensagem_aniversario}
              onChange={(e) =>
                setConfig(prev => ({ ...prev, mensagem_aniversario: e.target.value }))
              }
              placeholder="Digite a mensagem de aniversário..."
              className="min-h-24"
            />
            <div className="text-sm text-muted-foreground">
              <p>Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> para incluir o nome do aniversariante</p>
              <p className="mt-1">
                <strong>Exemplo:</strong> {config.mensagem_aniversario.replace('{nome}', 'João Silva')}
              </p>
            </div>
          </div>

          {/* Upload de Mídias */}
          <div className="space-y-2">
            <Label>Mídias (Opcional)</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
              <div className="text-center">
                <Paperclip className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Anexe imagens, vídeos, áudios ou documentos
                  </p>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Preview das mídias */}
            {mediaFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Mídias Selecionadas</Label>
                <ScrollArea className="h-32">
                  <div className="grid grid-cols-2 gap-2">
                    {mediaFiles.map((media, index) => (
                      <div key={index} className="relative group border rounded-lg p-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                            {media.type === 'image' && '🖼️'}
                            {media.type === 'video' && '🎥'}
                            {media.type === 'audio' && '🎵'}
                            {media.type === 'document' && '📄'}
                          </div>
                          <span className="truncate flex-1">{media.file.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMediaFile(index)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Informações sobre o Sistema Automático */}
          <div className="space-y-4">
            {config.aniversario_ativo ? (
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Sistema Automático Ativado</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Mensagens enviadas automaticamente todos os dias às 10:00h
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Sistema Automático Desativado</span>
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  Ative o sistema para enviar mensagens automaticamente todos os dias às 10:00h
                </p>
              </div>
            )}
            
            {/* Informações técnicas */}
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2 text-blue-700 dark:text-blue-300">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <span className="font-medium">Informações do Sistema</span>
                  <div className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                    <p>• Busca aniversariantes do dia atual baseado na data de nascimento</p>
                    <p>• Personaliza mensagens substituindo {'{nome}'} pelo nome do munícipe</p>
                    <p>• Use "Enviar Teste" para validar com munícipes aleatórios</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
            </TabsContent>

            {/* Aba de Demandas */}
            <TabsContent value="demandas" className="space-y-6">
              {/* Switch para Ativar/Desativar Demandas */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Notificações de Demandas</Label>
                  <p className="text-sm text-muted-foreground">
                    Enviar mensagens automaticamente quando o status de uma demanda for atualizado
                  </p>
                </div>
                <Switch
                  checked={config.demandas_ativo}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, demandas_ativo: checked }))
                  }
                />
              </div>

              <Separator />

              {/* Seleção de Instância para Demandas */}
              <div className="space-y-2">
                <Label htmlFor="instancia-demandas">Instância do WhatsApp</Label>
                <Select
                  value={config.instancia_demandas}
                  onValueChange={(value) =>
                    setConfig(prev => ({ ...prev, instancia_demandas: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances
                      .filter(instance => instance.status === 'connected')
                      .map((instance) => (
                        <SelectItem key={instance.id} value={instance.instance_name}>
                          {instance.display_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {instances.filter(i => i.status === 'connected').length === 0 && (
                  <p className="text-sm text-destructive">
                    Nenhuma instância conectada disponível
                  </p>
                )}
              </div>

              {/* Mensagem de Atualização de Demanda */}
              <div className="space-y-2">
                <Label htmlFor="mensagem-demandas">Mensagem de Atualização</Label>
                <Textarea
                  id="mensagem-demandas"
                  value={config.mensagem_demandas}
                  onChange={(e) =>
                    setConfig(prev => ({ ...prev, mensagem_demandas: e.target.value }))
                  }
                  placeholder="Digite a mensagem de atualização de demanda..."
                  className="min-h-24"
                />
                <div className="text-sm text-muted-foreground">
                  <p>Variáveis disponíveis:</p>
                  <ul className="mt-1 space-y-1">
                    <li>• <code className="bg-muted px-1 rounded">{'{nome}'}</code> - Nome do munícipe solicitante</li>
                    <li>• <code className="bg-muted px-1 rounded">{'{status}'}</code> - Novo status da demanda</li>
                  </ul>
                  <p className="mt-2">
                    <strong>Exemplo:</strong> {config.mensagem_demandas.replace('{nome}', 'João Silva').replace('{status}', 'Em Andamento')}
                  </p>
                </div>
              </div>

              {/* Informações sobre o funcionamento */}
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2 text-blue-700 dark:text-blue-300">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <span className="font-medium">Como funciona</span>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Sempre que o status de uma demanda for alterado no sistema, uma mensagem será enviada automaticamente 
                      para o telefone do munícipe solicitante informando sobre a atualização.
                    </p>
                  </div>
                </div>
              </div>

              {/* Seção de Teste */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-2">
                  <div className="h-px bg-border flex-1" />
                  <span className="text-sm text-muted-foreground font-medium">Teste de Notificação</span>
                  <div className="h-px bg-border flex-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Seletor de Demanda */}
                  <div className="space-y-2">
                    <Label htmlFor="demanda-teste">Demanda para Teste</Label>
                    <Select
                      value={demandaSelecionada}
                      onValueChange={setDemandaSelecionada}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma demanda" />
                      </SelectTrigger>
                      <SelectContent>
                        {demandas.map((demanda) => {
                          const municipeData = demanda.municipes as any;
                          return (
                            <SelectItem key={demanda.id} value={demanda.id}>
                              <div className="flex flex-col items-start">
                                <span className="font-medium">#{demanda.protocolo} - {demanda.titulo}</span>
                                <span className="text-xs text-muted-foreground">
                                  {municipeData?.nome} • {municipeData?.telefone}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Selecione uma demanda para enviar mensagem de teste
                    </p>
                    {demandas.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma demanda com telefone encontrada
                      </p>
                    )}
                  </div>

                  {/* Botão de Teste */}
                  <div className="space-y-2">
                    <Label>Ação</Label>
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        setEnviandoTesteDemanda(true);
                        try {
                          if (!demandaSelecionada) {
                            toast.error('Selecione uma demanda para teste');
                            return;
                          }

                          const demandaEscolhida = demandas.find(d => d.id === demandaSelecionada);
                          if (!demandaEscolhida) {
                            toast.error('Demanda não encontrada');
                            return;
                          }

                          const municipeData = demandaEscolhida.municipes as any;

                          await supabase.functions.invoke('whatsapp-notificar-demanda', {
                            body: {
                              demanda_id: demandaEscolhida.id,
                              municipe_nome: municipeData.nome,
                              municipe_telefone: municipeData.telefone,
                              status: 'Em Andamento (TESTE)',
                              titulo_demanda: demandaEscolhida.titulo,
                              protocolo: demandaEscolhida.protocolo
                            }
                          });

                          toast.success(`Notificação de teste enviada para ${municipeData.nome}!`);
                        } catch (error) {
                          console.error('Erro:', error);
                          toast.error('Erro ao enviar teste');
                        } finally {
                          setEnviandoTesteDemanda(false);
                        }
                      }}
                      disabled={!config.instancia_demandas || !config.demandas_ativo || !demandaSelecionada || enviandoTesteDemanda}
                      className="gap-2 w-full"
                    >
                      {enviandoTesteDemanda ? (
                        <>
                          <Clock className="h-4 w-4 animate-spin" />
                          Enviando Teste...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Testar Notificação
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Envia mensagem de teste para a demanda selecionada
                    </p>
                  </div>
                </div>
              </div>

              {config.demandas_ativo && (
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Sistema Ativado</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    As notificações de atualização de demandas estão ativas e serão enviadas automaticamente
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Aba de Histórico/Logs */}
            <TabsContent value="logs" className="space-y-6">
              <WhatsAppLogsViewer />
            </TabsContent>

            {/* Botões de Ação Globais */}
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={saveConfig} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsApp;