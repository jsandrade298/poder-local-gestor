-- Corrigir política de DELETE para permitir que validadores também possam excluir agendas
DROP POLICY IF EXISTS "users_can_delete_own_agendas" ON public.agendas;

-- Criar nova política que permite solicitante OU validador excluir
CREATE POLICY "users_can_delete_agendas" 
ON public.agendas 
FOR DELETE 
USING ((auth.uid() = solicitante_id) OR (auth.uid() = validador_id));