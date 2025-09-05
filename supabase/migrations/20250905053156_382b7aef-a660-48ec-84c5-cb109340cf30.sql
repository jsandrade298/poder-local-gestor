-- Remover o cron job geral de limpeza de agendas
SELECT cron.unschedule('limpar-agendas-expiradas-diario');

-- Criar função para agendar exclusão individual de agenda
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
BEGIN
  -- Nome único para o job baseado no ID da agenda
  job_name := 'excluir_agenda_' || agenda_id_param::text;
  
  -- Cancelar job existente se houver
  PERFORM cron.unschedule(job_name);
  
  -- Agendar nova exclusão
  PERFORM cron.schedule(
    job_name,
    -- Converter timestamp para formato cron (minuto hora dia mês ano)
    EXTRACT(MINUTE FROM data_hora_exclusao)::text || ' ' ||
    EXTRACT(HOUR FROM data_hora_exclusao)::text || ' ' ||
    EXTRACT(DAY FROM data_hora_exclusao)::text || ' ' ||
    EXTRACT(MONTH FROM data_hora_exclusao)::text || ' *',
    $$
    SELECT net.http_post(
      url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/excluir-agenda-individual',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}'::jsonb,
      body := ('{"agenda_id": "' || $$ || agenda_id_param::text || $$"}')::jsonb
    );
    $$
  );
END;
$$;

-- Criar função para cancelar exclusão agendada
CREATE OR REPLACE FUNCTION public.cancelar_exclusao_agenda(
  agenda_id_param uuid
) 
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_name text;
BEGIN
  job_name := 'excluir_agenda_' || agenda_id_param::text;
  PERFORM cron.unschedule(job_name);
END;
$$;

-- Criar trigger para agendar exclusão quando status muda para confirmado
CREATE OR REPLACE FUNCTION public.handle_agenda_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Criar trigger na tabela agendas
DROP TRIGGER IF EXISTS agenda_status_change_trigger ON public.agendas;
CREATE TRIGGER agenda_status_change_trigger
  AFTER UPDATE ON public.agendas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_agenda_status_change();