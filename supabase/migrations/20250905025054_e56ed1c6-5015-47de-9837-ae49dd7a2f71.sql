-- Limpar políticas existentes com problemas
DROP POLICY IF EXISTS "agenda_select_policy" ON public.agendas;
DROP POLICY IF EXISTS "agenda_insert_policy" ON public.agendas;
DROP POLICY IF EXISTS "agenda_update_policy" ON public.agendas;
DROP POLICY IF EXISTS "agendas_select_policy" ON public.agendas;
DROP POLICY IF EXISTS "agendas_insert_policy" ON public.agendas;
DROP POLICY IF EXISTS "agendas_update_policy" ON public.agendas;
DROP POLICY IF EXISTS "Solicitantes podem criar agendas" ON public.agendas;
DROP POLICY IF EXISTS "Participantes podem ver agendas" ON public.agendas;
DROP POLICY IF EXISTS "Validadores podem atualizar status" ON public.agendas;

DROP POLICY IF EXISTS "agenda_acompanhantes_select_policy" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "agenda_acompanhantes_insert_policy" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "Solicitantes podem adicionar acompanhantes" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "Participantes podem ver acompanhantes" ON public.agenda_acompanhantes;

DROP POLICY IF EXISTS "agenda_mensagens_select_policy" ON public.agenda_mensagens;
DROP POLICY IF EXISTS "agenda_mensagens_insert_policy" ON public.agenda_mensagens;
DROP POLICY IF EXISTS "Participantes podem criar mensagens" ON public.agenda_mensagens;
DROP POLICY IF EXISTS "Participantes podem ver mensagens" ON public.agenda_mensagens;

-- Remover constraints antigas se existirem
ALTER TABLE IF EXISTS public.agendas 
  DROP CONSTRAINT IF EXISTS agendas_solicitante_id_fkey,
  DROP CONSTRAINT IF EXISTS agendas_validador_id_fkey;

ALTER TABLE IF EXISTS public.agenda_acompanhantes 
  DROP CONSTRAINT IF EXISTS agenda_acompanhantes_agenda_id_fkey,
  DROP CONSTRAINT IF EXISTS agenda_acompanhantes_usuario_id_fkey;

ALTER TABLE IF EXISTS public.agenda_mensagens 
  DROP CONSTRAINT IF EXISTS agenda_mensagens_agenda_id_fkey,
  DROP CONSTRAINT IF EXISTS agenda_mensagens_usuario_id_fkey,
  DROP CONSTRAINT IF EXISTS agenda_mensagens_remetente_id_fkey;

-- Criar as foreign keys corretas
ALTER TABLE public.agendas 
  ADD CONSTRAINT agendas_solicitante_id_fkey 
  FOREIGN KEY (solicitante_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.agendas 
  ADD CONSTRAINT agendas_validador_id_fkey 
  FOREIGN KEY (validador_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.agenda_acompanhantes 
  ADD CONSTRAINT agenda_acompanhantes_agenda_id_fkey 
  FOREIGN KEY (agenda_id) REFERENCES public.agendas(id) ON DELETE CASCADE;

ALTER TABLE public.agenda_acompanhantes 
  ADD CONSTRAINT agenda_acompanhantes_usuario_id_fkey 
  FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.agenda_mensagens 
  ADD CONSTRAINT agenda_mensagens_agenda_id_fkey 
  FOREIGN KEY (agenda_id) REFERENCES public.agendas(id) ON DELETE CASCADE;

ALTER TABLE public.agenda_mensagens 
  ADD CONSTRAINT agenda_mensagens_remetente_id_fkey 
  FOREIGN KEY (remetente_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Criar políticas RLS simplificadas e funcionais

-- Políticas para agendas
CREATE POLICY "agendas_select" ON public.agendas
  FOR SELECT USING (
    auth.uid() = solicitante_id OR 
    auth.uid() = validador_id OR 
    EXISTS (
      SELECT 1 FROM public.agenda_acompanhantes 
      WHERE agenda_id = agendas.id AND usuario_id = auth.uid()
    )
  );

CREATE POLICY "agendas_insert" ON public.agendas
  FOR INSERT WITH CHECK (auth.uid() = solicitante_id);

CREATE POLICY "agendas_update" ON public.agendas
  FOR UPDATE USING (
    auth.uid() = validador_id OR 
    auth.uid() = solicitante_id
  );

CREATE POLICY "agendas_delete" ON public.agendas
  FOR DELETE USING (auth.uid() = solicitante_id);

-- Políticas para agenda_acompanhantes
CREATE POLICY "acompanhantes_select" ON public.agenda_acompanhantes
  FOR SELECT USING (
    auth.uid() = usuario_id OR
    EXISTS (
      SELECT 1 FROM public.agendas 
      WHERE id = agenda_acompanhantes.agenda_id AND (
        solicitante_id = auth.uid() OR 
        validador_id = auth.uid()
      )
    )
  );

CREATE POLICY "acompanhantes_insert" ON public.agenda_acompanhantes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agendas 
      WHERE id = agenda_acompanhantes.agenda_id AND 
      solicitante_id = auth.uid()
    )
  );

CREATE POLICY "acompanhantes_delete" ON public.agenda_acompanhantes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agendas 
      WHERE id = agenda_acompanhantes.agenda_id AND 
      solicitante_id = auth.uid()
    )
  );

-- Políticas para agenda_mensagens
CREATE POLICY "mensagens_select" ON public.agenda_mensagens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agendas 
      WHERE id = agenda_mensagens.agenda_id AND (
        solicitante_id = auth.uid() OR 
        validador_id = auth.uid()
      )
    ) OR
    EXISTS (
      SELECT 1 FROM public.agenda_acompanhantes 
      WHERE agenda_id = agenda_mensagens.agenda_id AND 
      usuario_id = auth.uid()
    )
  );

CREATE POLICY "mensagens_insert" ON public.agenda_mensagens
  FOR INSERT WITH CHECK (
    auth.uid() = remetente_id AND (
      EXISTS (
        SELECT 1 FROM public.agendas 
        WHERE id = agenda_mensagens.agenda_id AND (
          solicitante_id = auth.uid() OR 
          validador_id = auth.uid()
        )
      ) OR
      EXISTS (
        SELECT 1 FROM public.agenda_acompanhantes 
        WHERE agenda_id = agenda_mensagens.agenda_id AND 
        usuario_id = auth.uid()
      )
    )
  );