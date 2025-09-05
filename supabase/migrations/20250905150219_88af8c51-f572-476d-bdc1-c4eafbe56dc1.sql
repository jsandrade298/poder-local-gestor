-- Simular recusa da agenda de teste para verificar se o trigger funciona
UPDATE agendas 
SET status = 'recusado', updated_at = NOW()
WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

-- Verificar se o job foi criado
SELECT jobname, schedule, active FROM cron.job 
WHERE jobname = 'excluir_agenda_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

-- Verificar detalhes da agenda
SELECT 
  id, 
  titulo, 
  status, 
  updated_at,
  updated_at + INTERVAL '5 minutes' as deve_ser_excluida_em,
  NOW() as agora
FROM agendas 
WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';