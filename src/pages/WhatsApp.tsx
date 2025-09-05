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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Cake, Settings, Send, Clock, Users } from "lucide-react";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  status: string;
}

interface WhatsAppConfig {
  instancia_aniversario: string;
  mensagem_aniversario: string;
  aniversario_ativo: boolean;
}

const WhatsApp = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [config, setConfig] = useState<WhatsAppConfig>({
    instancia_aniversario: '',
    mensagem_aniversario: 'Olá {nome}, feliz aniversário! 🎉🎂 Desejamos um dia repleto de alegria e felicidade!',
    aniversario_ativo: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aniversariantesHoje, setAniversariantesHoje] = useState<number>(0);

  useEffect(() => {
    fetchInstances();
    fetchConfig();
    fetchAniversariantesHoje();
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
        .in('chave', ['whatsapp_instancia_aniversario', 'whatsapp_mensagem_aniversario', 'whatsapp_aniversario_ativo']);

      if (error) throw error;

      const configMap = data?.reduce((acc, item) => {
        acc[item.chave] = item.valor;
        return acc;
      }, {} as Record<string, string>) || {};

      setConfig({
        instancia_aniversario: configMap.whatsapp_instancia_aniversario || '',
        mensagem_aniversario: configMap.whatsapp_mensagem_aniversario || 'Olá {nome}, feliz aniversário! 🎉🎂 Desejamos um dia repleto de alegria e felicidade!',
        aniversario_ativo: configMap.whatsapp_aniversario_ativo === 'true'
      });
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const fetchAniversariantesHoje = async () => {
    try {
      const hoje = new Date();
      const mes = hoje.getMonth() + 1;
      const dia = hoje.getDate();

      const { count, error } = await supabase
        .from('municipes')
        .select('*', { count: 'exact', head: true })
        .not('data_nascimento', 'is', null)
        .gte('data_nascimento', `1900-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`)
        .lt('data_nascimento', `2100-${mes.toString().padStart(2, '0')}-${(dia + 1).toString().padStart(2, '0')}`);

      if (error) throw error;
      setAniversariantesHoje(count || 0);
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
        { chave: 'whatsapp_aniversario_ativo', valor: config.aniversario_ativo.toString() }
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

  const enviarMensagemTeste = async () => {
    if (!config.instancia_aniversario) {
      toast.error('Selecione uma instância primeiro');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp-aniversario', {
        body: { teste: true }
      });

      if (error) throw error;
      toast.success('Mensagem de teste enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar mensagem de teste:', error);
      toast.error('Erro ao enviar mensagem de teste');
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

      {/* Card de Configuração de Aniversário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5" />
            Mensagens de Aniversário
          </CardTitle>
          <CardDescription>
            Configure mensagens automáticas para aniversariantes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status dos Aniversariantes de Hoje */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-medium">Aniversariantes de Hoje</span>
            </div>
            <p className="text-2xl font-bold text-primary">{aniversariantesHoje}</p>
            <p className="text-sm text-muted-foreground">
              {aniversariantesHoje === 1 ? 'pessoa faz' : 'pessoas fazem'} aniversário hoje
            </p>
          </div>

          <Separator />

          {/* Switch para Ativar/Desativar */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Mensagens Automáticas</Label>
              <p className="text-sm text-muted-foreground">
                Enviar mensagens de aniversário automaticamente todos os dias
              </p>
            </div>
            <Switch
              checked={config.aniversario_ativo}
              onCheckedChange={(checked) =>
                setConfig(prev => ({ ...prev, aniversario_ativo: checked }))
              }
            />
          </div>

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

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-4">
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
            <Button 
              variant="outline" 
              onClick={enviarMensagemTeste}
              disabled={!config.instancia_aniversario || aniversariantesHoje === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar Teste
            </Button>
          </div>

          {config.aniversario_ativo && (
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Sistema Ativado</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                As mensagens de aniversário serão enviadas automaticamente todos os dias às 9:00h
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsApp;