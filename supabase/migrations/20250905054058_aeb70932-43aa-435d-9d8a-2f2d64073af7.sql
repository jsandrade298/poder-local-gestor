-- Corrigir função agendar_exclusao_agenda para não dar erro quando job não existe
CREATE OR REPLACE FUNCTION public.agendar_exclusao_agenda(
  agenda_id_param uuid,
  data_hora_exclusao timestamp with time zone
) 
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_name text;
  cron_expression text;
  url_function text;
BEGIN
  -- Nome único para o job baseado no ID da agenda
  job_name := 'excluir_agenda_' || agenda_id_param::text;
  
  -- Cancelar job existente se houver (verificar se existe primeiro)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) THEN
    PERFORM cron.unschedule(job_name);
  END IF;
  
  -- Converter timestamp para formato cron (minuto hora dia mês ano)
  cron_expression := EXTRACT(MINUTE FROM data_hora_exclusao)::text || ' ' ||
                     EXTRACT(HOUR FROM data_hora_exclusao)::text || ' ' ||
                     EXTRACT(DAY FROM data_hora_exclusao)::text || ' ' ||
                     EXTRACT(MONTH FROM data_hora_exclusao)::text || ' *';
  
  -- URL da função
  url_function := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/excluir-agenda-individual';
  
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
$$;