import { useState } from "react";
import { Globe, Calendar, Settings, ExternalLink, Clock, User, Link2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Agenda() {
  const [calUsername, setCalUsername] = useState("demo");
  const [customCalUrl, setCustomCalUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCalUrl, setActiveCalUrl] = useState("https://cal.com/demo");

  const handleConnectCal = () => {
    if (calUsername.trim()) {
      const newUrl = `https://cal.com/${calUsername.trim()}`;
      setActiveCalUrl(newUrl);
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 1500);
    }
  };

  const handleCustomUrl = () => {
    if (customCalUrl.trim()) {
      setActiveCalUrl(customCalUrl.trim());
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 1500);
    }
  };

  const openInNewTab = () => {
    window.open(activeCalUrl, '_blank');
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">
            Sistema de agendamento integrado com Cal.com
          </p>
        </div>
        <Button onClick={openInNewTab} variant="outline" className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4" />
          Abrir em Nova Aba
        </Button>
      </div>

      <Tabs defaultValue="agenda" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agenda" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="configuracao" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Cal.com - Sistema de Agendamento
              </CardTitle>
              <CardDescription>
                Sistema completo de agendamento integrado ao Google Calendar
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="text-center">
                    <Calendar className="h-8 w-8 animate-pulse mx-auto mb-2 text-primary" />
                    <p className="text-sm text-muted-foreground">Carregando agenda...</p>
                  </div>
                </div>
              )}
              
              <div className="relative h-[700px] w-full">
                <iframe
                  src={activeCalUrl}
                  className="w-full h-full border-0 rounded-lg"
                  title="Cal.com Agendamento"
                  frameBorder="0"
                  allowFullScreen
                  loading="lazy"
                  onLoad={() => setIsLoading(false)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracao" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Configuração Rápida */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Conectar Cal.com
                </CardTitle>
                <CardDescription>
                  Digite seu username do Cal.com para integrar sua agenda
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username do Cal.com</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-1 px-3 py-2 bg-muted rounded-md text-sm">
                      <span className="text-muted-foreground">cal.com/</span>
                      <Input
                        id="username"
                        value={calUsername}
                        onChange={(e) => setCalUsername(e.target.value)}
                        placeholder="seu-username"
                        className="border-0 bg-transparent p-0 focus-visible:ring-0"
                      />
                    </div>
                    <Button onClick={handleConnectCal} disabled={!calUsername.trim()}>
                      Conectar
                    </Button>
                  </div>
                </div>

                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Não tem conta? Crie gratuitamente em{" "}
                    <a 
                      href="https://cal.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      cal.com
                    </a>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* URL Personalizada */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  URL Personalizada
                </CardTitle>
                <CardDescription>
                  Use uma URL específica do Cal.com ou outra agenda
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-url">URL Completa</Label>
                  <div className="flex gap-2">
                    <Input
                      id="custom-url"
                      value={customCalUrl}
                      onChange={(e) => setCustomCalUrl(e.target.value)}
                      placeholder="https://cal.com/seu-evento-especifico"
                      className="flex-1"
                    />
                    <Button onClick={handleCustomUrl} disabled={!customCalUrl.trim()}>
                      Usar
                    </Button>
                  </div>
                </div>

                <Alert>
                  <Globe className="h-4 w-4" />
                  <AlertDescription>
                    Você pode usar URLs específicas de eventos ou tipos de agendamento
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Informações da Agenda */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Agenda Atual</CardTitle>
                <CardDescription>
                  Informações sobre a agenda carregada
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">URL Ativa:</span>
                    <code className="text-sm bg-background px-2 py-1 rounded">
                      {activeCalUrl}
                    </code>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                    <div className="text-center p-4 bg-primary/5 rounded-lg">
                      <Calendar className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-sm font-medium">Agendamento Online</p>
                      <p className="text-xs text-muted-foreground">24/7 disponível</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/5 rounded-lg">
                      <Clock className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-sm font-medium">Google Calendar</p>
                      <p className="text-xs text-muted-foreground">Sincronização automática</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                      <User className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-sm font-medium">Perfil Personalizado</p>
                      <p className="text-xs text-muted-foreground">Sua marca e horários</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Como usar:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Clientes podem agendar diretamente na agenda</li>
                      <li>• Sincronização automática com Google Calendar</li>
                      <li>• Notificações por email automáticas</li>
                      <li>• Links de reunião gerados automaticamente</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}