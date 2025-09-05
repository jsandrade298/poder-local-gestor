-- Atualizar a função handle_agenda_status_change para incluir autoexclusão para status "recusado"
CREATE OR REPLACE FUNCTION public.handle_agenda_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Se mudou para confirmado, agendar exclusão 5 minutos após a data/hora sugerida
  IF NEW.status = 'confirmado' AND (OLD.status IS NULL OR OLD.status != 'confirmado') THEN
    PERFORM public.agendar_exclusao_agenda(
      NEW.id,
      NEW.data_hora_proposta + INTERVAL '5 minutes'
    );
  END IF;
  
  -- Se mudou para recusado, agendar exclusão 5 minutos após a criação
  IF NEW.status = 'recusado' AND (OLD.status IS NULL OR OLD.status != 'recusado') THEN
    PERFORM public.agendar_exclusao_agenda(
      NEW.id,
      NEW.created_at + INTERVAL '5 minutes'
    );
  END IF;
  
  -- Se mudou de confirmado ou recusado para outro status, cancelar exclusão
  IF (OLD.status = 'confirmado' AND NEW.status != 'confirmado') OR 
     (OLD.status = 'recusado' AND NEW.status != 'recusado') THEN
    PERFORM public.cancelar_exclusao_agenda(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;