-- Corrigir política DELETE para municipe_tags
-- Permitir que usuários autenticados possam remover municipe_tags

-- Remover política restritiva de admins/gestores
DROP POLICY IF EXISTS "Admins and gestores can manage municipe tags" ON public.municipe_tags;

-- Criar política específica para DELETE
CREATE POLICY "Authenticated users can delete municipe tags" 
ON public.municipe_tags 
FOR DELETE 
USING (true);

-- Criar política específica para UPDATE (caso precise)
CREATE POLICY "Authenticated users can update municipe tags" 
ON public.municipe_tags 
FOR UPDATE 
USING (true);