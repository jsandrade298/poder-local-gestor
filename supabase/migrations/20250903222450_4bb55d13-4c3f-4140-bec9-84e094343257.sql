-- Corrigir políticas RLS para a tabela tags
-- Permitir que usuários autenticados criem tags

DROP POLICY IF EXISTS "Admins and gestores can manage tags" ON public.tags;
DROP POLICY IF EXISTS "Authenticated users can view tags" ON public.tags;

-- Política para visualização - todos os usuários autenticados podem ver tags
CREATE POLICY "Authenticated users can view tags" 
ON public.tags 
FOR SELECT 
USING (true);

-- Política para criação - usuários autenticados podem criar tags
CREATE POLICY "Authenticated users can create tags" 
ON public.tags 
FOR INSERT 
WITH CHECK (true);

-- Política para atualização - admins e gestores podem atualizar
CREATE POLICY "Admins and gestores can update tags" 
ON public.tags 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Política para exclusão - admins e gestores podem deletar
CREATE POLICY "Admins and gestores can delete tags" 
ON public.tags 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));