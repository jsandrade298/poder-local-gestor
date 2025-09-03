-- Confirmar o email do usuário admin para permitir login
UPDATE auth.users 
SET 
  email_confirmed_at = NOW(),
  updated_at = NOW()
WHERE email = 'admin@admin.com';