-- Remover política problemática
DROP POLICY IF EXISTS "Users can manage tarefa colaboradores" ON public.tarefa_colaboradores;

-- Criar função security definer para verificar se usuário é colaborador da tarefa
CREATE OR REPLACE FUNCTION public.is_tarefa_colaborador(tarefa_id_param uuid, user_id_param uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tarefa_colaboradores 
    WHERE tarefa_id = tarefa_id_param AND colaborador_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Criar nova política sem recursão
CREATE POLICY "Users can manage tarefa colaboradores" ON public.tarefa_colaboradores
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tarefas t
    WHERE t.id = tarefa_colaboradores.tarefa_id 
    AND (
      t.created_by = auth.uid() 
      OR auth.uid() = tarefa_colaboradores.colaborador_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tarefas t
    WHERE t.id = tarefa_colaboradores.tarefa_id 
    AND t.created_by = auth.uid()
  )
);