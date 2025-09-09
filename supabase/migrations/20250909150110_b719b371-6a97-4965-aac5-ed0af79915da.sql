-- Adicionar campo de cor às tarefas
ALTER TABLE public.tarefas 
ADD COLUMN cor text DEFAULT '#3B82F6';

-- Criar tabela para múltiplos colaboradores
CREATE TABLE public.tarefa_colaboradores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(tarefa_id, colaborador_id)
);

-- Habilitar RLS
ALTER TABLE public.tarefa_colaboradores ENABLE ROW LEVEL SECURITY;

-- Políticas para tarefa_colaboradores
CREATE POLICY "Authenticated users can view tarefa colaboradores"
ON public.tarefa_colaboradores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can manage tarefa colaboradores"
ON public.tarefa_colaboradores
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tarefas t 
    WHERE t.id = tarefa_colaboradores.tarefa_id 
    AND (t.created_by = auth.uid() OR auth.uid() = colaborador_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tarefas t 
    WHERE t.id = tarefa_colaboradores.tarefa_id 
    AND t.created_by = auth.uid()
  )
);