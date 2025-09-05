-- Corrigir função para não dar erro quando job não existe
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
  
  -- Verificar se o job existe antes de tentar cancelar
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) THEN
    PERFORM cron.unschedule(job_name);
  END IF;
END;
$$;