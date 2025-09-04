import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QrCode, Smartphone, CheckCircle, XCircle, RefreshCw, Loader, Send, Wifi, WifiOff } from 'lucide-react';
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
import { Badge } from "@/components/ui/badge";

interface WhatsAppInstance {
  name: string;
  displayName: string;
  status: 'connected' | 'disconnected' | 'connecting';
  profileName?: string;
  number?: string;
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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Form para enviar mensagem
  const [messageForm, setMessageForm] = useState({
    instance: '',
    phone: '',
    message: ''
  });

  const callEdgeFunction = async (action: string, instanceName?: string, additionalData?: any) => {
    try {
      console.log('Calling edge function:', { action, instanceName, additionalData });
      
      const { data, error } = await supabase.functions.invoke('configurar-evolution', {
        body: { action, instanceName, ...additionalData }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erro na Edge Function');
      }

      if (!data) {
        throw new Error('Resposta vazia da Edge Function');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (error) {
      console.error('Error calling edge function:', error);
      throw error;
    }
  };

  // Verificar todas as instâncias (chamado manualmente)
  const checkAllInstances = async () => {
    setLoading(prev => ({ ...prev, 'check-all': true }));
    
    try {
      const result = await callEdgeFunction('list_instances');
      
      if (result?.instances) {
        setInstances(prevInstances => {
          return prevInstances.map(prevInst => {
            const updatedInst = result.instances.find(
              (inst: any) => inst.instanceName === prevInst.name
            );
            
            if (updatedInst) {
              return {
                ...prevInst,
                status: updatedInst.status,
                profileName: updatedInst.profileName,
                number: updatedInst.number
              };
            }
            
            return prevInst;
          });
        });
        
        // Contar quantas estão conectadas
        const connectedCount = result.instances.filter(i => i.status === 'connected').length;
        const totalCount = result.instances.length;
        
        toast({
          title: 'Status atualizado',
          description: `${connectedCount} de ${totalCount} instâncias conectadas`,
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar as instâncias',
        variant: 'destructive'
      });
    } finally {
      setLoading(prev => ({ ...prev, 'check-all': false }));
    }
  };

  // Verificar status de uma instância específica
  const checkInstanceStatus = async (instanceName: string, showToast = true) => {
    if (showToast) {
      setLoading(prev => ({ ...prev, [`verify-${instanceName}`]: true }));
    }
    
    try {
      const result = await callEdgeFunction('instance_status', instanceName);
      console.log(`Status result for ${instanceName}:`, result);
      
      const isConnected = result?.status === 'connected';
      
      setInstances(prev => prev.map(inst => 
        inst.name === instanceName 
          ? { 
              ...inst, 
              status: isConnected ? 'connected' : 'disconnected',
              profileName: result?.profileName,
              number: result?.phoneNumber
            }
          : inst
      ));
      
      if (showToast) {
        toast({
          title: 'Status verificado',
          description: `${instanceName}: ${isConnected ? '✅ Conectado' : '❌ Desconectado'}`,
          variant: isConnected ? 'default' : 'destructive'
        });
      }
      
      return isConnected;
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      if (showToast) {
        toast({
          title: 'Erro',
          description: 'Não foi possível verificar o status',
          variant: 'destructive'
        });
      }
      return false;
    } finally {
      if (showToast) {
        setLoading(prev => ({ ...prev, [`verify-${instanceName}`]: false }));
      }
    }
  };

  // Conectar instância
  const connectInstance = async (instanceName: string) => {
    setLoading(prev => ({ ...prev, [`connect-${instanceName}`]: true }));
    
    try {
      const result = await callEdgeFunction('connect_instance', instanceName);
      
      if (result?.status === 'connected') {
        // Já está conectado
        setInstances(prev => prev.map(inst => 
          inst.name === instanceName 
            ? { 
                ...inst, 
                status: 'connected',
                profileName: result.profileName,
                number: result.phoneNumber || result.number
              }
            : inst
        ));
        
        toast({
          title: '✅ Já conectado',
          description: 'Este WhatsApp já está conectado!',
        });
      } else if (result?.qrcode) {
        // Mostrar QR Code
        setQrCodeData(result.qrcode);
        setCurrentInstance(instanceName);
        setShowQRModal(true);
        
        // Marcar como "conectando"
        setInstances(prev => prev.map(inst => 
          inst.name === instanceName 
            ? { ...inst, status: 'connecting' }
            : inst
        ));
        
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

  // Polling para verificar quando conectar
  const startPolling = (instanceName: string) => {
    // Limpar polling anterior se existir
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setIsPolling(true);
    let pollCount = 0;
    const maxPolls = 40; // 40 * 3 segundos = 2 minutos

    const interval = setInterval(async () => {
      pollCount++;
      
      const isConnected = await checkInstanceStatus(instanceName, false);
      
      if (isConnected) {
        // CONECTADO COM SUCESSO!
        setInstances(prev => prev.map(inst => 
          inst.name === instanceName 
            ? { ...inst, status: 'connected' }
            : inst
        ));
        
        // Fechar modal e limpar QR
        setShowQRModal(false);
        setQrCodeData('');
        setCurrentInstance('');
        setIsPolling(false);
        
        // Parar polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        // Notificar sucesso
        toast({
          title: '🎉 Conectado com sucesso!',
          description: `WhatsApp ${instanceName} foi conectado`,
          duration: 5000,
        });
        
        // Atualizar status de todas as instâncias após 1 segundo
        setTimeout(() => {
          checkAllInstances();
        }, 1000);
      } else if (pollCount >= maxPolls) {
        // Timeout - parar polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setIsPolling(false);
        
        // Voltar status para desconectado
        setInstances(prev => prev.map(inst => 
          inst.name === instanceName 
            ? { ...inst, status: 'disconnected' }
            : inst
        ));
        
        toast({
          title: 'Tempo esgotado',
          description: 'Tente conectar novamente',
          variant: 'destructive'
        });
      }
    }, 3000); // Verificar a cada 3 segundos

    pollingIntervalRef.current = interval;
  };

  // Desconectar instância
  const disconnectInstance = async (instanceName: string) => {
    setLoading(prev => ({ ...prev, [`disconnect-${instanceName}`]: true }));
    
    try {
      await callEdgeFunction('disconnect_instance', instanceName);
      
      setInstances(prev => prev.map(inst => 
        inst.name === instanceName 
          ? { ...inst, status: 'disconnected', profileName: undefined, number: undefined }
          : inst
      ));
      
      toast({
        title: 'Desconectado',
        description: 'WhatsApp desconectado com sucesso',
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

  // Enviar mensagem
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
        title: '✅ Enviado!',
        description: 'Mensagem enviada com sucesso',
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

  // Verificar status inicial ao carregar
  useEffect(() => {
    checkAllInstances();
    
    // Limpar polling ao desmontar componente
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Fechar modal e parar polling
  const closeQRModal = () => {
    setShowQRModal(false);
    setQrCodeData('');
    setCurrentInstance('');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setIsPolling(false);
    
    // Voltar status para desconectado se estava conectando
    setInstances(prev => prev.map(inst => 
      inst.status === 'connecting' 
        ? { ...inst, status: 'disconnected' }
        : inst
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Smartphone className="h-6 w-6" />
          Gerenciar Instâncias WhatsApp
        </h2>
        <Button 
          onClick={checkAllInstances} 
          variant="outline"
          disabled={loading['check-all']}
        >
          {loading['check-all'] ? (
            <Loader className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Verificar Todas
        </Button>
      </div>


      {/* Grid de Instâncias */}
      <div className="grid gap-4 md:grid-cols-3">
        {instances.map((instance) => (
          <Card key={instance.name} className={instance.status === 'connecting' ? 'border-blue-500' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-lg">{instance.displayName}</span>
                {instance.status === 'connected' ? (
                  <Badge variant="default" className="bg-green-500">
                    <Wifi className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                ) : instance.status === 'connecting' ? (
                  <Badge variant="secondary" className="bg-blue-500 text-white">
                    <Loader className="h-3 w-3 mr-1 animate-spin" />
                    Conectando
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <WifiOff className="h-3 w-3 mr-1" />
                    Desconectado
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{instance.name}</p>
                
                {instance.profileName && (
                  <div className="text-sm bg-gray-50 p-2 rounded">
                    <strong>Perfil:</strong> {instance.profileName}
                  </div>
                )}
                
                {instance.number && (
                  <div className="text-sm bg-gray-50 p-2 rounded">
                    <strong>Número:</strong> {instance.number}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => checkInstanceStatus(instance.name, true)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={loading[`verify-${instance.name}`] || instance.status === 'connecting'}
                  >
                    {loading[`verify-${instance.name}`] ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verificar'
                    )}
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
                  ) : instance.status === 'connecting' ? (
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled
                    >
                      <Loader className="h-4 w-4 animate-spin mr-1" />
                      Aguarde...
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
                  {inst.displayName} {inst.profileName ? `(${inst.profileName})` : ''}
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
      <Dialog open={showQRModal} onOpenChange={(open) => !open && closeQRModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Conectando: <strong>{instances.find(i => i.name === currentInstance)?.displayName}</strong>
            </p>
            
            <div className="relative">
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
              
              {isPolling && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <Badge variant="secondary" className="animate-pulse">
                    <Loader className="h-3 w-3 mr-1 animate-spin" />
                    Aguardando conexão...
                  </Badge>
                </div>
              )}
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              Abra o WhatsApp no seu celular, vá em <strong>Dispositivos Conectados</strong> → <strong>Conectar dispositivo</strong> e escaneie o código
            </p>
            
            <Button
              onClick={closeQRModal}
              variant="outline"
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}