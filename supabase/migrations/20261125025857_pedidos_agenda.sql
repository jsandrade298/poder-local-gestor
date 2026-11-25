-- ============================================================
-- Pedidos de agenda (novo fluxo) e registro pós-compromisso (25/11/2026)
--
-- pedidos_agenda: alguém da equipe pede um horário na agenda do mandato,
--   com até 3 opções. Um editor da agenda aprova (vira evento no Google),
--   recusa ou propõe outro horário. Tudo o que muda o pedido passa pela
--   função do servidor google-agenda; as telas só leem.
-- agenda_registros: "como foi" um compromisso (nota/ata), opcionalmente
--   ligado a uma demanda.
-- A tabela antiga "agendas" não é alterada.
-- ============================================================

CREATE OR REPLACE FUNCTION public.e_editor_agenda()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1 FROM public.agenda_editores e
     WHERE e.tenant_id = public.get_my_tenant_id() AND e.usuario_id = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.e_editor_agenda() TO authenticated;

CREATE TABLE IF NOT EXISTS public.pedidos_agenda (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  solicitante_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo             text NOT NULL,
  descricao          text,
  local              text,
  opcoes             jsonb NOT NULL,             -- [{inicio, fim}] até 3
  status             text NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'aprovado', 'recusado', 'contraproposta', 'cancelado')),
  escolhida          jsonb,                      -- {inicio, fim} aprovado
  contraproposta     jsonb,                      -- {inicio, fim, mensagem}
  motivo             text,                       -- da recusa / do cancelamento
  decidido_por       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decidido_em        timestamptz,
  google_calendar_id text,
  google_event_id    text,
  reservado          boolean NOT NULL DEFAULT false,
  demanda_id         uuid REFERENCES public.demandas(id) ON DELETE SET NULL,
  municipe_id        uuid REFERENCES public.municipes(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedidos_agenda_tenant_status ON public.pedidos_agenda (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS pedidos_agenda_solicitante ON public.pedidos_agenda (solicitante_id, created_at DESC);
ALTER TABLE public.pedidos_agenda ENABLE ROW LEVEL SECURITY;
-- Ler: quem pediu, e os editores da agenda (todos os pedidos do gabinete)
DROP POLICY IF EXISTS pedidos_agenda_ler ON public.pedidos_agenda;
CREATE POLICY pedidos_agenda_ler ON public.pedidos_agenda FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_my_tenant_id())
         AND (solicitante_id = (SELECT auth.uid()) OR (SELECT public.e_editor_agenda())));
GRANT SELECT ON public.pedidos_agenda TO authenticated;
DROP TRIGGER IF EXISTS pedidos_agenda_updated_at ON public.pedidos_agenda;
CREATE TRIGGER pedidos_agenda_updated_at BEFORE UPDATE ON public.pedidos_agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.agenda_registros (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL DEFAULT public.get_my_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  calendar_id   text NOT NULL,
  event_id      text NOT NULL,
  titulo_evento text,
  inicio_evento timestamptz,
  texto         text NOT NULL,
  autor_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  demanda_id    uuid REFERENCES public.demandas(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agenda_registros_evento ON public.agenda_registros (tenant_id, event_id);
ALTER TABLE public.agenda_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenda_registros_ler ON public.agenda_registros;
CREATE POLICY agenda_registros_ler ON public.agenda_registros FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_my_tenant_id()) AND NOT (SELECT public.is_representante()));
DROP POLICY IF EXISTS agenda_registros_criar ON public.agenda_registros;
CREATE POLICY agenda_registros_criar ON public.agenda_registros FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_my_tenant_id()) AND autor_id = (SELECT auth.uid()) AND NOT (SELECT public.is_representante()));
DROP POLICY IF EXISTS agenda_registros_apagar ON public.agenda_registros;
CREATE POLICY agenda_registros_apagar ON public.agenda_registros FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_my_tenant_id()) AND autor_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, DELETE ON public.agenda_registros TO authenticated;
