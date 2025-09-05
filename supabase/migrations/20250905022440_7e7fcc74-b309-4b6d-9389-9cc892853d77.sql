-- Fix foreign key constraints with correct column names

-- Add missing foreign key constraints for agendas table
ALTER TABLE public.agendas 
  ADD CONSTRAINT agendas_solicitante_id_fkey 
  FOREIGN KEY (solicitante_id) REFERENCES public.profiles(id);

ALTER TABLE public.agendas 
  ADD CONSTRAINT agendas_validador_id_fkey 
  FOREIGN KEY (validador_id) REFERENCES public.profiles(id);

-- Add foreign key constraints for agenda_acompanhantes
ALTER TABLE public.agenda_acompanhantes 
  ADD CONSTRAINT agenda_acompanhantes_agenda_id_fkey 
  FOREIGN KEY (agenda_id) REFERENCES public.agendas(id) ON DELETE CASCADE;

ALTER TABLE public.agenda_acompanhantes 
  ADD CONSTRAINT agenda_acompanhantes_usuario_id_fkey 
  FOREIGN KEY (usuario_id) REFERENCES public.profiles(id);

-- Add foreign key constraints for agenda_mensagens (using correct column name)
ALTER TABLE public.agenda_mensagens 
  ADD CONSTRAINT agenda_mensagens_agenda_id_fkey 
  FOREIGN KEY (agenda_id) REFERENCES public.agendas(id) ON DELETE CASCADE;

ALTER TABLE public.agenda_mensagens 
  ADD CONSTRAINT agenda_mensagens_remetente_id_fkey 
  FOREIGN KEY (remetente_id) REFERENCES public.profiles(id);

-- Fix RLS policy for agendas to avoid infinite recursion
DROP POLICY IF EXISTS "Participantes podem ver agendas" ON public.agendas;

CREATE POLICY "agenda_select_policy" ON public.agendas
  FOR SELECT USING (
    solicitante_id = auth.uid() OR 
    validador_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.agenda_acompanhantes aa 
      WHERE aa.agenda_id = id AND aa.usuario_id = auth.uid()
    )
  );