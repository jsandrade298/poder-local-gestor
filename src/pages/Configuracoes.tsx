import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, Building, Users, Settings, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { ConfigurarEvolutionDialog } from "@/components/forms/ConfigurarEvolutionDialog";
import { ConfiguracoesAvancadasDialog } from "@/components/forms/ConfiguracoesAvancadasDialog";

export default function Configuracoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const systemStatus = useSystemStatus();
  
  // Carregamento das configurações do banco
  const { data: configuracoes = [], isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  // Estado das configurações
  const [config, setConfig] = useState({
    // Dados do Gabinete
    gabinete: {
      nome: "",
      descricao: "",
      endereco: "",
      telefone: "",
      email: ""
    },
    
    // Configurações do Sistema
    sistema: {
      timezone: "America/Sao_Paulo",
      idioma: "pt-BR",
      formato_data: "DD/MM/AAAA",
      limite_upload_mb: 10
    }
  });

  // Carregar configurações do banco quando disponíveis
  useEffect(() => {
    if (configuracoes.length > 0) {
      const newConfig = {
        gabinete: {
          nome: "",
          descricao: "",
          endereco: "",
          telefone: "",
          email: ""
        },
        sistema: {
          timezone: "America/Sao_Paulo",
          idioma: "pt-BR",
          formato_data: "DD/MM/AAAA",
          limite_upload_mb: 10
        }
      };
      
      configuracoes.forEach((item) => {
        const [section, field] = item.chave.split('.');
        if (newConfig[section as keyof typeof newConfig] && field) {
          const sectionData = newConfig[section as keyof typeof newConfig] as any;
          if (field === 'limite_upload_mb') {
            sectionData[field] = parseInt(item.valor || '10');
          } else {
            sectionData[field] = item.valor || "";
          }
        }
      });
      
      setConfig(newConfig);
    }
  }, [configuracoes]);

  // Mutation para salvar configurações
  const saveConfigMutation = useMutation({
    mutationFn: async (configData: typeof config) => {
      const configEntries = [];
      
      // Converter o objeto de config em entradas para o banco
      Object.entries(configData).forEach(([section, sectionData]) => {
        Object.entries(sectionData).forEach(([field, value]) => {
          configEntries.push({
            chave: `${section}.${field}`,
            valor: String(value),
            descricao: getFieldDescription(section, field)
          });
        });
      });

      // Salvar cada configuração
      for (const entry of configEntries) {
        const { error } = await supabase
          .from('configuracoes')
          .upsert(entry, { 
            onConflict: 'chave',
            ignoreDuplicates: false 
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso.",
      });
    },
    onError: (error) => {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    saveConfigMutation.mutate(config);
  };

  // Função para obter descrição dos campos
  const getFieldDescription = (section: string, field: string): string => {
    const descriptions: Record<string, Record<string, string>> = {
      gabinete: {
        nome: "Nome oficial do gabinete",
        descricao: "Descrição da atuação do gabinete",
        endereco: "Endereço completo do gabinete",
        telefone: "Telefone oficial para contato",
        email: "Email oficial do gabinete"
      },
      sistema: {
        timezone: "Fuso horário do sistema",
        idioma: "Idioma padrão",
        formato_data: "Formato de exibição de datas",
        limite_upload_mb: "Limite máximo para upload de arquivos em MB"
      }
    };
    
    return descriptions[section]?.[field] || "";
  };

  const handleInputChange = (section: string, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Configurações do Sistema
          </h1>
          <p className="text-muted-foreground">
            Gerencie as configurações gerais do gabinete
          </p>
        </div>
        
        <div className="flex gap-2">
          <ConfiguracoesAvancadasDialog>
            <Button variant="outline">
              <Shield className="h-4 w-4 mr-2" />
              Configurações Avançadas
            </Button>
          </ConfiguracoesAvancadasDialog>
          
          <Button onClick={handleSave} disabled={saveConfigMutation.isPending || isLoadingConfigs}>
            <Save className="h-4 w-4 mr-2" />
            {saveConfigMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>

      {/* Status do Sistema */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Status do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Sistema</span>
              <Badge variant={systemStatus.sistema === 'online' ? 'default' : 'destructive'}>
                {systemStatus.sistema === 'online' ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Banco de Dados</span>
              <Badge variant={
                systemStatus.banco_dados === 'conectado' ? 'default' : 
                systemStatus.banco_dados === 'erro' ? 'destructive' : 'secondary'
              }>
                {systemStatus.banco_dados === 'conectado' ? 'Conectado' : 
                 systemStatus.banco_dados === 'erro' ? 'Erro' : 'Desconectado'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Última Atualização</span>
              <span className="text-sm text-muted-foreground">{systemStatus.ultima_atualizacao}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados do Gabinete */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building className="h-4 w-4" />
            Dados do Gabinete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome_gabinete">Nome do Gabinete</Label>
              <Input
                id="nome_gabinete"
                value={config.gabinete.nome}
                onChange={(e) => handleInputChange('gabinete', 'nome', e.target.value)}
                placeholder="Nome oficial do gabinete"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email_gabinete">Email Oficial</Label>
              <Input
                id="email_gabinete"
                type="email"
                value={config.gabinete.email}
                onChange={(e) => handleInputChange('gabinete', 'email', e.target.value)}
                placeholder="contato@gabinete.gov.br"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="descricao_gabinete">Descrição</Label>
            <Textarea
              id="descricao_gabinete"
              value={config.gabinete.descricao}
              onChange={(e) => handleInputChange('gabinete', 'descricao', e.target.value)}
              placeholder="Breve descrição da atuação do gabinete"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endereco_gabinete">Endereço</Label>
              <Input
                id="endereco_gabinete"
                value={config.gabinete.endereco}
                onChange={(e) => handleInputChange('gabinete', 'endereco', e.target.value)}
                placeholder="Endereço completo"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="telefone_gabinete">Telefone</Label>
              <Input
                id="telefone_gabinete"
                value={config.gabinete.telefone}
                onChange={(e) => handleInputChange('gabinete', 'telefone', e.target.value)}
                placeholder="(11) 3333-4444"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações do Sistema */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Configurações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Fuso Horário</Label>
              <select 
                id="timezone"
                className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                value={config.sistema.timezone}
                onChange={(e) => handleInputChange('sistema', 'timezone', e.target.value)}
              >
                <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                <option value="America/Manaus">Manaus (GMT-4)</option>
                <option value="America/Rio_Branco">Acre (GMT-5)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="limite_upload">Limite Upload (MB)</Label>
              <Input
                id="limite_upload"
                type="number"
                value={config.sistema.limite_upload_mb}
                onChange={(e) => handleInputChange('sistema', 'limite_upload_mb', e.target.value)}
                min="1"
                max="100"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="formato_data">Formato de Data</Label>
              <select 
                id="formato_data"
                className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                value={config.sistema.formato_data}
                onChange={(e) => handleInputChange('sistema', 'formato_data', e.target.value)}
              >
                <option value="DD/MM/AAAA">DD/MM/AAAA</option>
                <option value="MM/DD/AAAA">MM/DD/AAAA</option>
                <option value="AAAA-MM-DD">AAAA-MM-DD</option>
              </select>
            </div>
          </div>
          
          <Separator />
          
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <div>
                <h4 className="text-sm font-medium text-foreground">Backup Automático Ativo</h4>
                <p className="text-xs text-muted-foreground">
                  Sistema configurado para backup diário automático às 03:00
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrações WhatsApp */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Integrações WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure suas instâncias do WhatsApp para envio de mensagens automáticas
            </p>
            <ConfigurarEvolutionDialog>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Configurar WhatsApp
              </Button>
            </ConfigurarEvolutionDialog>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Salvar Final */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveConfigMutation.isPending || isLoadingConfigs} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saveConfigMutation.isPending ? "Salvando..." : "Salvar Todas as Configurações"}
        </Button>
      </div>
    </div>
  );
}