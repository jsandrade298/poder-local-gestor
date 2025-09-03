-- Corrigir política de UPDATE para permitir usuários autenticados
DROP POLICY IF EXISTS "Admins and gestores can update tags" ON public.tags;

-- Permitir que todos os usuários autenticados possam atualizar tags
CREATE POLICY "Authenticated users can update tags" 
ON public.tags 
FOR UPDATE 
USING (true);