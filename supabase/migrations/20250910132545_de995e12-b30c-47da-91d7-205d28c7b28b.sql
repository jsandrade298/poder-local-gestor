-- Atualizar política RLS para tarefa_colaboradores para permitir que colaboradores também possam adicionar outros colaboradores
DROP POLICY IF EXISTS "Users can manage tarefa colaboradores" ON public.tarefa_colaboradores;

CREATE POLICY "Users can manage tarefa colaboradores" ON public.tarefa_colaboradores
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tarefas t
    WHERE t.id = tarefa_colaboradores.tarefa_id 
    AND (
      t.created_by = auth.uid() 
      OR auth.uid() = tarefa_colaboradores.colaborador_id
      OR EXISTS (
        SELECT 1 FROM tarefa_colaboradores tc2 
        WHERE tc2.tarefa_id = t.id AND tc2.colaborador_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tarefas t
    WHERE t.id = tarefa_colaboradores.tarefa_id 
    AND (
      t.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM tarefa_colaboradores tc2 
        WHERE tc2.tarefa_id = t.id AND tc2.colaborador_id = auth.uid()
      )
    )
  )
);