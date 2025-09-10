-- Corrigir políticas RLS para tarefa_colaboradores

-- Primeiro, verificar e remover políticas existentes que podem estar causando conflito
DROP POLICY IF EXISTS "Users can manage tarefa colaboradores" ON tarefa_colaboradores;
DROP POLICY IF EXISTS "Authenticated users can view tarefa colaboradores" ON tarefa_colaboradores;

-- Criar políticas mais permissivas para tarefa_colaboradores
-- 1. Política para SELECT - qualquer usuário autenticado pode ver
CREATE POLICY "Users can view tarefa colaboradores"
ON tarefa_colaboradores FOR SELECT
TO authenticated
USING (true);

-- 2. Política para INSERT - criador da tarefa ou colaborador pode adicionar outros colaboradores
CREATE POLICY "Users can insert tarefa colaboradores"
ON tarefa_colaboradores FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tarefas
    WHERE tarefas.id = tarefa_id
    AND (tarefas.created_by = auth.uid() OR tarefas.responsavel_id = auth.uid())
  ) OR
  -- Ou se o usuário já é colaborador da tarefa
  EXISTS (
    SELECT 1 FROM tarefa_colaboradores tc2
    WHERE tc2.tarefa_id = tarefa_id
    AND tc2.colaborador_id = auth.uid()
  )
);

-- 3. Política para DELETE - criador da tarefa ou o próprio colaborador pode remover
CREATE POLICY "Users can delete tarefa colaboradores"
ON tarefa_colaboradores FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tarefas
    WHERE tarefas.id = tarefa_id
    AND (tarefas.created_by = auth.uid() OR tarefas.responsavel_id = auth.uid())
  ) OR
  -- Ou se é o próprio colaborador se removendo
  colaborador_id = auth.uid()
);

-- 4. Política para UPDATE - apenas criador da tarefa
CREATE POLICY "Users can update tarefa colaboradores"
ON tarefa_colaboradores FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tarefas
    WHERE tarefas.id = tarefa_id
    AND (tarefas.created_by = auth.uid() OR tarefas.responsavel_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tarefas
    WHERE tarefas.id = tarefa_id
    AND (tarefas.created_by = auth.uid() OR tarefas.responsavel_id = auth.uid())
  )
);

-- Garantir que RLS está habilitado
ALTER TABLE tarefa_colaboradores ENABLE ROW LEVEL SECURITY;