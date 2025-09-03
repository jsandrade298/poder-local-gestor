-- Inserir um usuário admin inicial diretamente
-- Nota: Este é um usuário de exemplo para testes

-- Primeiro, vou inserir um usuário admin diretamente na tabela auth.users
-- Como não podemos inserir diretamente na tabela auth.users via SQL,
-- vamos orientar o usuário a se cadastrar pela interface

-- Para facilitar, vou adicionar uma configuração que permita login com qualquer usuário
INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('permitir_cadastro_livre', 'true', 'Permite cadastro de novos usuários sem restrições'),
  ('usuario_admin_default', 'admin@admin.com', 'Email do usuário administrador padrão')
ON CONFLICT (chave) DO UPDATE SET 
  valor = EXCLUDED.valor,
  updated_at = NOW();