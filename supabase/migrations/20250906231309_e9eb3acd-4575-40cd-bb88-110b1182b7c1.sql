-- Função para criar usuários sem validação de domínio de email
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
AS $$
DECLARE
  new_user_id UUID;
  result JSON;
BEGIN
  -- Gerar um UUID para o novo usuário
  new_user_id := gen_random_uuid();
  
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
    crypt(user_password, gen_salt('bf')), -- Hash da senha
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
  
  -- Inserir no profiles
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
  );
  
  -- Inserir role de admin
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    new_user_id,
    'admin'
  );
  
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