import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const calApiKey = Deno.env.get('CAL_COM_API_KEY');
    
    if (!calApiKey) {
      console.log('CAL_COM_API_KEY not configured, returning mock events');
      return getMockEvents();
    }

    console.log('Attempting to fetch from Cal.com API...');

    // Primeiro, vamos tentar buscar informações do usuário para validar a API key
    const userResponse = await fetch('https://api.cal.com/v1/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userResponse.ok) {
      console.error(`Cal.com API user error: ${userResponse.status} - ${userResponse.statusText}`);
      console.log('API Key validation failed, returning mock events');
      return getMockEvents();
    }

    const userData = await userResponse.json();
    console.log('User data fetched successfully:', userData?.username || userData?.name);

    // Agora buscar os bookings
    const bookingsResponse = await fetch('https://api.cal.com/v1/bookings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!bookingsResponse.ok) {
      console.error(`Cal.com API bookings error: ${bookingsResponse.status} - ${bookingsResponse.statusText}`);
      const errorText = await bookingsResponse.text();
      console.error('Error response:', errorText);
      return getMockEvents();
    }

    const bookingsData = await bookingsResponse.json();
    console.log('Bookings data:', bookingsData);
    
    // Transformar dados da Cal.com para o formato do nosso calendário
    const events = bookingsData.bookings?.map((booking: any) => ({
      id: booking.id.toString(),
      title: booking.title || `Reunião - ${booking.attendees?.[0]?.name || 'Cliente'}`,
      start: booking.startTime,
      end: booking.endTime,
      description: booking.description || '',
      location: booking.location || 'Online',
      attendees: booking.attendees?.map((attendee: any) => attendee.email) || [],
      url: booking.meetingUrl || '',
      color: getEventColor(booking.status),
      status: booking.status
    })) || [];

    console.log(`Successfully fetched ${events.length} events from Cal.com`);

    return new Response(JSON.stringify({ events, source: 'cal.com' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching Cal.com events:', error);
    return getMockEvents();
  }
});

function getMockEvents() {
  console.log('Returning mock events');
  
  const mockEvents = [
    {
      id: "mock-1",
      title: "Reunião com Cliente - João Silva",
      start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      description: "Discussão sobre novo projeto de desenvolvimento",
      location: "Zoom Meeting",
      attendees: ["joao@email.com"],
      color: "#3B82F6",
      status: "ACCEPTED"
    },
    {
      id: "mock-2", 
      title: "Atendimento - Maria Santos",
      start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      description: "Consultoria em gestão municipal",
      location: "Presencial - Gabinete",
      attendees: ["maria@email.com"],
      color: "#10B981",
      status: "ACCEPTED"
    },
    {
      id: "mock-3",
      title: "Workshop - Gestão Pública Digital",
      start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      description: "Apresentação sobre digitalização de processos",
      location: "Auditório Municipal", 
      attendees: ["equipe@prefeitura.com"],
      color: "#8B5CF6",
      status: "PENDING"
    }
  ];

  return new Response(JSON.stringify({ events: mockEvents, source: 'mock' }), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}

function getEventColor(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return '#10B981'; // Verde
    case 'PENDING':
      return '#F59E0B'; // Amarelo
    case 'CANCELLED':
      return '#EF4444'; // Vermelho
    default:
      return '#3B82F6'; // Azul padrão
  }
}