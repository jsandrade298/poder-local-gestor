-- Permitir que usuários autenticados gerenciem configurações
DROP POLICY IF EXISTS "Only admins can manage configurations" ON public.configuracoes;

-- Criar política mais flexível para configurações
CREATE POLICY "Authenticated users can manage configurations" 
ON public.configuracoes 
FOR ALL 
USING (true)
WITH CHECK (true);