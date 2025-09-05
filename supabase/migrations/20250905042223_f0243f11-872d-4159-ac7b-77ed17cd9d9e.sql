-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para executar limpeza de agendas diariamente às 02:00
SELECT cron.schedule(
  'limpar-agendas-expiradas-diario',
  '0 2 * * *', -- Todo dia às 02:00 
  $$
  SELECT net.http_post(
    url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/limpar-agendas-expiradas',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);