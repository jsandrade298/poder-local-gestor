-- Recriar função para agendar exclusão automática de agendas confirmadas (5 minutos)
CREATE OR REPLACE FUNCTION public.agendar_exclusao_agenda()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status foi alterado para 'confirmado', agendar exclusão
  IF NEW.status = 'confirmado' AND (OLD.status IS NULL OR OLD.status != 'confirmado') THEN
    -- Calcular o momento de exclusão (5 minutos após data_hora_proposta)
    DECLARE
      momento_exclusao TIMESTAMP WITH TIME ZONE;
    BEGIN
      momento_exclusao := NEW.data_hora_proposta + INTERVAL '5 minutes';
      
      -- Agendar a exclusão usando pg_cron
      PERFORM cron.schedule(
        'excluir-agenda-' || NEW.id::text,
        momento_exclusao::text,
        $$
        DELETE FROM public.agendas 
        WHERE id = '$$ || NEW.id::text || $$'::uuid 
        AND status = 'confirmado';
        $$
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para agendar exclusão automática
DROP TRIGGER IF EXISTS trigger_agendar_exclusao_agenda ON public.agendas;
CREATE TRIGGER trigger_agendar_exclusao_agenda
  AFTER INSERT OR UPDATE ON public.agendas
  FOR EACH ROW
  EXECUTE FUNCTION public.agendar_exclusao_agenda();