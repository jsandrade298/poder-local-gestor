-- Aguardar alguns minutos e testar a exclusão manual para validar o processo
SELECT net.http_post(
  url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/excluir-agenda-individual',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}',
  body := '{"agenda_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"}'
) as result;

-- Verificar se a agenda ainda existe
SELECT COUNT(*) as agenda_ainda_existe FROM agendas WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';