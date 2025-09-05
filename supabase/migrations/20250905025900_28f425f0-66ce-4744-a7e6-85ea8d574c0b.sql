-- PASSO 1: DESABILITAR RLS TEMPORARIAMENTE
ALTER TABLE public.agendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_acompanhantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_mensagens DISABLE ROW LEVEL SECURITY;

-- PASSO 2: REMOVER TODAS AS POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "agendas_select" ON public.agendas;
DROP POLICY IF EXISTS "agendas_insert" ON public.agendas;
DROP POLICY IF EXISTS "agendas_update" ON public.agendas;
DROP POLICY IF EXISTS "agendas_delete" ON public.agendas;
DROP POLICY IF EXISTS "agenda_select_policy" ON public.agendas;
DROP POLICY IF EXISTS "agenda_insert_policy" ON public.agendas;
DROP POLICY IF EXISTS "agenda_update_policy" ON public.agendas;
DROP POLICY IF EXISTS "agendas_select_policy" ON public.agendas;
DROP POLICY IF EXISTS "agendas_insert_policy" ON public.agendas;
DROP POLICY IF EXISTS "agendas_update_policy" ON public.agendas;
DROP POLICY IF EXISTS "Solicitantes podem criar agendas" ON public.agendas;
DROP POLICY IF EXISTS "Participantes podem ver agendas" ON public.agendas;
DROP POLICY IF EXISTS "Validadores podem atualizar status" ON public.agendas;

DROP POLICY IF EXISTS "acompanhantes_select" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "acompanhantes_insert" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "acompanhantes_delete" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "agenda_acompanhantes_select_policy" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "agenda_acompanhantes_insert_policy" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "Solicitantes podem adicionar acompanhantes" ON public.agenda_acompanhantes;
DROP POLICY IF EXISTS "Participantes podem ver acompanhantes" ON public.agenda_acompanhantes;

DROP POLICY IF EXISTS "mensagens_select" ON public.agenda_mensagens;
DROP POLICY IF EXISTS "mensagens_insert" ON public.agenda_mensagens;
DROP POLICY IF EXISTS "agenda_mensagens_select_policy" ON public.agenda_mensagens;
DROP POLICY IF EXISTS "agenda_mensagens_insert_policy" ON public.agenda_mensagens;
DROP POLICY IF EXISTS "Participantes podem criar mensagens" ON public.agenda_mensagens;
DROP POLICY IF EXISTS "Participantes podem ver mensagens" ON public.agenda_mensagens;

-- PASSO 3: CRIAR POLÍTICAS SIMPLES SEM RECURSÃO

-- Políticas para AGENDAS (sem subqueries que referenciam a própria tabela)
CREATE POLICY "anyone_can_read_agendas" ON public.agendas
  FOR SELECT USING (true);

CREATE POLICY "users_can_insert_agendas" ON public.agendas
  FOR INSERT WITH CHECK (auth.uid() = solicitante_id);

CREATE POLICY "users_can_update_own_agendas" ON public.agendas
  FOR UPDATE USING (
    auth.uid() = solicitante_id OR 
    auth.uid() = validador_id
  );

CREATE POLICY "users_can_delete_own_agendas" ON public.agendas
  FOR DELETE USING (auth.uid() = solicitante_id);

-- Políticas para ACOMPANHANTES
CREATE POLICY "anyone_can_read_acompanhantes" ON public.agenda_acompanhantes
  FOR SELECT USING (true);

CREATE POLICY "users_can_insert_acompanhantes" ON public.agenda_acompanhantes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "users_can_delete_acompanhantes" ON public.agenda_acompanhantes
  FOR DELETE USING (true);

-- Políticas para MENSAGENS  
CREATE POLICY "anyone_can_read_mensagens" ON public.agenda_mensagens
  FOR SELECT USING (true);

CREATE POLICY "users_can_insert_own_mensagens" ON public.agenda_mensagens
  FOR INSERT WITH CHECK (auth.uid() = remetente_id);

-- PASSO 4: REABILITAR RLS
ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_acompanhantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_mensagens ENABLE ROW LEVEL SECURITY;