import { Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Agenda() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">
            Acesse sua agenda do Google diretamente no navegador
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
            Google Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eventos" className="mt-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Eventos</CardTitle>
              <CardDescription>
                Use a aba "Google Calendar" para acessar sua agenda completa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Para visualizar e gerenciar seus eventos, clique na aba "Google Calendar" ao lado.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="navegador" className="mt-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Google Calendar - Navegador
              </CardTitle>
              <CardDescription>
                Acesse diretamente sua agenda do Google para fazer login e gerenciar eventos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full h-[700px] rounded-lg overflow-hidden border">
                <iframe
                  src="https://calendar.google.com"
                  style={{
                    border: 0,
                    width: '100%',
                    height: '100%',
                    borderRadius: '8px'
                  }}
                  frameBorder="0"
                  title="Google Calendar"
                  allow="camera; microphone; display-capture"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}