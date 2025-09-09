-- Atualizar política para permitir que acompanhantes também possam editar agendas
DROP POLICY IF EXISTS "users_can_update_own_agendas" ON public.agendas;

CREATE POLICY "users_can_update_own_agendas" 
ON public.agendas 
FOR UPDATE 
USING (
  auth.uid() = solicitante_id OR 
  auth.uid() = validador_id OR
  EXISTS (
    SELECT 1 FROM public.agenda_acompanhantes 
    WHERE agenda_id = agendas.id 
    AND usuario_id = auth.uid()
  )
);