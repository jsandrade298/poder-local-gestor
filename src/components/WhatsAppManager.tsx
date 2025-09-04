import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QrCode, Smartphone, CheckCircle, XCircle, RefreshCw, Loader, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WhatsAppInstance {
  name: string;
  displayName: string;
  status: 'connected' | 'disconnected' | 'connecting';
}

export function WhatsAppManager() {
  const { toast } = useToast();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([
    { name: 'gabinete-whats-01', displayName: 'WhatsApp Principal', status: 'disconnected' },
    { name: 'gabinete-whats-02', displayName: 'WhatsApp Secundário', status: 'disconnected' },
    { name: 'gabinete-whats-03', displayName: 'WhatsApp Terceiro', status: 'disconnected' }
  ]);
  
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [currentInstance, setCurrentInstance] = useState<string>('');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [showQRModal, setShowQRModal] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Form para enviar mensagem
  const [messageForm, setMessageForm] = useState({
    instance: '',
    phone: '',
    message: ''
  });

  const callEdgeFunction = async (action: string, instanceName?: string, additionalData?: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('configurar-evolution', {
        body: { action, instanceName, ...additionalData }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro na Edge Function:', error);
      throw error;
    }
  };

  const checkAllInstances = async () => {
    try {
      const result = await callEdgeFunction('list_instances');
      if (result?.instances) {
        setInstances(result.instances.map((inst: any) => ({
          name: inst.instanceName,
          displayName: inst.displayName,
          status: inst.status === 'connected' ? 'connected' : 'disconnected'
        })));
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar as instâncias',
        variant: 'destructive'
      });
    }
  };

  const checkInstanceStatus = async (instanceName: string) => {
    try {
      const result = await callEdgeFunction('instance_status', instanceName);
      return result?.status === 'connected';
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return false;
    }
  };

  const connectInstance = async (instanceName: string) => {
    setLoading(prev => ({ ...prev, [`connect-${instanceName}`]: true }));
    
    try {
      const result = await callEdgeFunction('connect_instance', instanceName);
      
      if (result?.status === 'connected') {
        setInstances(prev => prev.map(inst => 
          inst.name === instanceName 
            ? { ...inst, status: 'connected' }
            : inst
        ));
        
        toast({
          title: 'Conectado',
          description: 'WhatsApp já está conectado!'
        });
      } else if (result?.qrcode) {
        setQrCodeData(result.qrcode);
        setCurrentInstance(instanceName);
        setShowQRModal(true);
        
        // Iniciar polling
        startPolling(instanceName);
      } else if (result?.pairingCode) {
        toast({
          title: 'Código de Pareamento',
          description: `Use este código no WhatsApp: ${result.pairingCode}`,
        });
      } else {
        throw new Error('Não foi possível obter o QR Code');
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao conectar',
        description: error.message || 'Verifique a configuração',
        variant: 'destructive'
      });
    } finally {
      setLoading(prev => ({ ...prev, [`connect-${instanceName}`]: false }));
    }
  };

  const startPolling = (instanceName: string) => {
    // Limpar polling anterior se existir
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const interval = setInterval(async () => {
      const isConnected = await checkInstanceStatus(instanceName);
      
      if (isConnected) {
        setInstances(prev => prev.map(inst => 
          inst.name === instanceName 
            ? { ...inst, status: 'connected' }
            : inst
        ));
        
        setShowQRModal(false);
        setQrCodeData('');
        setCurrentInstance('');
        
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        toast({
          title: 'Sucesso!',
          description: 'WhatsApp conectado com sucesso'
        });
      }
    }, 3000);

    setPollingInterval(interval);

    // Parar após 2 minutos
    setTimeout(() => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }, 120000);
  };

  const disconnectInstance = async (instanceName: string) => {
    setLoading(prev => ({ ...prev, [`disconnect-${instanceName}`]: true }));
    
    try {
      await callEdgeFunction('disconnect_instance', instanceName);
      
      setInstances(prev => prev.map(inst => 
        inst.name === instanceName 
          ? { ...inst, status: 'disconnected' }
          : inst
      ));
      
      toast({
        title: 'Desconectado',
        description: 'WhatsApp desconectado com sucesso'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível desconectar',
        variant: 'destructive'
      });
    } finally {
      setLoading(prev => ({ ...prev, [`disconnect-${instanceName}`]: false }));
    }
  };

  const sendMessage = async () => {
    if (!messageForm.instance || !messageForm.phone || !messageForm.message) {
      toast({
        title: 'Atenção',
        description: 'Preencha todos os campos',
        variant: 'destructive'
      });
      return;
    }

    setLoading(prev => ({ ...prev, 'send': true }));
    
    try {
      await callEdgeFunction('send_message', messageForm.instance, {
        phone: messageForm.phone,
        message: messageForm.message
      });
      
      toast({
        title: 'Enviado!',
        description: 'Mensagem enviada com sucesso'
      });
      
      setMessageForm({ instance: '', phone: '', message: '' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a mensagem',
        variant: 'destructive'
      });
    } finally {
      setLoading(prev => ({ ...prev, 'send': false }));
    }
  };

  useEffect(() => {
    checkAllInstances();
    
    // Limpar polling ao desmontar
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Smartphone className="h-6 w-6" />
          Gerenciar Instâncias WhatsApp
        </h2>
        <Button onClick={checkAllInstances} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Verificar Todas
        </Button>
      </div>

      {/* Grid de Instâncias */}
      <div className="grid gap-4 md:grid-cols-3">
        {instances.map((instance) => (
          <Card key={instance.name}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-lg">{instance.displayName}</span>
                {instance.status === 'connected' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{instance.name}</p>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => checkInstanceStatus(instance.name).then(connected => {
                      setInstances(prev => prev.map(inst => 
                        inst.name === instance.name 
                          ? { ...inst, status: connected ? 'connected' : 'disconnected' }
                          : inst
                      ));
                    })}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    Verificar
                  </Button>
                  
                  {instance.status === 'disconnected' ? (
                    <Button
                      onClick={() => connectInstance(instance.name)}
                      disabled={loading[`connect-${instance.name}`]}
                      size="sm"
                      className="flex-1"
                    >
                      {loading[`connect-${instance.name}`] ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        'Conectar'
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => disconnectInstance(instance.name)}
                      disabled={loading[`disconnect-${instance.name}`]}
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                    >
                      {loading[`disconnect-${instance.name}`] ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        'Desconectar'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Seção de Enviar Mensagem */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Mensagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={messageForm.instance}
            onChange={(e) => setMessageForm(prev => ({ ...prev, instance: e.target.value }))}
            className="w-full p-2 border rounded-md"
          >
            <option value="">Selecione uma instância conectada</option>
            {instances
              .filter(inst => inst.status === 'connected')
              .map(inst => (
                <option key={inst.name} value={inst.name}>
                  {inst.displayName}
                </option>
              ))
            }
          </select>
          
          <Input
            placeholder="Número (com código do país, ex: 5511999999999)"
            value={messageForm.phone}
            onChange={(e) => setMessageForm(prev => ({ ...prev, phone: e.target.value }))}
          />
          
          <Textarea
            placeholder="Digite sua mensagem..."
            value={messageForm.message}
            onChange={(e) => setMessageForm(prev => ({ ...prev, message: e.target.value }))}
            rows={4}
          />
          
          <Button
            onClick={sendMessage}
            disabled={loading['send'] || !messageForm.instance}
            className="w-full"
          >
            {loading['send'] ? (
              <Loader className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar Mensagem
          </Button>
        </CardContent>
      </Card>

      {/* Modal do QR Code */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Conectando: {instances.find(i => i.name === currentInstance)?.displayName}
            </p>
            
            <div className="bg-white p-4 rounded-lg border-2">
              {qrCodeData ? (
                <img 
                  src={qrCodeData} 
                  alt="QR Code" 
                  className="w-64 h-64"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center">
                  <Loader className="h-8 w-8 animate-spin" />
                </div>
              )}
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              Abra o WhatsApp no seu celular, vá em Dispositivos Conectados e escaneie o código
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}