-- Reagendar o cron job com o horário correto
-- A agenda foi recusada às 15:04:23 UTC, então deve ser excluída às 15:09:23 UTC
SELECT public.agendar_exclusao_agenda(
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '2025-09-05 15:04:23.988509+00'::timestamp with time zone + INTERVAL '5 minutes'
);

-- Verificar o novo job criado
SELECT * FROM cron.job WHERE jobname = 'excluir_agenda_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';