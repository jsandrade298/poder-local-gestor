-- ============================================================
-- Pausa agendamentos (pg_cron) sem função hoje — 24/11/2026
--
-- Pausar = active false. Nada é apagado; para reativar um job:
--   SELECT cron.alter_job(<jobid>, active := true);
--
-- 1. excluir_agenda_<id> (30): eram para rodar uma vez, mas o cron
--    repete todo ano na mesma data. A função chamada apaga a agenda
--    (e mensagens/acompanhantes) de vez; 26 dessas agendas ainda
--    existem e seriam apagadas no ano seguinte. O app não cria mais
--    esses jobs.
-- 2. enviar-aniversarios-diarios / enviar-mensagens-aniversario-diario:
--    WhatsApp desativado pelo gabinete.
-- 3. clustering-semanal-assessor-ia / sinais-gabinete-diario:
--    Assessor IA ocultado do menu.
-- 4. verificar-prazos-tarefas: falha todo dia e duplica o trabalho de
--    processar-lembretes-tarefas.
--
-- Mantidos: backup-diario-automatico e lembretes-tarefas-09h/15h/21h.
-- ============================================================

DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname LIKE 'excluir\_agenda\_%'
       OR jobname IN (
         'enviar-aniversarios-diarios',
         'enviar-mensagens-aniversario-diario',
         'clustering-semanal-assessor-ia',
         'sinais-gabinete-diario',
         'verificar-prazos-tarefas'
       )
  LOOP
    PERFORM cron.alter_job(j.jobid, active := false);
  END LOOP;
END;
$$;
