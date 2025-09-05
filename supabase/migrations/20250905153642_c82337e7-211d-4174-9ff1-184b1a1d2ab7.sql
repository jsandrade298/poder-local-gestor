-- Criar função para enviar notificação de atualização de demanda
CREATE OR REPLACE FUNCTION public.notificar_atualizacao_demanda()
RETURNS TRIGGER AS $$
DECLARE
    config_instancia text;
    config_mensagem text;
    config_ativo boolean;
    municipe_nome text;
    municipe_telefone text;
    status_texto text;
BEGIN
    -- Verificar se o status mudou
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Buscar configurações
    SELECT valor INTO config_instancia FROM configuracoes WHERE chave = 'whatsapp_instancia_demandas';
    SELECT valor INTO config_mensagem FROM configuracoes WHERE chave = 'whatsapp_mensagem_demandas';
    SELECT (valor = 'true') INTO config_ativo FROM configuracoes WHERE chave = 'whatsapp_demandas_ativo';
    
    -- Se não estiver ativo, sair
    IF NOT config_ativo OR config_instancia IS NULL OR config_mensagem IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Buscar dados do munícipe
    SELECT nome, telefone INTO municipe_nome, municipe_telefone 
    FROM municipes 
    WHERE id = NEW.municipe_id;
    
    -- Se não tem telefone, sair
    IF municipe_telefone IS NULL OR municipe_telefone = '' THEN
        RETURN NEW;
    END IF;
    
    -- Converter status para texto amigável
    CASE NEW.status
        WHEN 'aberta' THEN status_texto := 'Aberta';
        WHEN 'em_andamento' THEN status_texto := 'Em Andamento';
        WHEN 'resolvida' THEN status_texto := 'Resolvida';
        WHEN 'cancelada' THEN status_texto := 'Cancelada';
        ELSE status_texto := NEW.status::text;
    END CASE;
    
    -- Chamar edge function para enviar mensagem
    PERFORM net.http_post(
        url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/notificar-demanda',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}',
        body := format('{"demanda_id": "%s", "municipe_nome": "%s", "municipe_telefone": "%s", "status": "%s", "instancia": "%s", "mensagem": "%s"}',
                      NEW.id, municipe_nome, municipe_telefone, status_texto, config_instancia, config_mensagem)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para notificar atualizações de demanda
DROP TRIGGER IF EXISTS trigger_notificar_atualizacao_demanda ON demandas;
CREATE TRIGGER trigger_notificar_atualizacao_demanda
    AFTER UPDATE ON demandas
    FOR EACH ROW
    EXECUTE FUNCTION notificar_atualizacao_demanda();