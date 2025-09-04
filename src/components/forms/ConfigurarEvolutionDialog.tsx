import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Smartphone, CheckCircle, XCircle, QrCode, Settings, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  status: string;
  profile_name?: string;
  phone_number?: string;
  qr_code?: string;
  last_connected_at?: string;
  active: boolean;
}

export function ConfigurarEvolutionDialog({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [qrCode, setQrCode] = useState("");
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState<string[]>([]);

  const fetchInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('active', true)
        .order('instance_name');

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar as instâncias",
      });
    }
  };

  const verificarStatusInstancia = async (instanceName: string) => {
    setChecking(prev => [...prev, instanceName]);
    
    try {
      const { data, error } = await supabase.functions.invoke('configurar-evolution', {
        body: { 
          action: 'instance_status',
          instanceName: instanceName
        }
      });

      let status = 'disconnected';
      let profileName = null;
      let phoneNumber = null;

      if (!error && !data?.error) {
        if (data?.status === 'open' || data?.status === 'connected') {
          status = 'connected';
          profileName = data?.profileName;
          phoneNumber = data?.phoneNumber;
        }
      }

      // Atualizar no banco
      await supabase
        .from('whatsapp_instances')
        .update({
          status,
          profile_name: profileName,
          phone_number: phoneNumber,
          last_connected_at: status === 'connected' ? new Date().toISOString() : null
        })
        .eq('instance_name', instanceName);

      // Atualizar estado local
      setInstances(prev => prev.map(inst => 
        inst.instance_name === instanceName 
          ? { ...inst, status, profile_name: profileName, phone_number: phoneNumber }
          : inst
      ));

    } catch (error) {
      console.error('Erro ao verificar status:', error);
    } finally {
      setChecking(prev => prev.filter(name => name !== instanceName));
    }
  };

  const conectarInstancia = async (instanceName: string) => {
    setLoading(true);
    setQrCode("");
    setSelectedInstance(instanceName);
    
    try {
      const { data, error } = await supabase.functions.invoke('configurar-evolution', {
        body: { 
          action: 'connect_instance',
          instanceName: instanceName
        }
      });

      if (error) {
        console.error('Erro ao conectar instância:', error);
        toast({
          variant: "destructive",
          title: "Erro ao conectar",
          description: error.message || "Erro desconhecido",
        });
        return;
      }

      if (data?.error) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data.error,
        });
        return;
      }

      if (data?.qrcode) {
        setQrCode(data.qrcode);
        
        // Salvar QR code no banco
        await supabase
          .from('whatsapp_instances')
          .update({ qr_code: data.qrcode })
          .eq('instance_name', instanceName);

        toast({
          title: "QR Code gerado",
          description: "Escaneie o QR Code com seu WhatsApp para conectar",
        });
        
        // Verificar status periodicamente após gerar QR
        const interval = setInterval(() => {
          verificarStatusInstancia(instanceName);
        }, 3000);
        
        // Parar verificação após 2 minutos
        setTimeout(() => clearInterval(interval), 120000);
      }
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao comunicar com o servidor",
      });
    } finally {
      setLoading(false);
    }
  };

  const verificarTodasInstancias = async () => {
    for (const instance of instances) {
      await verificarStatusInstancia(instance.instance_name);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInstances();
    }
  }, [isOpen]);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'connected':
        return {
          icon: CheckCircle,
          text: 'Conectado',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          variant: 'default' as const
        };
      case 'disconnected':
        return {
          icon: XCircle,
          text: 'Desconectado',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          variant: 'destructive' as const
        };
      default:
        return {
          icon: Loader2,
          text: 'Verificando...',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          variant: 'secondary' as const
        };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Gerenciar Instâncias WhatsApp
          </DialogTitle>
        </DialogHeader>

        {/* Cabeçalho com botão de atualização */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Gerencie as conexões WhatsApp do gabinete
          </p>
          <Button
            onClick={verificarTodasInstancias}
            variant="outline"
            size="sm"
            disabled={checking.length > 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checking.length > 0 ? 'animate-spin' : ''}`} />
            Verificar Todas
          </Button>
        </div>

        {/* Lista de Instâncias */}
        {qrCode && selectedInstance && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code - {instances.find(i => i.instance_name === selectedInstance)?.display_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="flex justify-center">
                <img 
                  src={qrCode} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64 border-2 border-gray-200 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Como conectar:</h4>
                <ol className="text-sm text-muted-foreground text-left space-y-1">
                  <li>1. Abra o WhatsApp no seu celular</li>
                  <li>2. Vá em <strong>Menu</strong> → <strong>Dispositivos conectados</strong></li>
                  <li>3. Toque em <strong>"Conectar um dispositivo"</strong></li>
                  <li>4. Escaneie este QR Code</li>
                </ol>
              </div>
              <Button 
                onClick={() => {
                  setQrCode("");
                  setSelectedInstance("");
                }} 
                variant="outline"
                size="sm"
              >
                Fechar QR Code
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Lista de Instâncias */}
        <div className="grid gap-4">
          {instances.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Nenhuma instância encontrada. Entre em contato com o administrador.
                </p>
              </CardContent>
            </Card>
          ) : (
            instances.map((instance) => {
              const statusDisplay = getStatusDisplay(instance.status);
              const StatusIcon = statusDisplay.icon;
              const isCheckingThis = checking.includes(instance.instance_name);
              
              return (
                <Card key={instance.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${statusDisplay.bgColor}`}>
                          <StatusIcon className={`h-5 w-5 ${statusDisplay.color} ${isCheckingThis ? 'animate-spin' : ''}`} />
                        </div>
                        
                        <div>
                          <h3 className="font-medium">{instance.display_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {instance.instance_name}
                          </p>
                          {instance.profile_name && (
                            <p className="text-sm text-green-600">
                              Perfil: {instance.profile_name}
                            </p>
                          )}
                          {instance.phone_number && (
                            <p className="text-sm text-muted-foreground">
                              Número: {instance.phone_number}
                            </p>
                          )}
                          {instance.last_connected_at && (
                            <p className="text-xs text-muted-foreground">
                              Última conexão: {new Date(instance.last_connected_at).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                        
                        <Badge variant={statusDisplay.variant}>
                          {statusDisplay.text}
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => verificarStatusInstancia(instance.instance_name)}
                          variant="outline"
                          size="sm"
                          disabled={isCheckingThis}
                        >
                          {isCheckingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Verificar'
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => conectarInstancia(instance.instance_name)}
                          size="sm"
                          disabled={loading || isCheckingThis}
                        >
                          {loading && selectedInstance === instance.instance_name ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Conectando...
                            </>
                          ) : (
                            <>
                              <QrCode className="mr-2 h-4 w-4" />
                              {instance.status === 'connected' ? 'Reconectar' : 'Conectar'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}