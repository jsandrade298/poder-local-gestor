-- Função para confirmar automaticamente o email de novos usuários
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Atualiza o usuário para confirmar o email automaticamente
  UPDATE auth.users 
  SET 
    email_confirmed_at = NOW(),
    confirmed_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Trigger para executar a função após inserir um novo usuário
DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.auto_confirm_user_email();