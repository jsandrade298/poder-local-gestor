import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Database, MessageSquare, Bot, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface ConfiguracoesAvancadasProps {
  children: React.ReactNode;
}

export function ConfiguracoesAvancadasDialog({ children }: ConfiguracoesAvancadasProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Estado das configurações avançadas
  const [config, setConfig] = useState({
    supabase: {
      url: "",
      anon_key: "",
      service_role_key: ""
    },
    evolution: {
      api_url: "",
      api_key: ""
    },
    openai: {
      api_key: ""
    }
  });

  // Carregamento das configurações do banco
  const { data: configuracoes = [], isLoading } = useQuery({
    queryKey: ['configuracoes-avancadas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .in('chave', [
          'supabase.url', 'supabase.anon_key', 'supabase.service_role_key',
          'evolution.api_url', 'evolution.api_key',
          'openai.api_key'
        ]);
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Atualizar estado quando configurações carregarem
  useEffect(() => {
    if (configuracoes.length > 0) {
      const newConfig = { ...config };
      
      configuracoes.forEach((item) => {
        const [section, field] = item.chave.split('.');
        if (newConfig[section as keyof typeof newConfig] && field) {
          const sectionData = newConfig[section as keyof typeof newConfig] as any;
          sectionData[field] = item.valor || "";
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
      queryClient.invalidateQueries({ queryKey: ['configuracoes-avancadas'] });
      toast({
        title: "Configurações salvas",
        description: "As configurações avançadas foram atualizadas com sucesso.",
      });
      setOpen(false);
    },
    onError: (error) => {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações avançadas.",
        variant: "destructive"
      });
    }
  });

  const getFieldDescription = (section: string, field: string): string => {
    const descriptions: Record<string, Record<string, string>> = {
      supabase: {
        url: "URL do projeto Supabase",
        anon_key: "Chave pública do Supabase (anon)",
        service_role_key: "Chave de serviço do Supabase (service_role)"
      },
      evolution: {
        api_url: "URL da API Evolution",
        api_key: "Chave da API Evolution"
      },
      openai: {
        api_key: "Chave da API OpenAI/ChatGPT"
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

  const handleSave = () => {
    saveConfigMutation.mutate(config);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Configurações Avançadas
          </DialogTitle>
          <DialogDescription>
            Configure as integrações independentes para cada hospedagem. Essas configurações permitem que cada cliente tenha seu próprio banco de dados, WhatsApp e IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Configurações Supabase */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Supabase Database
              </CardTitle>
              <CardDescription>
                Configure a conexão com o banco de dados Supabase independente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supabase_url">URL do Projeto</Label>
                <Input
                  id="supabase_url"
                  value={config.supabase.url}
                  onChange={(e) => handleInputChange('supabase', 'url', e.target.value)}
                  placeholder="https://xxxxxxxxx.supabase.co"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="supabase_anon">Chave Pública (anon)</Label>
                <Input
                  id="supabase_anon"
                  type="password"
                  value={config.supabase.anon_key}
                  onChange={(e) => handleInputChange('supabase', 'anon_key', e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="supabase_service">Chave de Serviço (service_role)</Label>
                <Input
                  id="supabase_service"
                  type="password"
                  value={config.supabase.service_role_key}
                  onChange={(e) => handleInputChange('supabase', 'service_role_key', e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Configurações Evolution API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                Evolution API (WhatsApp)
              </CardTitle>
              <CardDescription>
                Configure a conexão com a API Evolution para WhatsApp independente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evolution_url">URL da API</Label>
                <Input
                  id="evolution_url"
                  value={config.evolution.api_url}
                  onChange={(e) => handleInputChange('evolution', 'api_url', e.target.value)}
                  placeholder="https://evolution-api.exemplo.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="evolution_key">Chave da API</Label>
                <Input
                  id="evolution_key"
                  type="password"
                  value={config.evolution.api_key}
                  onChange={(e) => handleInputChange('evolution', 'api_key', e.target.value)}
                  placeholder="sua-chave-da-evolution-api"
                />
              </div>
            </CardContent>
          </Card>

          {/* Configurações OpenAI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5" />
                OpenAI (ChatGPT)
              </CardTitle>
              <CardDescription>
                Configure a chave da API OpenAI para o assistente IA independente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai_key">Chave da API OpenAI</Label>
                <Input
                  id="openai_key"
                  type="password"
                  value={config.openai.api_key}
                  onChange={(e) => handleInputChange('openai', 'api_key', e.target.value)}
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
            </CardContent>
          </Card>

          {/* Aviso de Segurança */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Informações Sensíveis
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Essas configurações contêm informações sensíveis e serão armazenadas de forma segura. 
                  Certifique-se de usar chaves válidas e mantenha-as sempre atualizadas.
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveConfigMutation.isPending || isLoading}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveConfigMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}