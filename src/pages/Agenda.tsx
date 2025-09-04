import { useState } from "react";
import { Globe, ExternalLink, RefreshCw, ArrowLeft, ArrowRight, Home } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function Agenda() {
  const [browserUrl, setBrowserUrl] = useState("https://calendar.google.com");
  const [inputUrl, setInputUrl] = useState("https://calendar.google.com");
  const [isLoading, setIsLoading] = useState(false);
  const [browserWindow, setBrowserWindow] = useState<Window | null>(null);
  const { toast } = useToast();

  const handleNavigate = (url: string) => {
    setIsLoading(true);
    setBrowserUrl(url);
    setInputUrl(url);
    
    // Simular carregamento
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  const openInNewWindow = () => {
    const newWindow = window.open(
      browserUrl,
      'google-calendar',
      'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=yes,menubar=yes,location=yes'
    );
    
    if (newWindow) {
      setBrowserWindow(newWindow);
      toast({
        title: "Navegador Aberto",
        description: "Google Calendar foi aberto em uma nova janela",
      });
    } else {
      toast({
        title: "Bloqueio de Pop-up",
        description: "Por favor, permita pop-ups para este site",
        variant: "destructive",
      });
    }
  };

  const goHome = () => handleNavigate("https://calendar.google.com");
  const goBack = () => window.history.back();
  const goForward = () => window.history.forward();
  const refresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">
            Navegador integrado para acessar o Google Calendar
          </p>
        </div>
      </div>

      <Tabs defaultValue="navegador" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="eventos" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Eventos
          </TabsTrigger>
          <TabsTrigger value="navegador" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Navegador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eventos" className="mt-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Eventos</CardTitle>
              <CardDescription>
                Use a aba "Navegador" para acessar sua agenda do Google
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Para visualizar e gerenciar seus eventos, clique na aba "Navegador" ao lado.
              </p>
              <Button onClick={openInNewWindow} className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Abrir Google Calendar em Nova Janela
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="navegador" className="mt-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Navegador Integrado
              </CardTitle>
              <CardDescription>
                Navegue pelo Google Calendar como em um navegador normal
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {/* Barra de Navegação */}
              <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goBack}
                  disabled={isLoading}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goForward}
                  disabled={isLoading}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refresh}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goHome}
                  disabled={isLoading}
                >
                  <Home className="h-4 w-4" />
                </Button>
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="Digite a URL..."
                    className="flex-1"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleNavigate(inputUrl);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleNavigate(inputUrl)}
                    disabled={isLoading}
                  >
                    Ir
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInNewWindow}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>

              {/* Área de Instrução */}
              <div className="bg-muted/50 border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center h-[600px] flex flex-col items-center justify-center">
                <Globe className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Navegador Integrado</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Por questões de segurança, o Google não permite incorporar o Calendar diretamente. 
                  Use o botão abaixo para abrir em uma nova janela.
                </p>
                <div className="space-y-3">
                  <Button 
                    onClick={openInNewWindow}
                    className="flex items-center gap-2"
                    size="lg"
                  >
                    <ExternalLink className="h-5 w-5" />
                    Abrir Google Calendar
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Abrirá em uma nova janela para login e uso normal
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}