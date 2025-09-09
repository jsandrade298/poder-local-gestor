-- Adicionar campo responsavel_id à tabela tarefas
ALTER TABLE public.tarefas 
ADD COLUMN responsavel_id UUID REFERENCES auth.users(id);

-- Criar índice para performance
CREATE INDEX idx_tarefas_responsavel_id ON public.tarefas(responsavel_id);

-- Atualizar política para permitir que responsáveis também vejam e modifiquem as tarefas
DROP POLICY "Users can update their own tarefas" ON public.tarefas;
DROP POLICY "Users can delete their own tarefas" ON public.tarefas;

-- Nova política para atualizar (criador ou responsável ou admin/gestor)
CREATE POLICY "Users can update their own or assigned tarefas" 
ON public.tarefas 
FOR UPDATE 
USING (
  (auth.uid() = created_by) OR 
  (auth.uid() = responsavel_id) OR
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);

-- Nova política para deletar (criador ou responsável ou admin/gestor)
CREATE POLICY "Users can delete their own or assigned tarefas" 
ON public.tarefas 
FOR DELETE 
USING (
  (auth.uid() = created_by) OR 
  (auth.uid() = responsavel_id) OR
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);