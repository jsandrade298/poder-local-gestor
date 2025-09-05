-- Atualizar o cron job para executar às 10:00 da manhã no horário de Brasília (13:00 UTC)
SELECT cron.unschedule('enviar-aniversarios-diarios');

-- Criar novo cron job para executar às 13:00 UTC (10:00 Brasília)
SELECT cron.schedule(
  'enviar-aniversarios-diarios',
  '0 13 * * *', -- Executa às 13:00 UTC todos os dias (10:00 Brasília)
  $$
  SELECT net.http_post(
    url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/enviar-whatsapp-aniversario',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}'::jsonb,
    body := '{"teste": false}'::jsonb
  );
  $$
);