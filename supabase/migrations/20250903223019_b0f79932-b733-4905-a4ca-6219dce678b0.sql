-- Corrigir política de DELETE para permitir usuários autenticados
DROP POLICY IF EXISTS "Admins and gestores can delete tags" ON public.tags;

-- Permitir que todos os usuários autenticados possam deletar tags
CREATE POLICY "Authenticated users can delete tags" 
ON public.tags 
FOR DELETE 
USING (true);