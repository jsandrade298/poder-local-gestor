-- Habilitar extensão pgcrypto para criptografia de senhas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Atualizar função para usar hash de senha simples
CREATE OR REPLACE FUNCTION public.create_user_direct(
  user_email TEXT,
  user_password TEXT,
  user_name TEXT,
  user_phone TEXT DEFAULT NULL,
  user_cargo TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
  result JSON;
  password_hash TEXT;
BEGIN
  -- Verificar se o email já existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    result := json_build_object(
      'success', false,
      'error', 'Email já está em uso no sistema'
    );
    RETURN result;
  END IF;
  
  -- Gerar um UUID único para o novo usuário
  new_user_id := gen_random_uuid();
  
  -- Garantir que o UUID não existe (loop de segurança)
  WHILE EXISTS (SELECT 1 FROM auth.users WHERE id = new_user_id) LOOP
    new_user_id := gen_random_uuid();
  END LOOP;
  
  -- Criar hash da senha usando crypt com bcrypt
  password_hash := crypt(user_password, gen_salt('bf'));
  
  -- Inserir diretamente na tabela auth.users (sem validação de domínio)
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token
  ) VALUES (
    new_user_id,
    user_email,
    password_hash,
    NOW(), -- Email já confirmado
    NOW(),
    NOW(),
    'authenticated',
    'authenticated',
    json_build_object('full_name', user_name),
    false,
    '',
    ''
  );
  
  -- Inserir no profiles usando ON CONFLICT para evitar duplicatas
  INSERT INTO public.profiles (
    id,
    nome,
    email,
    telefone,
    cargo,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    user_name,
    user_email,
    user_phone,
    user_cargo,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    telefone = EXCLUDED.telefone,
    cargo = EXCLUDED.cargo,
    updated_at = NOW();
  
  -- Inserir role de admin usando ON CONFLICT para evitar duplicatas
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    new_user_id,
    'admin'
  ) ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Retornar resultado
  result := json_build_object(
    'success', true,
    'user_id', new_user_id,
    'message', 'Usuário criado com sucesso'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, retornar erro
    result := json_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN result;
END;
$$;