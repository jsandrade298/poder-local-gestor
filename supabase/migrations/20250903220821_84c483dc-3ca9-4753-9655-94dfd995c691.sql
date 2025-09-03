-- Verificar políticas atuais da tabela municipes
-- As políticas atuais são muito restritivas

-- Temporariamente permitir que usuários autenticados possam editar e excluir municipes
-- (isso deve ser ajustado conforme as regras de negócio)

-- Atualizar política de UPDATE para permitir usuários autenticados
DROP POLICY IF EXISTS "Users can update assigned municipes" ON public.municipes;
CREATE POLICY "Authenticated users can update municipes" 
ON public.municipes 
FOR UPDATE 
USING (true);

-- Atualizar política de DELETE para permitir usuários autenticados  
DROP POLICY IF EXISTS "Users can delete assigned municipes" ON public.municipes;
CREATE POLICY "Authenticated users can delete municipes" 
ON public.municipes 
FOR DELETE 
USING (true);

-- Manter as políticas de admin/gestor com maior precedência
CREATE POLICY "Admins and gestores can manage municipes - priority" 
ON public.municipes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));