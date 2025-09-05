-- Reagendar a exclusão da agenda de teste com o timezone correto
SELECT public.agendar_exclusao_agenda(
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  (SELECT updated_at + INTERVAL '5 minutes' FROM agendas WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
);

-- Verificar o novo agendamento
SELECT * FROM cron.job WHERE jobname = 'excluir_agenda_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';