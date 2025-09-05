import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Calendar, Bell } from "lucide-react";

export default function ConfiguracoesWhatsApp() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState({
    whatsapp_instancia_aniversario: '',
    whatsapp_mensagem_aniversario: '',
    whatsapp_aniversario_ativo: 'true',
    whatsapp_instancia_demandas: '',
    whatsapp_mensagem_demandas: '',
    whatsapp_demandas_ativo: 'true'
  });

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', Object.keys(configs));

      if (error) throw error;

      const configMap = data.reduce((acc: any, item: any) => {
        acc[item.chave] = item.valor;
        return acc;
      }, {});

      setConfigs(prev => ({ ...prev, ...configMap }));
      console.log('Configurações carregadas:', configMap);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações",
        variant: "destructive",
      });
    }
  };

  const salvarConfiguracoes = async () => {
    setLoading(true);
    console.log('Salvando configurações:', configs);
    try {
      const updates = Object.entries(configs).map(([chave, valor]) => ({
        chave,
        valor,
        updated_at: new Date().toISOString()
      }));

      console.log('Updates a serem enviados:', updates);

      for (const update of updates) {
        const { data, error } = await supabase
          .from('configuracoes')
          .upsert(update, { onConflict: 'chave' });
        
        console.log(`Upsert para ${update.chave}:`, { data, error });
        
        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });
      
      // Recarregar configurações para confirmar que foram salvas
      await carregarConfiguracoes();
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testarAniversario = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp-aniversario', {
        body: { teste: true }
      });

      if (error) throw error;

      toast({
        title: "Teste enviado",
        description: "Mensagens de teste enviadas com sucesso",
      });
    } catch (error) {
      console.error('Erro ao testar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o teste",
        variant: "destructive",
      });
    }
  };

  const testarNotificacaoDemanda = async () => {
    try {
      // Verificar se as configurações estão ativas
      if (!configs.whatsapp_demandas_ativo || configs.whatsapp_demandas_ativo !== 'true') {
        toast({
          title: "Erro",
          description: "Ative as notificações de demanda antes de testar",
          variant: "destructive",
        });
        return;
      }

      if (!configs.whatsapp_instancia_demandas || !configs.whatsapp_mensagem_demandas) {
        toast({
          title: "Erro", 
          description: "Configure a instância e mensagem antes de testar",
          variant: "destructive",
        });
        return;
      }

      // Buscar um munícipe aleatório com telefone
      const { data: municipe } = await supabase
        .from('municipes')
        .select('nome, telefone')
        .not('telefone', 'is', null)
        .limit(1)
        .single();

      if (!municipe) {
        toast({
          title: "Erro",
          description: "Nenhum munícipe com telefone encontrado",
          variant: "destructive",
        });
        return;
      }

      // Enviar teste de notificação
      const { data, error } = await supabase.functions.invoke('notificar-demanda', {
        body: {
          demanda_id: 'teste-' + Date.now(),
          municipe_nome: municipe.nome,
          municipe_telefone: municipe.telefone,
          status: 'Em Andamento (TESTE)',
          instancia: configs.whatsapp_instancia_demandas,
          mensagem: configs.whatsapp_mensagem_demandas
        }
      });

      if (error) throw error;

      toast({
        title: "Teste enviado",
        description: `Mensagem de teste enviada para ${municipe.nome}`,
      });
    } catch (error) {
      console.error('Erro ao testar notificação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o teste",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Configurações WhatsApp</h1>
      </div>

      {/* Configurações de Aniversário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mensagens de Aniversário
          </CardTitle>
          <CardDescription>
            Configure o envio automático de mensagens de aniversário às 9h00 diariamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="aniversario-ativo"
              checked={configs.whatsapp_aniversario_ativo === 'true'}
              onCheckedChange={(checked) => 
                setConfigs(prev => ({ ...prev, whatsapp_aniversario_ativo: String(checked) }))
              }
            />
            <Label htmlFor="aniversario-ativo">Ativar envio automático</Label>
          </div>

          <div className="space-y-2">
            <Label>Instância WhatsApp</Label>
            <Input
              value={configs.whatsapp_instancia_aniversario}
              onChange={(e) => 
                setConfigs(prev => ({ ...prev, whatsapp_instancia_aniversario: e.target.value }))
              }
              placeholder="Nome da instância para aniversários"
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem de Aniversário</Label>
            <Textarea
              value={configs.whatsapp_mensagem_aniversario}
              onChange={(e) => 
                setConfigs(prev => ({ ...prev, whatsapp_mensagem_aniversario: e.target.value }))
              }
              placeholder="Use {nome} para personalizar"
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              Use {"{nome}"} para inserir o nome do aniversariante
            </p>
          </div>

          <Button onClick={testarAniversario} variant="outline">
            Enviar Teste (3 contatos aleatórios)
          </Button>
        </CardContent>
      </Card>

      {/* Configurações de Notificação de Demanda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações de Demandas
          </CardTitle>
          <CardDescription>
            Configure o envio automático quando o status de uma demanda mudar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="notificacao-ativo"
              checked={configs.whatsapp_demandas_ativo === 'true'}
              onCheckedChange={(checked) => 
                setConfigs(prev => ({ ...prev, whatsapp_demandas_ativo: String(checked) }))
              }
            />
            <Label htmlFor="notificacao-ativo">Ativar notificações automáticas</Label>
          </div>

          <div className="space-y-2">
            <Label>Instância WhatsApp</Label>
            <Input
              value={configs.whatsapp_instancia_demandas}
              onChange={(e) => 
                setConfigs(prev => ({ ...prev, whatsapp_instancia_demandas: e.target.value }))
              }
              placeholder="Nome da instância para notificações"
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem de Notificação</Label>
            <Textarea
              value={configs.whatsapp_mensagem_demandas}
              onChange={(e) => 
                setConfigs(prev => ({ ...prev, whatsapp_mensagem_demandas: e.target.value }))
              }
              placeholder="Use {nome} e {status} para personalizar"
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              Use {"{nome}"} para o nome e {"{status}"} para o novo status
            </p>
          </div>

          <Button onClick={testarNotificacaoDemanda} variant="outline">
            Enviar Teste de Notificação
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvarConfiguracoes} disabled={loading}>
          {loading ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}