-- Inserir dados de exemplo para testar o sistema
-- Execute após o schema principal

-- Inserir usuário administrador padrão
INSERT INTO usuarios (nome, email, telefone, ativo, papel) VALUES
('Administrador', 'admin@gabinete.gov.br', '(11) 3333-4444', true, 'admin'),
('João Silva', 'joao.silva@gabinete.gov.br', '(11) 99999-1111', true, 'admin'),
('Maria Santos', 'maria.santos@gabinete.gov.br', '(11) 99999-2222', true, 'admin'),
('Carlos Lima', 'carlos.lima@gabinete.gov.br', '(11) 99999-3333', true, 'admin');

-- Inserir munícipes de exemplo
INSERT INTO municipes (nome_completo, email, telefone, data_nascimento, end_logradouro, end_numero, end_bairro, end_cidade, end_cep, observacoes) VALUES
('Maria da Silva Santos', 'maria.silva@email.com', '(11) 98765-1111', '1985-05-15', 'Rua das Flores', '123', 'Centro', 'São Paulo', '01000-000', 'Munícipe muito ativa na comunidade'),
('José Santos Oliveira', 'jose.santos@email.com', '(11) 98765-2222', '1978-12-03', 'Av. Principal', '456', 'Vila Nova', 'São Paulo', '01000-001', 'Comerciante local'),
('Ana Costa Lima', 'ana.costa@email.com', '(11) 98765-3333', '1992-08-20', 'Rua B', '789', 'Jardim América', 'São Paulo', '01000-002', 'Estudante universitária'),
('Pedro Oliveira', 'pedro.oliveira@email.com', '(11) 98765-4444', '1955-03-10', 'Rua C', '321', 'Centro', 'São Paulo', '01000-003', 'Aposentado'),
('Lucia Fernandes', 'lucia.fernandes@email.com', '(11) 98765-5555', '1990-11-25', 'Av. Secundária', '654', 'Vila Nova', 'São Paulo', '01000-004', 'Professora');

-- Associar tags aos munícipes (depois que os IDs forem gerados)
-- Maria da Silva Santos - Idoso + Deficiente
-- José Santos Oliveira - Comerciante  
-- Ana Costa Lima - Jovem + Estudante
-- Pedro Oliveira - Idoso
-- Lucia Fernandes - Jovem

-- Inserir demandas de exemplo
INSERT INTO demandas (titulo, descricao, area_id, end_logradouro, end_numero, end_bairro, end_cidade, end_cep, status, prazo_entrega, observacoes) VALUES
('Reparo de buraco na Rua das Flores', 'Buraco grande na via principal que está causando acidentes e danos aos veículos', (SELECT id FROM areas WHERE nome = 'Infraestrutura'), 'Rua das Flores', '100', 'Centro', 'São Paulo', '01000-000', 'em_andamento', '2024-02-15', 'Urgente - muitos acidentes'),
('Melhoria na iluminação da praça central', 'Instalação de novos postes de luz LED na praça para melhorar a segurança', (SELECT id FROM areas WHERE nome = 'Infraestrutura'), 'Praça Central', 'S/N', 'Centro', 'São Paulo', '01000-000', 'solicitado', '2024-03-01', 'Projeto já aprovado'),
('Solicitação de novo semáforo', 'Cruzamento perigoso que necessita sinalização para prevenir acidentes', (SELECT id FROM areas WHERE nome = 'Trânsito'), 'Av. Principal', '500', 'Vila Nova', 'São Paulo', '01000-001', 'nao_atendido', '2024-02-28', 'Aguardando verba'),
('Reforma da creche municipal', 'Reforma completa da creche para atender mais crianças da comunidade', (SELECT id FROM areas WHERE nome = 'Educação'), 'Rua da Escola', '200', 'Jardim América', 'São Paulo', '01000-002', 'concluido', '2024-01-30', 'Obra finalizada'),
('Limpeza do córrego', 'Limpeza e revitalização do córrego que passa pelo bairro', (SELECT id FROM areas WHERE nome = 'Meio Ambiente'), 'Rua do Córrego', '300', 'Vila Nova', 'São Paulo', '01000-001', 'em_andamento', '2024-03-15', 'Projeto ambiental'),
('Instalação de câmeras de segurança', 'Instalação de sistema de monitoramento na praça', (SELECT id FROM areas WHERE nome = 'Segurança'), 'Praça Central', 'S/N', 'Centro', 'São Paulo', '01000-000', 'solicitado', '2024-04-01', 'Segurança pública');

-- Atualizar demandas com responsáveis e munícipes (usar IDs reais depois da inserção)
-- Esta parte deve ser executada manualmente no Supabase substituindo os IDs pelos valores reais

-- Configurações adicionais do gabinete
INSERT INTO configuracoes (chave, valor, tipo, descricao) VALUES
('gabinete_descricao', 'Trabalhando em prol da comunidade local com transparência e eficiência', 'string', 'Descrição do gabinete'),
('gabinete_endereco', 'Rua da Câmara Municipal, 123 - Centro - São Paulo/SP', 'string', 'Endereço físico do gabinete'),
('gabinete_telefone', '(11) 3333-4444', 'string', 'Telefone oficial do gabinete'),
('whatsapp_url', '+5511999999999', 'string', 'WhatsApp para contato'),
('instagram_url', 'https://instagram.com/gabinetesp', 'string', 'Perfil no Instagram'),
('facebook_url', 'https://facebook.com/gabinetesp', 'string', 'Página no Facebook'),
('formato_data', 'DD/MM/AAAA', 'string', 'Formato de exibição de datas');

-- Criar usuário de teste para autenticação
-- Este comando deve ser executado no Auth do Supabase:
-- Email: admin@gabinete.gov.br
-- Senha: admin123456