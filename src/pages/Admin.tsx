import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  FileText, 
  MessageSquare, 
  Database, 
  Settings, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Server,
  Monitor
} from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const [isRunningHealthCheck, setIsRunningHealthCheck] = useState(false);

  // Buscar estatísticas do sistema
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { count: totalDemandas },
        { count: totalMunicipes },
        { count: totalWhatsappInstances }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('demandas').select('*', { count: 'exact', head: true }),
        supabase.from('municipes').select('*', { count: 'exact', head: true }),
        supabase.from('whatsapp_instances').select('*', { count: 'exact', head: true })
      ]);

      return {
        totalUsers: totalUsers || 0,
        totalDemandas: totalDemandas || 0,
        totalMunicipes: totalMunicipes || 0,
        totalWhatsappInstances: totalWhatsappInstances || 0
      };
    }
  });

  // Verificar saúde do sistema
  const runHealthCheck = async () => {
    setIsRunningHealthCheck(true);
    try {
      // Testar conexão com banco
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) throw error;
      
      toast.success("Sistema funcionando corretamente!");
    } catch (error) {
      toast.error("Problema detectado no sistema");
      console.error(error);
    } finally {
      setIsRunningHealthCheck(false);
    }
  };

  const statsCards = [
    {
      title: "Usuários Ativos",
      value: stats?.totalUsers || 0,
      icon: Users,
      description: "Total de usuários no sistema"
    },
    {
      title: "Demandas",
      value: stats?.totalDemandas || 0,
      icon: FileText,
      description: "Total de demandas registradas"
    },
    {
      title: "Munícipes",
      value: stats?.totalMunicipes || 0,
      icon: Users,
      description: "Total de munícipes cadastrados"
    },
    {
      title: "Instâncias WhatsApp",
      value: stats?.totalWhatsappInstances || 0,
      icon: MessageSquare,
      description: "Instâncias WhatsApp configuradas"
    }
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Administração do Sistema</h1>
              <p className="text-muted-foreground mt-2">
                Painel administrativo para monitoramento e gestão da plataforma
              </p>
            </div>
            <Badge variant="secondary" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Sistema Online
            </Badge>
          </div>
        </div>

        {/* Estatísticas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? "..." : stat.value.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs de Administração */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="system">Sistema</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
            <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Status do Sistema
                  </CardTitle>
                  <CardDescription>
                    Verificação da saúde geral da plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Banco de Dados</span>
                    <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                      Online
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">API WhatsApp</span>
                    <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                      Conectado
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Autenticação</span>
                    <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                      Funcionando
                    </Badge>
                  </div>
                  <Button 
                    onClick={runHealthCheck} 
                    disabled={isRunningHealthCheck}
                    className="w-full"
                  >
                    {isRunningHealthCheck ? "Verificando..." : "Executar Verificação"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Métricas de Uso
                  </CardTitle>
                  <CardDescription>
                    Estatísticas de utilização da plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Demandas Ativas</span>
                      <span className="font-medium">85%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full w-[85%]"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Usuários Ativos (30d)</span>
                      <span className="font-medium">92%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full w-[92%]"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Informações do Sistema
                </CardTitle>
                <CardDescription>
                  Detalhes técnicos da infraestrutura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Versão da Aplicação</span>
                    <p className="text-lg font-semibold">v2.1.0</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Ambiente</span>
                    <Badge variant="outline">Produção</Badge>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Última Atualização</span>
                    <p className="text-sm text-muted-foreground">
                      {new Date().toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Uptime</span>
                    <p className="text-sm text-muted-foreground">99.9%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Monitoramento em Tempo Real
                </CardTitle>
                <CardDescription>
                  Acompanhamento de performance e alertas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Dashboard de monitoramento em desenvolvimento
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Ferramentas de Manutenção
                </CardTitle>
                <CardDescription>
                  Operações administrativas e limpeza do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-start space-y-2">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      <span className="font-medium">Backup do Banco</span>
                    </div>
                    <span className="text-xs text-muted-foreground text-left">
                      Gerar backup completo dos dados
                    </span>
                  </Button>
                  
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-start space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">Limpeza de Logs</span>
                    </div>
                    <span className="text-xs text-muted-foreground text-left">
                      Remover logs antigos do sistema
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}