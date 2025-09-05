-- Habilitar extensões necessárias para cron e net (se não estiverem habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Garantir que a tabela configuracoes existe e tem as configurações necessárias
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('whatsapp_instancia_aniversario', '', 'Instância WhatsApp para aniversários'),
  ('whatsapp_mensagem_aniversario', 'Feliz aniversário, {nome}! 🎉🎂 Que este novo ciclo seja repleto de realizações e alegrias!', 'Mensagem padrão de aniversário'),
  ('whatsapp_aniversario_ativo', 'true', 'Ativar envio automático de aniversários'),
  ('whatsapp_instancia_demandas', '', 'Instância WhatsApp para notificações de demandas'),
  ('whatsapp_mensagem_demandas', 'Olá {nome}! Sua demanda foi atualizada. Novo status: {status}', 'Mensagem padrão para mudança de status'),
  ('whatsapp_demandas_ativo', 'true', 'Ativar notificações de mudança de status')
ON CONFLICT (chave) DO NOTHING;

-- Criar o cron job para envio de aniversários diários às 9h00
SELECT cron.schedule(
  'enviar-aniversarios-diarios',
  '0 9 * * *', -- Executa às 9h00 todos os dias
  $$
  SELECT net.http_post(
    url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/enviar-whatsapp-aniversario',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('teste', false)
  );
  $$
);