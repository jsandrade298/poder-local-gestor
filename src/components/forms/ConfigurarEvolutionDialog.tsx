import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Smartphone, QrCode, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InstanceStatus {
  instanceName: string;
  status: 'connected' | 'disconnected' | 'connecting';
  profileName?: string;
  number?: string;
}

export function ConfigurarEvolutionDialog() {
  const [open, setOpen] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [instances, setInstances] = useState<InstanceStatus[]>([]);
  const [qrCode, setQrCode] = useState("");
  const [loading, setLoading] = useState(false);

  const criarInstancia = async () => {
    if (!instanceName.trim()) {
      toast({
        title: "Nome da instância obrigatório",
        description: "Digite um nome para a instância",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("configurar-evolution", {
        body: { 
          action: "create_instance",
          instanceName: instanceName.trim()
        },
      });

      if (error) throw error;

      toast({
        title: "Instância criada!",
        description: `Instância ${instanceName} criada com sucesso`,
      });

      // Limpar o campo e buscar instâncias atualizadas
      setInstanceName("");
      buscarInstancias();
    } catch (error: any) {
      toast({
        title: "Erro ao criar instância",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const conectarInstancia = async (instance: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("configurar-evolution", {
        body: { 
          action: "connect_instance",
          instanceName: instance
        },
      });

      if (error) throw error;

      if (data.qrCode) {
        setQrCode(data.qrCode);
        toast({
          title: "QR Code gerado!",
          description: "Escaneie com o WhatsApp para conectar",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const buscarInstancias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("configurar-evolution", {
        body: { action: "list_instances" },
      });

      if (error) throw error;

      setInstances(data.instances || []);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar instâncias",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verificarStatus = async (instance: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("configurar-evolution", {
        body: { 
          action: "instance_status",
          instanceName: instance
        },
      });

      if (error) throw error;

      // Atualizar o status da instância
      setInstances(prev => prev.map(inst => 
        inst.instanceName === instance 
          ? { ...inst, ...data.status }
          : inst
      ));
    } catch (error: any) {
      console.error("Erro ao verificar status:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4" />;
      case 'connecting': return <QrCode className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={buscarInstancias}>
          <Settings className="h-4 w-4 mr-2" />
          Configurar Evolution API
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Evolution API</DialogTitle>
          <DialogDescription>
            Configure suas instâncias do WhatsApp para envio de mensagens
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Criar Nova Instância */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Smartphone className="h-5 w-5 mr-2" />
                Nova Instância
              </CardTitle>
              <CardDescription>
                Crie uma nova instância do WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="instanceName">Nome da Instância</Label>
                <Input
                  id="instanceName"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="ex: whatsapp-principal"
                  onKeyPress={(e) => e.key === 'Enter' && criarInstancia()}
                />
              </div>
              <Button 
                onClick={criarInstancia} 
                disabled={loading || !instanceName.trim()}
                className="w-full"
              >
                {loading ? "Criando..." : "Criar Instância"}
              </Button>
            </CardContent>
          </Card>

          {/* QR Code */}
          {qrCode && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <QrCode className="h-5 w-5 mr-2" />
                  QR Code
                </CardTitle>
                <CardDescription>
                  Escaneie com o WhatsApp para conectar
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div className="bg-white p-4 rounded-lg">
                  <img 
                    src={qrCode} 
                    alt="QR Code WhatsApp" 
                    className="max-w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Lista de Instâncias */}
        <Card>
          <CardHeader>
            <CardTitle>Instâncias Ativas</CardTitle>
            <CardDescription>
              Gerencie suas instâncias do WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            {instances.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma instância encontrada. Crie uma nova instância para começar.
              </p>
            ) : (
              <div className="space-y-3">
                {instances.map((instance) => (
                  <div 
                    key={instance.instanceName}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(instance.status)}
                        <span className="font-medium">{instance.instanceName}</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`${getStatusColor(instance.status)} text-white`}
                      >
                        {instance.status}
                      </Badge>
                      {instance.profileName && (
                        <span className="text-sm text-muted-foreground">
                          {instance.profileName}
                        </span>
                      )}
                      {instance.number && (
                        <span className="text-sm text-muted-foreground">
                          {instance.number}
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => verificarStatus(instance.instanceName)}
                        disabled={loading}
                      >
                        Verificar
                      </Button>
                      {instance.status !== 'connected' && (
                        <Button
                          size="sm"
                          onClick={() => conectarInstancia(instance.instanceName)}
                          disabled={loading}
                        >
                          Conectar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}