-- Confirmar emails de todos os usuários existentes que ainda não foram confirmados
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;