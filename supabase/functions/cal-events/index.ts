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
      throw new Error('CAL_COM_API_KEY not configured');
    }

    // Buscar eventos/bookings da Cal.com API
    const response = await fetch('https://api.cal.com/v1/bookings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Cal.com API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transformar dados da Cal.com para o formato do nosso calendário
    const events = data.bookings?.map((booking: any) => ({
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

    console.log(`Fetched ${events.length} events from Cal.com`);

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching Cal.com events:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        events: [] // Retornar array vazio em caso de erro
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

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