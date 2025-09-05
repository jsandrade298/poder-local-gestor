-- Corrigir as políticas RLS com erro de referência

-- Remover políticas problemáticas
DROP POLICY IF EXISTS "agenda_select_policy" ON public.agendas;
DROP POLICY IF EXISTS "Solicitantes podem criar agendas" ON public.agendas;
DROP POLICY IF EXISTS "Validadores podem atualizar status" ON public.agendas;

-- Criar políticas corretas sem recursão infinita
CREATE POLICY "agendas_select_policy" ON public.agendas
  FOR SELECT USING (
    solicitante_id = auth.uid() OR 
    validador_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.agenda_acompanhantes aa 
      WHERE aa.agenda_id = agendas.id AND aa.usuario_id = auth.uid()
    )
  );

CREATE POLICY "agendas_insert_policy" ON public.agendas
  FOR INSERT WITH CHECK (solicitante_id = auth.uid());

CREATE POLICY "agendas_update_policy" ON public.agendas
  FOR UPDATE USING (
    validador_id = auth.uid() OR 
    solicitante_id = auth.uid()
  );