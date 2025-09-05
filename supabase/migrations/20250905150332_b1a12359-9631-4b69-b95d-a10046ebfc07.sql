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