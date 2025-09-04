import { useState, useEffect } from "react";
import { Calendar, Clock, User, Link2, Plus, Eye, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from "@/integrations/supabase/client";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  description?: string;
  location?: string;
  attendees?: string[];
  url?: string;
  color?: string;
}

export default function Agenda() {
  const [calUsername, setCalUsername] = useState("agenda-clovis-am3eym");
  const [customCalUrl, setCustomCalUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCalUrl, setActiveCalUrl] = useState("https://cal.com/agenda-clovis-am3eym");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Carregar eventos reais da Cal.com
  useEffect(() => {
    loadCalEvents();
  }, []);

  const loadCalEvents = async () => {
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase.functions.invoke('cal-events');
      
      if (error) {
        console.error('Erro ao buscar eventos:', error);
        // Em caso de erro, usar eventos de exemplo
        loadMockEvents();
        return;
      }

      if (data?.events && data.events.length > 0) {
        setEvents(data.events);
      } else {
        // Se não há eventos na Cal.com, mostrar eventos de exemplo
        loadMockEvents();
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      loadMockEvents();
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadMockEvents = () => {
    // Eventos de exemplo caso a API não esteja configurada ou sem eventos
    const mockEvents: CalendarEvent[] = [
      {
        id: "1",
        title: "Reunião com Cliente - João Silva",
        start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        description: "Discussão sobre novo projeto de desenvolvimento",
        location: "Zoom Meeting",
        attendees: ["joao@email.com"],
        color: "#3B82F6"
      },
      {
        id: "2", 
        title: "Atendimento - Maria Santos",
        start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        description: "Consultoria em gestão municipal",
        location: "Presencial - Gabinete",
        attendees: ["maria@email.com"],
        color: "#10B981"
      },
      {
        id: "3",
        title: "Workshop - Gestão Pública Digital",
        start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        description: "Apresentação sobre digitalização de processos",
        location: "Auditório Municipal", 
        attendees: ["equipe@prefeitura.com", "cidadaos@municipio.com"],
        color: "#8B5CF6"
      }
    ];
    
    setEvents(mockEvents);
  };

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

  const handleEventClick = (clickInfo: any) => {
    const event = events.find(e => e.id === clickInfo.event.id);
    if (event) {
      setSelectedEvent(event);
    }
  };

  const formatEventTime = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;
    
    const startTime = startDate.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (endDate) {
      const endTime = endDate.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      return `${startTime} - ${endTime}`;
    }
    
    return startTime;
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
            Visualize e gerencie seus agendamentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={loadCalEvents} 
            variant="outline" 
            size="sm"
            disabled={loadingEvents}
          >
            <Clock className="h-4 w-4 mr-2" />
            {loadingEvents ? "Carregando..." : "Atualizar"}
          </Button>
          <Button onClick={openInNewTab} variant="outline" size="sm">
            <Link2 className="h-4 w-4 mr-2" />
            Cal.com
          </Button>
        </div>
      </div>

      <Tabs defaultValue="calendario" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendario" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="agendamento" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Agendamento
          </TabsTrigger>
          <TabsTrigger value="configuracao" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Calendário Principal */}
            <div className="xl:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Calendário de Eventos
                  </CardTitle>
                  <CardDescription>
                    Visualização completa de seus agendamentos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="calendar-container">
                    <FullCalendar
                      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                      initialView="dayGridMonth"
                      headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay'
                      }}
                      events={events}
                      eventClick={handleEventClick}
                      height="600px"
                      locale="pt-br"
                      buttonText={{
                        today: 'Hoje',
                        month: 'Mês',
                        week: 'Semana',
                        day: 'Dia'
                      }}
                      dayHeaderFormat={{ weekday: 'short' }}
                      eventDisplay="block"
                      displayEventTime={true}
                      eventTimeFormat={{
                        hour: '2-digit',
                        minute: '2-digit',
                        meridiem: false
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar com Detalhes */}
            <div className="space-y-6">
              {/* Evento Selecionado */}
              {selectedEvent && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detalhes do Evento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg">{selectedEvent.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatEventTime(selectedEvent.start, selectedEvent.end)}
                      </p>
                    </div>
                    
                    {selectedEvent.description && (
                      <div>
                        <Label className="text-sm font-medium">Descrição</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedEvent.description}
                        </p>
                      </div>
                    )}
                    
                    {selectedEvent.location && (
                      <div>
                        <Label className="text-sm font-medium">Local</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedEvent.location}
                        </p>
                      </div>
                    )}
                    
                    {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Participantes</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedEvent.attendees.map((attendee, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {attendee}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Resumo de Eventos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de eventos:</span>
                    <Badge variant="secondary">{events.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Esta semana:</span>
                    <Badge className="bg-blue-500">
                      {events.filter(e => {
                        const eventDate = new Date(e.start);
                        const today = new Date();
                        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                        return eventDate >= today && eventDate <= weekFromNow;
                      }).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Hoje:</span>
                    <Badge className="bg-green-500">
                      {events.filter(e => {
                        const eventDate = new Date(e.start);
                        const today = new Date();
                        return eventDate.toDateString() === today.toDateString();
                      }).length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Próximos Eventos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Próximos Eventos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {events
                      .filter(e => new Date(e.start) > new Date())
                      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                      .slice(0, 3)
                      .map((event) => (
                        <div 
                          key={event.id} 
                          className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedEvent(event)}
                        >
                          <h4 className="font-medium text-sm">{event.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {formatEventTime(event.start, event.end)}
                          </p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="agendamento" className="mt-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Cal.com - Sistema de Agendamento
              </CardTitle>
              <CardDescription>
                Interface para agendamentos online
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
            {/* Configuração Cal.com */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Conectar Cal.com
                </CardTitle>
                <CardDescription>
                  Configure sua agenda do Cal.com
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
                  Use uma URL específica do Cal.com
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
                  <Eye className="h-4 w-4" />
                  <AlertDescription>
                    Configure eventos específicos ou tipos de agendamento personalizados
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <style dangerouslySetInnerHTML={{
        __html: `
          .fc-theme-standard .fc-scrollgrid {
            border: 1px solid hsl(var(--border));
          }
          .fc-theme-standard th,
          .fc-theme-standard td {
            border: 1px solid hsl(var(--border));
          }
          .fc-button-primary {
            background-color: hsl(var(--primary));
            border-color: hsl(var(--primary));
          }
          .fc-button-primary:hover {
            background-color: hsl(var(--primary));
            border-color: hsl(var(--primary));
            opacity: 0.9;
          }
          .fc-daygrid-event {
            border-radius: 4px;
            padding: 2px 4px;
          }
        `
      }} />
    </div>
  );
}