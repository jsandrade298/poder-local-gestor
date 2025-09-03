-- Habilitar extensões para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar um cron job para backup diário às 03:00 (horário de Brasília)
SELECT cron.schedule(
  'backup-diario-automatico',
  '0 6 * * *', -- 6:00 UTC = 3:00 BRT (horário de Brasília)
  $$
  SELECT
    net.http_post(
      url:='https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/backup-automatico',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}'::jsonb,
      body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);