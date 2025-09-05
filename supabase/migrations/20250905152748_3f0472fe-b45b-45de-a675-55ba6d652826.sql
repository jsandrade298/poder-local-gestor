-- Criar função para enviar mensagens de aniversário
CREATE OR REPLACE FUNCTION public.enviar_mensagens_aniversario()
RETURNS void AS $$
DECLARE
    config_instancia text;
    config_mensagem text;
    config_ativo boolean;
BEGIN
    -- Buscar configurações
    SELECT valor INTO config_instancia FROM configuracoes WHERE chave = 'whatsapp_instancia_aniversario';
    SELECT valor INTO config_mensagem FROM configuracoes WHERE chave = 'whatsapp_mensagem_aniversario';
    SELECT (valor = 'true') INTO config_ativo FROM configuracoes WHERE chave = 'whatsapp_aniversario_ativo';
    
    -- Se não estiver ativo, sair
    IF NOT config_ativo OR config_instancia IS NULL OR config_mensagem IS NULL THEN
        RETURN;
    END IF;
    
    -- Chamar edge function para enviar mensagens
    PERFORM net.http_post(
        url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/enviar-whatsapp-aniversario',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}',
        body := '{}'
    );
END;
$$ LANGUAGE plpgsql;

-- Criar cron job para enviar mensagens de aniversário todos os dias às 9:00h (UTC)
SELECT cron.schedule(
    'enviar-mensagens-aniversario-diario',
    '0 12 * * *', -- 12:00 UTC = 9:00 Brasília
    'SELECT enviar_mensagens_aniversario();'
);