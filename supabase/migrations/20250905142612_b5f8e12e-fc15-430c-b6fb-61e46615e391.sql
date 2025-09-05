-- Corrigir a função de agendamento para usar timezone correto
CREATE OR REPLACE FUNCTION public.agendar_exclusao_agenda(agenda_id_param uuid, data_hora_exclusao timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  job_name text;
  cron_expression text;
  url_function text;
  data_hora_local timestamp with time zone;
BEGIN
  -- Nome único para o job baseado no ID da agenda
  job_name := 'excluir_agenda_' || agenda_id_param::text;
  
  -- Cancelar job existente se houver
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) THEN
    PERFORM cron.unschedule(job_name);
  END IF;
  
  -- Converter para timezone local (América/São_Paulo)
  data_hora_local := data_hora_exclusao AT TIME ZONE 'America/Sao_Paulo';
  
  -- Criar expressão cron mais robusta (minuto hora dia mês *)
  cron_expression := EXTRACT(MINUTE FROM data_hora_local)::text || ' ' ||
                     EXTRACT(HOUR FROM data_hora_local)::text || ' ' ||
                     EXTRACT(DAY FROM data_hora_local)::text || ' ' ||
                     EXTRACT(MONTH FROM data_hora_local)::text || ' *';
  
  -- URL da função
  url_function := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/excluir-agenda-individual';
  
  -- Log para debug
  RAISE NOTICE 'Agendando exclusão da agenda % para %', agenda_id_param, data_hora_local;
  RAISE NOTICE 'Expressão cron: %', cron_expression;
  
  -- Agendar nova exclusão
  PERFORM cron.schedule(
    job_name,
    cron_expression,
    format('SELECT net.http_post(url := %L, headers := %L, body := %L);',
           url_function,
           '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}',
           '{"agenda_id": "' || agenda_id_param::text || '"}')
  );
END;
$function$;