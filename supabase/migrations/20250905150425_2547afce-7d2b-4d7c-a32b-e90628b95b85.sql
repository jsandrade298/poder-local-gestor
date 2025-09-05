-- Atualizar a agenda de teste para status recusado para testar o trigger
UPDATE agendas 
SET status = 'recusado', updated_at = NOW()
WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

-- Verificar se o job foi criado
SELECT * FROM cron.job WHERE jobname = 'excluir_agenda_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

-- Verificar dados da agenda
SELECT id, titulo, status, created_at, updated_at, 
       updated_at + INTERVAL '5 minutes' as deve_ser_excluida_em,
       NOW() as agora
FROM agendas WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';