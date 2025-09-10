-- Remover política problemática completamente
DROP POLICY IF EXISTS "Users can manage tarefa colaboradores" ON public.tarefa_colaboradores;

-- Criar política mais simples e direta
CREATE POLICY "Users can manage tarefa colaboradores" ON public.tarefa_colaboradores
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tarefas t
    WHERE t.id = tarefa_colaboradores.tarefa_id 
    AND t.created_by = auth.uid()
  )
  OR auth.uid() = tarefa_colaboradores.colaborador_id
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tarefas t
    WHERE t.id = tarefa_colaboradores.tarefa_id 
    AND t.created_by = auth.uid()
  )
);