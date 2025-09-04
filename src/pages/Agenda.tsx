import { useState } from "react";
import { Globe, ExternalLink, RefreshCw, ArrowLeft, ArrowRight, Home, Lock, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function Agenda() {
  const [browserUrl, setBrowserUrl] = useState("https://calendar.google.com");
  const [inputUrl, setInputUrl] = useState("https://calendar.google.com");
  const [isLoading, setIsLoading] = useState(false);
  const [key, setKey] = useState(0); // Para forçar reload do iframe
  const { toast } = useToast();

  const handleNavigate = (url: string) => {
    setIsLoading(true);
    setBrowserUrl(url);
    setInputUrl(url);
    setKey(prev => prev + 1); // Força reload
    
    // Simular carregamento
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  const goHome = () => handleNavigate("https://calendar.google.com");
  const goBack = () => {
    // Simular navegação para trás
    handleNavigate(browserUrl);
  };
  const goForward = () => {
    // Simular navegação para frente
    handleNavigate(browserUrl);
  };
  const refresh = () => {
    setIsLoading(true);
    setKey(prev => prev + 1);
    setTimeout(() => setIsLoading(false), 1500);
  };

  const handleUrlSubmit = () => {
    if (inputUrl.trim()) {
      handleNavigate(inputUrl);
    }
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
              <CardTitle>Eventos do Calendário</CardTitle>
              <CardDescription>
                Visualize seus eventos aqui ou use o navegador integrado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Globe className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Para visualizar e gerenciar seus eventos, use o navegador integrado na aba ao lado.
                </p>
                <Button 
                  onClick={() => {
                    const tab = document.querySelector('[value="navegador"]') as HTMLButtonElement;
                    tab?.click();
                  }}
                  variant="outline"
                >
                  Ir para Navegador
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="navegador" className="mt-6">
          <Card className="w-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Navegador Integrado
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Barra de Navegação do Navegador */}
              <div className="border-b bg-muted/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goBack}
                      disabled={isLoading}
                      className="h-8 w-8 p-0"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goForward}
                      disabled={isLoading}
                      className="h-8 w-8 p-0"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refresh}
                      disabled={isLoading}
                      className="h-8 w-8 p-0"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goHome}
                      disabled={isLoading}
                      className="h-8 w-8 p-0"
                    >
                      <Home className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 bg-background border rounded-md flex-1">
                      <Lock className="h-3 w-3 text-green-600" />
                      <Input
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        placeholder="Digite a URL..."
                        className="border-0 focus-visible:ring-0 bg-transparent px-1 text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleUrlSubmit();
                          }
                        }}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleUrlSubmit}
                      disabled={isLoading}
                      className="h-8"
                    >
                      Ir
                    </Button>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Área do Navegador */}
              <div className="relative">
                {isLoading && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">Carregando...</p>
                    </div>
                  </div>
                )}
                
                <div className="h-[650px] bg-white">
                  <iframe
                    key={key}
                    src={browserUrl}
                    className="w-full h-full border-0"
                    title="Navegador Integrado"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-popups-to-escape-sandbox"
                    allow="camera; microphone; geolocation; encrypted-media; picture-in-picture; display-capture"
                    loading="lazy"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                      setIsLoading(false);
                      toast({
                        title: "Erro ao Carregar",
                        description: "Não foi possível carregar a página. Tente outro endereço.",
                        variant: "destructive",
                      });
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}