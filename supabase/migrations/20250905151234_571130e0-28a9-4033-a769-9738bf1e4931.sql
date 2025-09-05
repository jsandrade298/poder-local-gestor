-- Corrigir a função de agendamento para usar o timezone correto
CREATE OR REPLACE FUNCTION public.agendar_exclusao_agenda(agenda_id_param uuid, data_hora_exclusao timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  job_name text;
  cron_expression text;
  url_function text;
  data_hora_utc timestamp with time zone;
  minuto int;
  hora int;
  dia int;
  mes int;
BEGIN
  -- Nome único para o job baseado no ID da agenda
  job_name := 'excluir_agenda_' || agenda_id_param::text;
  
  -- Cancelar job existente se houver
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) THEN
    PERFORM cron.unschedule(job_name);
  END IF;
  
  -- Como o cron roda em UTC, precisamos garantir que o horário já está em UTC
  data_hora_utc := data_hora_exclusao;
  
  -- Extrair componentes da data/hora em UTC para o cron
  minuto := EXTRACT(MINUTE FROM data_hora_utc);
  hora := EXTRACT(HOUR FROM data_hora_utc);
  dia := EXTRACT(DAY FROM data_hora_utc);
  mes := EXTRACT(MONTH FROM data_hora_utc);
  
  -- Criar expressão cron (minuto hora dia mês *)
  cron_expression := minuto::text || ' ' || hora::text || ' ' || dia::text || ' ' || mes::text || ' *';
  
  -- URL da função
  url_function := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/excluir-agenda-individual';
  
  -- Log para debug
  RAISE NOTICE 'Agendando exclusão da agenda % para UTC: %', agenda_id_param, data_hora_utc;
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