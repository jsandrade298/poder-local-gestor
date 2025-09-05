-- Testar exclusão das outras agendas recusadas
SELECT net.http_post(
  url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/excluir-agenda-individual',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}',
  body := '{"agenda_id": "26ade7e8-dbfd-4473-80f2-892bf2dd0bb2"}'
) as result_agenda_novo;

SELECT net.http_post(
  url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/excluir-agenda-individual',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}',
  body := '{"agenda_id": "8354fa70-f56e-4d29-a326-8c48076725bb"}'
) as result_agenda_teste;