import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Smartphone, CheckCircle, XCircle, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ConfigurarEvolutionDialog({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [instanceStatus, setInstanceStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  
  const INSTANCE_NAME = "gabinete-whats-01";

  const verificarStatusInstancia = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('configurar-evolution', {
        body: { 
          action: 'instance_status',
          instanceName: INSTANCE_NAME
        }
      });

      if (error || data?.error) {
        setInstanceStatus('disconnected');
        return;
      }

      if (data?.status === 'open' || data?.status === 'connected') {
        setInstanceStatus('connected');
      } else {
        setInstanceStatus('disconnected');
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setInstanceStatus('disconnected');
    }
  };

  const conectarInstancia = async () => {
    setLoading(true);
    setQrCode("");
    
    try {
      const { data, error } = await supabase.functions.invoke('configurar-evolution', {
        body: { 
          action: 'connect_instance',
          instanceName: INSTANCE_NAME
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
        toast({
          title: "QR Code gerado",
          description: "Escaneie o QR Code com seu WhatsApp para conectar",
        });
        
        // Verificar status periodicamente após gerar QR
        const interval = setInterval(() => {
          verificarStatusInstancia();
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

  useEffect(() => {
    if (isOpen) {
      verificarStatusInstancia();
    }
  }, [isOpen]);

  const getStatusDisplay = () => {
    switch (instanceStatus) {
      case 'connected':
        return {
          icon: CheckCircle,
          text: 'WhatsApp Conectado',
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        };
      case 'disconnected':
        return {
          icon: XCircle,
          text: 'WhatsApp Desconectado',
          color: 'text-red-600',
          bgColor: 'bg-red-50'
        };
      default:
        return {
          icon: Loader2,
          text: 'Verificando conexão...',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50'
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>WhatsApp - Gabinete Principal</DialogTitle>
        </DialogHeader>

        {/* Status da Conexão */}
        <Card>
          <CardContent className="pt-6">
            <div className={`flex items-center gap-3 p-4 rounded-lg ${statusDisplay.bgColor}`}>
              <StatusIcon className={`h-6 w-6 ${statusDisplay.color} ${instanceStatus === 'checking' ? 'animate-spin' : ''}`} />
              <div>
                <p className="font-medium">Instância: {INSTANCE_NAME}</p>
                <p className={`text-sm ${statusDisplay.color}`}>
                  {statusDisplay.text}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão de Conexão ou QR Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Conectar WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!qrCode ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  {instanceStatus === 'connected' 
                    ? 'WhatsApp já está conectado. Clique para reconectar se necessário.'
                    : 'Clique no botão abaixo para gerar um QR Code e conectar seu WhatsApp.'
                  }
                </p>
                <Button 
                  onClick={conectarInstancia} 
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando QR Code...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      {instanceStatus === 'connected' ? 'Reconectar WhatsApp' : 'Conectar WhatsApp'}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
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
                  onClick={() => setQrCode("")} 
                  variant="outline"
                  size="sm"
                >
                  Fechar QR Code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botão para verificar status */}
        <div className="flex justify-center">
          <Button 
            onClick={verificarStatusInstancia} 
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Verificar Status da Conexão'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}