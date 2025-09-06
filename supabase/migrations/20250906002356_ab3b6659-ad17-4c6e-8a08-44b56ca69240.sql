-- Inserir configurações padrão para delay de mensagens de aniversário
INSERT INTO configuracoes (chave, valor, descricao) 
VALUES 
  ('whatsapp_tempo_minimo_aniversario', '2', 'Tempo mínimo em segundos entre envios de mensagens de aniversário')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO configuracoes (chave, valor, descricao) 
VALUES 
  ('whatsapp_tempo_maximo_aniversario', '5', 'Tempo máximo em segundos entre envios de mensagens de aniversário')
ON CONFLICT (chave) DO NOTHING;