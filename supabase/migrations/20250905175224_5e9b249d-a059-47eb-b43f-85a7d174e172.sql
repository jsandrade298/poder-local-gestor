-- Re-enable HTTP extension and fix function issues
CREATE EXTENSION IF NOT EXISTS http;

-- Update function signature to match the http extension
CREATE OR REPLACE FUNCTION public.notificar_atualizacao_demanda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    config_instancia text;
    config_mensagem text;
    config_ativo boolean;
    municipe_nome text;
    municipe_telefone text;
    status_texto text;
    response http_response;
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
    
    -- Chamar edge function usando a função correta do http extension
    BEGIN
        SELECT * INTO response FROM http_post(
            'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/notificar-demanda',
            format('{"demanda_id": "%s", "municipe_nome": "%s", "municipe_telefone": "%s", "status": "%s", "instancia": "%s", "mensagem": "%s"}',
                   NEW.id, municipe_nome, municipe_telefone, status_texto, config_instancia, config_mensagem),
            'application/json'
        );
    EXCEPTION
        WHEN OTHERS THEN
            -- Log do erro mas não falha a operação
            RAISE NOTICE 'Erro ao enviar notificação WhatsApp: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$function$;

-- Update function for birthday messages
CREATE OR REPLACE FUNCTION public.enviar_mensagens_aniversario()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    config_instancia text;
    config_mensagem text;
    config_ativo boolean;
    response http_response;
BEGIN
    -- Buscar configurações
    SELECT valor INTO config_instancia FROM configuracoes WHERE chave = 'whatsapp_instancia_aniversario';
    SELECT valor INTO config_mensagem FROM configuracoes WHERE chave = 'whatsapp_mensagem_aniversario';
    SELECT (valor = 'true') INTO config_ativo FROM configuracoes WHERE chave = 'whatsapp_aniversario_ativo';
    
    -- Se não estiver ativo, sair
    IF NOT config_ativo OR config_instancia IS NULL OR config_mensagem IS NULL THEN
        RETURN;
    END IF;
    
    -- Chamar edge function usando a função correta do http extension
    BEGIN
        SELECT * INTO response FROM http_post(
            'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/enviar-whatsapp-aniversario',
            '{}',
            'application/json'
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao enviar mensagens de aniversário: %', SQLERRM;
    END;
END;
$function$;