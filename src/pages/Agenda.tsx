import { useState, useEffect } from "react";
import { Calendar, CalendarIcon, Clock, MapPin, Users, ExternalLink, Plus, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/dateUtils";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: string;
  }>;
  htmlLink: string;
  creator?: {
    email: string;
    displayName?: string;
  };
}

const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"; // Será configurado via Supabase secrets

export default function Agenda() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { toast } = useToast();

  // Verificar se o usuário já está autenticado
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    const token = localStorage.getItem('google_calendar_token');
    if (token) {
      setIsAuthenticated(true);
      loadEvents();
    }
  };

  const authenticateWithGoogle = async () => {
    try {
      setLoading(true);
      
      // Configurar OAuth 2.0
      const scope = 'https://www.googleapis.com/auth/calendar.readonly';
      const redirectUri = `${window.location.origin}/agenda`;
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=code&` +
        `access_type=offline`;

      // Abrir janela de autenticação
      const authWindow = window.open(authUrl, 'google-auth', 'width=500,height=600');
      
      // Monitorar a janela de autenticação
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          checkAuthStatus();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Erro na autenticação:', error);
      toast({
        title: "Erro na autenticação",
        description: "Não foi possível conectar com o Google Calendar.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      
      // Simular carregamento de eventos (será implementado com Google Calendar API)
      const mockEvents: CalendarEvent[] = [
        {
          id: "1",
          summary: "Reunião com Equipe de Projetos",
          description: "Discussão sobre andamento dos projetos municipais",
          start: { dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() },
          location: "Sala de Reuniões - Gabinete",
          attendees: [
            { email: "admin@admin.com", displayName: "Admin Sistema", responseStatus: "accepted" }
          ],
          htmlLink: "#",
          creator: { email: "admin@admin.com", displayName: "Admin Sistema" }
        },
        {
          id: "2",
          summary: "Atendimento ao Público",
          description: "Horário dedicado para atendimento aos munícipes",
          start: { dateTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() },
          location: "Recepção do Gabinete",
          htmlLink: "#"
        },
        {
          id: "3",
          summary: "Sessão Câmara Municipal",
          start: { dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString() },
          location: "Plenário da Câmara",
          htmlLink: "#"
        }
      ];
      
      setEvents(mockEvents);
      
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      toast({
        title: "Erro ao carregar eventos",
        description: "Não foi possível carregar os eventos da agenda.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    localStorage.removeItem('google_calendar_token');
    setIsAuthenticated(false);
    setEvents([]);
    toast({
      title: "Desconectado",
      description: "Você foi desconectado do Google Calendar.",
    });
  };

  const getEventStatus = (event: CalendarEvent) => {
    const now = new Date();
    const start = new Date(event.start.dateTime || event.start.date || '');
    const end = new Date(event.end.dateTime || event.end.date || '');
    
    if (now < start) return { status: "upcoming", label: "Próximo", color: "bg-blue-500" };
    if (now >= start && now <= end) return { status: "ongoing", label: "Em andamento", color: "bg-green-500" };
    return { status: "past", label: "Finalizado", color: "bg-gray-500" };
  };

  const formatEventTime = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    
    if (!start) return '';
    
    if (event.start.date) {
      // Evento de dia inteiro
      return "Dia inteiro";
    }
    
    const startTime = formatDateTime(start).split(' ')[1];
    const endTime = formatDateTime(end || '').split(' ')[1];
    
    return `${startTime} - ${endTime}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">
            Conecte-se ao Google Calendar para visualizar e gerenciar sua agenda.
          </p>
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Conectar Google Calendar</CardTitle>
            <CardDescription>
              Para visualizar sua agenda, você precisa se conectar com sua conta do Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={authenticateWithGoogle} 
              disabled={loading}
              className="w-full"
            >
              {loading ? "Conectando..." : "Conectar com Google"}
            </Button>
            
            <Alert className="mt-4">
              <AlertDescription className="text-sm">
                Será solicitada permissão apenas para leitura da sua agenda. 
                Não faremos alterações nos seus eventos.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">
            Sua agenda integrada com Google Calendar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadEvents} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </Button>
          <Button variant="outline" onClick={disconnect}>
            Desconectar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="eventos" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="eventos" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Eventos
          </TabsTrigger>
          <TabsTrigger value="navegador" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Google Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eventos" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Eventos de hoje */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Próximos Eventos
                  </CardTitle>
                  <CardDescription>
                    {events.length} evento(s) encontrado(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    {events.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum evento encontrado.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {events.map((event) => {
                          const status = getEventStatus(event);
                          return (
                            <Card key={event.id} className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold">{event.summary}</h3>
                                    <Badge 
                                      variant="secondary" 
                                      className={`text-white ${status.color}`}
                                    >
                                      {status.label}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      {formatEventTime(event)}
                                    </div>
                                    {event.location && (
                                      <div className="flex items-center gap-1">
                                        <MapPin className="h-4 w-4" />
                                        {event.location}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </div>
                              
                              {event.description && (
                                <p className="text-sm text-muted-foreground mb-3">
                                  {event.description}
                                </p>
                              )}
                              
                              {event.attendees && event.attendees.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex items-center gap-1">
                                    {event.attendees.slice(0, 3).map((attendee, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {attendee.displayName || attendee.email}
                                      </Badge>
                                    ))}
                                    {event.attendees.length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{event.attendees.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar com resumo */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo do Dia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de eventos:</span>
                    <Badge variant="secondary">{events.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Em andamento:</span>
                    <Badge className="bg-green-500">
                      {events.filter(e => getEventStatus(e).status === 'ongoing').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Próximos:</span>
                    <Badge className="bg-blue-500">
                      {events.filter(e => getEventStatus(e).status === 'upcoming').length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Evento
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Google Calendar
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="navegador" className="mt-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Google Calendar - Navegador
              </CardTitle>
              <CardDescription>
                Acesse diretamente sua agenda do Google para criar e editar eventos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full h-[700px] rounded-lg overflow-hidden border">
                <iframe
                  src="https://calendar.google.com/calendar/embed?showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=1&showTz=0&height=700&wkst=1&bgcolor=%23ffffff"
                  style={{
                    border: 0,
                    width: '100%',
                    height: '100%',
                    borderRadius: '8px'
                  }}
                  frameBorder="0"
                  scrolling="no"
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