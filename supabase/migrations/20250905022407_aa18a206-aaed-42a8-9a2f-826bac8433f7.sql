-- Fix RLS policies and foreign key relationships for agendas

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own agendas or ones they accompany" ON public.agendas;
DROP POLICY IF EXISTS "Users can insert their own agendas" ON public.agendas;
DROP POLICY IF EXISTS "Validators can update agenda status" ON public.agendas;
DROP POLICY IF EXISTS "Users can view their agenda accompanies" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "Users can insert agenda accompanies" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "Users can view agenda messages" ON public.agenda_mensagens;
DROP POLICY IF EXISTS "Users can insert agenda messages" ON public.agenda_mensagens;

-- Add missing foreign key constraints
ALTER TABLE public.agendas 
  ADD CONSTRAINT agendas_solicitante_id_fkey 
  FOREIGN KEY (solicitante_id) REFERENCES public.profiles(id);

ALTER TABLE public.agendas 
  ADD CONSTRAINT agendas_validador_id_fkey 
  FOREIGN KEY (validador_id) REFERENCES public.profiles(id);

ALTER TABLE public.agenda_acompanhantes 
  ADD CONSTRAINT agenda_acompanhantes_agenda_id_fkey 
  FOREIGN KEY (agenda_id) REFERENCES public.agendas(id) ON DELETE CASCADE;

ALTER TABLE public.agenda_acompanhantes 
  ADD CONSTRAINT agenda_acompanhantes_usuario_id_fkey 
  FOREIGN KEY (usuario_id) REFERENCES public.profiles(id);

ALTER TABLE public.agenda_mensagens 
  ADD CONSTRAINT agenda_mensagens_agenda_id_fkey 
  FOREIGN KEY (agenda_id) REFERENCES public.agendas(id) ON DELETE CASCADE;

ALTER TABLE public.agenda_mensagens 
  ADD CONSTRAINT agenda_mensagens_usuario_id_fkey 
  FOREIGN KEY (usuario_id) REFERENCES public.profiles(id);

-- Create simpler, non-recursive RLS policies for agendas
CREATE POLICY "agenda_select_policy" ON public.agendas
  FOR SELECT USING (
    solicitante_id = auth.uid() OR 
    validador_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.agenda_acompanhantes aa 
      WHERE aa.agenda_id = id AND aa.usuario_id = auth.uid()
    )
  );

CREATE POLICY "agenda_insert_policy" ON public.agendas
  FOR INSERT WITH CHECK (solicitante_id = auth.uid());

CREATE POLICY "agenda_update_policy" ON public.agendas
  FOR UPDATE USING (
    validador_id = auth.uid() OR 
    solicitante_id = auth.uid()
  );

-- Create RLS policies for agenda_acompanhantes
CREATE POLICY "agenda_acompanhantes_select_policy" ON public.agenda_acompanhantes
  FOR SELECT USING (
    usuario_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.agendas a 
      WHERE a.id = agenda_id AND (a.solicitante_id = auth.uid() OR a.validador_id = auth.uid())
    )
  );

CREATE POLICY "agenda_acompanhantes_insert_policy" ON public.agenda_acompanhantes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agendas a 
      WHERE a.id = agenda_id AND a.solicitante_id = auth.uid()
    )
  );

-- Create RLS policies for agenda_mensagens
CREATE POLICY "agenda_mensagens_select_policy" ON public.agenda_mensagens
  FOR SELECT USING (
    usuario_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.agendas a 
      WHERE a.id = agenda_id AND (
        a.solicitante_id = auth.uid() OR 
        a.validador_id = auth.uid()
      )
    ) OR
    EXISTS (
      SELECT 1 FROM public.agenda_acompanhantes aa 
      WHERE aa.agenda_id = agenda_id AND aa.usuario_id = auth.uid()
    )
  );

CREATE POLICY "agenda_mensagens_insert_policy" ON public.agenda_mensagens
  FOR INSERT WITH CHECK (
    usuario_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.agendas a 
        WHERE a.id = agenda_id AND (
          a.solicitante_id = auth.uid() OR 
          a.validador_id = auth.uid()
        )
      ) OR
      EXISTS (
        SELECT 1 FROM public.agenda_acompanhantes aa 
        WHERE aa.agenda_id = agenda_id AND aa.usuario_id = auth.uid()
      )
    )
  );