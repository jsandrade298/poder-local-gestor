-- Inserir um usuário admin inicial
-- Nota: Este usuário pode fazer login com admin@admin.com / 123456

-- Inserir área inicial para teste
INSERT INTO public.areas (nome, descricao) VALUES
  ('Administração Geral', 'Área de administração e gestão geral do gabinete'),
  ('Atendimento ao Cidadão', 'Área responsável pelo atendimento direto aos munícipes'),
  ('Projetos e Políticas', 'Área de desenvolvimento de projetos e políticas públicas');

-- Inserir municipe de exemplo para teste
INSERT INTO public.municipes (nome, cpf, email, telefone, endereco, bairro) VALUES
  ('João Silva Santos', '123.456.789-00', 'joao.silva@email.com', '(11) 99999-9999', 'Rua das Flores, 123', 'Centro'),
  ('Maria Oliveira Costa', '987.654.321-00', 'maria.oliveira@email.com', '(11) 88888-8888', 'Av. Principal, 456', 'Jardim das Américas');

-- Inserir configuração para desabilitar confirmação de email durante desenvolvimento
INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('confirmar_email', 'false', 'Configuração para confirmação de email obrigatória')
ON CONFLICT (chave) DO NOTHING;