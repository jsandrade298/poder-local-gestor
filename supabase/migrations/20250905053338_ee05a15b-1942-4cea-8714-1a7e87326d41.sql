-- Corrigir warnings de segurança adicionando search_path às funções
CREATE OR REPLACE FUNCTION public.agendar_exclusao_agenda(
  agenda_id_param uuid,
  data_hora_exclusao timestamp with time zone
) 
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_name text;
  cron_expression text;
  url_function text;
BEGIN
  -- Nome único para o job baseado no ID da agenda
  job_name := 'excluir_agenda_' || agenda_id_param::text;
  
  -- Cancelar job existente se houver
  PERFORM cron.unschedule(job_name);
  
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

-- Corrigir função de cancelar exclusão
CREATE OR REPLACE FUNCTION public.cancelar_exclusao_agenda(
  agenda_id_param uuid
) 
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_name text;
BEGIN
  job_name := 'excluir_agenda_' || agenda_id_param::text;
  PERFORM cron.unschedule(job_name);
END;
$$;

-- Corrigir função de handle de mudança de status
CREATE OR REPLACE FUNCTION public.handle_agenda_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se mudou para confirmado, agendar exclusão
  IF NEW.status = 'confirmado' AND (OLD.status IS NULL OR OLD.status != 'confirmado') THEN
    PERFORM public.agendar_exclusao_agenda(
      NEW.id,
      NEW.data_hora_proposta + INTERVAL '5 minutes'
    );
  END IF;
  
  -- Se mudou de confirmado para outro status, cancelar exclusão
  IF OLD.status = 'confirmado' AND NEW.status != 'confirmado' THEN
    PERFORM public.cancelar_exclusao_agenda(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;