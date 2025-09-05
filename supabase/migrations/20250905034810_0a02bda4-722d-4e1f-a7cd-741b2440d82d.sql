-- Sincronizar email da Nicolle entre auth.users e profiles
-- Buscar usuários onde o email do perfil é diferente do email de autenticação
UPDATE auth.users 
SET email = profiles.email,
    email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW())
FROM profiles 
WHERE auth.users.id = profiles.id 
  AND auth.users.email != profiles.email;