-- Limpar todos os jobs órfãos
SELECT cron.unschedule('excluir_agenda_f06a0fe6-3670-4c7a-bb22-fa1ebdc5f434');
SELECT cron.unschedule('excluir_agenda_c143f043-e671-46e6-a4db-db42642c3d60');
SELECT cron.unschedule('excluir_agenda_e3d99f9f-4f2c-46ab-a6df-6107173436cc');
SELECT cron.unschedule('excluir_agenda_cb780fb0-8e81-442d-9a46-11ee7767be25');

-- Criar uma agenda de teste para validar o processo completo
INSERT INTO agendas (
  id,
  solicitante_id,
  validador_id,
  titulo,
  descricao_objetivo,
  participantes,
  local_endereco,
  pauta_sugerida,
  duracao_prevista,
  data_hora_proposta,
  status
) VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'eb174e78-40cc-43e8-a257-49ec2782b04f',
  'eb174e78-40cc-43e8-a257-49ec2782b04f',
  'Teste Autoexclusão',
  'Agenda para testar autoexclusão',
  'Teste',
  'Local Teste',
  'Pauta Teste',
  '1',
  NOW() + INTERVAL '1 minute',
  'pendente'
);

-- Verificar se a agenda foi criada
SELECT id, titulo, status, created_at, updated_at FROM agendas WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';