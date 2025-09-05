-- Garantir que as configurações existem
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('whatsapp_instancia_demandas', '', 'Instância WhatsApp para notificações de demandas'),
  ('whatsapp_mensagem_demandas', 'Olá {nome}! Sua demanda #{protocolo} foi atualizada. Novo status: {status}', 'Mensagem para mudança de status'),
  ('whatsapp_demandas_ativo', 'false', 'Ativar notificações de mudança de status')
ON CONFLICT (chave) DO NOTHING;