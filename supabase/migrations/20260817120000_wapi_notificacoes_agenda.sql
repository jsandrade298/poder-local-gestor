-- ============================================================
-- Notificações WhatsApp: migração Z-API → W-API + agenda por tenant
--
-- 1. Credenciais W-API na configuração global
-- 2. Agenda (dias/horários) configurável por tenant
-- 3. Fila de pendências + resumos consolidados
-- 4. RLS
-- 5. Cron do despachante (a cada 5 minutos)
--
-- Os disparos em massa para munícipes continuam na Z-API/Evolution.
-- Esta migração afeta apenas as notificações internas do sistema.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ------------------------------------------------------------
-- 1. Credenciais W-API (globais, painel super-admin)
-- ------------------------------------------------------------

ALTER TABLE public.notification_whatsapp_config
  ADD COLUMN IF NOT EXISTS wapi_instance_id text,
  ADD COLUMN IF NOT EXISTS wapi_token text,
  ADD COLUMN IF NOT EXISTS wapi_phone_number text,
  ADD COLUMN IF NOT EXISTS provedor text NOT NULL DEFAULT 'wapi';

-- Permite voltar para a Z-API sem redeploy caso a W-API apresente problema.
ALTER TABLE public.notification_whatsapp_config
  DROP CONSTRAINT IF EXISTS notification_whatsapp_config_provedor_check;
ALTER TABLE public.notification_whatsapp_config
  ADD CONSTRAINT notification_whatsapp_config_provedor_check
  CHECK (provedor IN ('wapi', 'zapi'));

COMMENT ON COLUMN public.notification_whatsapp_config.provedor IS
  'Provedor usado pelas notificações do sistema: wapi (padrão) ou zapi (rollback).';

-- ------------------------------------------------------------
-- 2. Agenda de recebimento por tenant
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notificacao_whatsapp_agenda (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  ativo           boolean NOT NULL DEFAULT true,
  -- 0 = domingo … 6 = sábado (compatível com EXTRACT(DOW))
  dias_semana     smallint[] NOT NULL DEFAULT '{1,2,3,4,5}'::smallint[],
  horarios        time[] NOT NULL DEFAULT '{"09:00","14:00","18:00"}'::time[],
  timezone        text NOT NULL DEFAULT 'America/Sao_Paulo',
  -- Tipos que ignoram a agenda e saem na hora (ex: agenda_solicitada)
  tipos_urgentes  text[] NOT NULL DEFAULT '{}'::text[],
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agenda_dias_validos CHECK (
    array_length(dias_semana, 1) BETWEEN 1 AND 7
    AND dias_semana <@ '{0,1,2,3,4,5,6}'::smallint[]
  ),
  CONSTRAINT agenda_horarios_nao_vazio CHECK (
    array_length(horarios, 1) IS NOT NULL AND array_length(horarios, 1) BETWEEN 1 AND 12
  )
);

COMMENT ON TABLE public.notificacao_whatsapp_agenda IS
  'Dias da semana e horários em que cada gabinete recebe o resumo de notificações por WhatsApp.';

-- ------------------------------------------------------------
-- 3. Fila de pendências e resumos enviados
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notificacao_whatsapp_resumos (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  destinatario_id        uuid NOT NULL,
  destinatario_telefone  text NOT NULL,
  total_itens            integer NOT NULL DEFAULT 0,
  mensagem_enviada       text,
  ia_usada               boolean NOT NULL DEFAULT false,
  usou_botoes            boolean NOT NULL DEFAULT false,
  wapi_message_id        text,
  wapi_inserted_id       text,
  erro                   text,
  enviado_em             timestamptz NOT NULL DEFAULT now(),
  confirmado_em          timestamptz,
  confirmacao_texto      text
);

CREATE INDEX IF NOT EXISTS idx_resumos_wapi_message
  ON public.notificacao_whatsapp_resumos (wapi_message_id)
  WHERE wapi_message_id IS NOT NULL;

-- Usado pelo webhook para achar o resumo mais recente do número que respondeu
CREATE INDEX IF NOT EXISTS idx_resumos_telefone_recentes
  ON public.notificacao_whatsapp_resumos (destinatario_telefone, enviado_em DESC);

CREATE TABLE IF NOT EXISTS public.notificacao_whatsapp_fila (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  notificacao_id         uuid,
  destinatario_id        uuid NOT NULL,
  destinatario_nome      text,
  destinatario_telefone  text NOT NULL,
  tipo                   text NOT NULL,
  titulo                 text,
  mensagem               text,
  url_destino            text,
  status                 text NOT NULL DEFAULT 'pendente',
  resumo_id              uuid REFERENCES public.notificacao_whatsapp_resumos(id) ON DELETE SET NULL,
  erro                   text,
  tentativas             integer NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  enviada_em             timestamptz,

  CONSTRAINT fila_status_valido CHECK (
    status IN ('pendente', 'enviada', 'erro', 'cancelada')
  )
);

-- Uma notificação interna entra na fila uma única vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_fila_notificacao_unica
  ON public.notificacao_whatsapp_fila (notificacao_id)
  WHERE notificacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fila_pendentes
  ON public.notificacao_whatsapp_fila (tenant_id, destinatario_id, created_at)
  WHERE status = 'pendente';

-- Guarda de idempotência: impede disparar o mesmo horário duas vezes
CREATE TABLE IF NOT EXISTS public.notificacao_whatsapp_disparos (
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slot_em        timestamptz NOT NULL,
  executado_em   timestamptz NOT NULL DEFAULT now(),
  total_resumos  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, slot_em)
);

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------

ALTER TABLE public.notificacao_whatsapp_agenda   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacao_whatsapp_fila     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacao_whatsapp_resumos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacao_whatsapp_disparos ENABLE ROW LEVEL SECURITY;

-- Agenda: membros do gabinete leem; admin do gabinete e superadmin escrevem.
DROP POLICY IF EXISTS agenda_select ON public.notificacao_whatsapp_agenda;
CREATE POLICY agenda_select ON public.notificacao_whatsapp_agenda
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_superadmin());

DROP POLICY IF EXISTS agenda_insert ON public.notificacao_whatsapp_agenda;
CREATE POLICY agenda_insert ON public.notificacao_whatsapp_agenda
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR (tenant_id = public.get_my_tenant_id() AND public.is_tenant_admin())
  );

DROP POLICY IF EXISTS agenda_update ON public.notificacao_whatsapp_agenda;
CREATE POLICY agenda_update ON public.notificacao_whatsapp_agenda
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (tenant_id = public.get_my_tenant_id() AND public.is_tenant_admin())
  );

-- Fila e resumos: leitura dentro do gabinete; escrita só pelo service_role
-- (as edge functions), que ignora RLS.
DROP POLICY IF EXISTS fila_select ON public.notificacao_whatsapp_fila;
CREATE POLICY fila_select ON public.notificacao_whatsapp_fila
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_superadmin());

DROP POLICY IF EXISTS resumos_select ON public.notificacao_whatsapp_resumos;
CREATE POLICY resumos_select ON public.notificacao_whatsapp_resumos
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_superadmin());

DROP POLICY IF EXISTS disparos_select ON public.notificacao_whatsapp_disparos;
CREATE POLICY disparos_select ON public.notificacao_whatsapp_disparos
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_superadmin());

-- ------------------------------------------------------------
-- 4b. Fecha as três tabelas com policy aberta ao mundo
--
-- As policies chamadas "Service role full access ..." foram criadas
-- SEM a cláusula `TO service_role`. Sem ela o alvo padrão é `public`,
-- que inclui `anon` — ou seja, qualquer pessoa com a chave anônima do
-- projeto tem ALL (SELECT/INSERT/UPDATE/DELETE) nestas tabelas:
--
--   notification_whatsapp_config  → chave da OpenAI e tokens do WhatsApp
--   whatsapp_assessor_logs        → histórico de conversas do assessor
--   whatsapp_assessor_sessoes     → sessões ativas
--
-- O service_role ignora RLS por natureza, então nenhuma dessas policies
-- é necessária para as edge functions continuarem funcionando.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Service role full access config"   ON public.notification_whatsapp_config;
DROP POLICY IF EXISTS "Service role full access logs"     ON public.whatsapp_assessor_logs;
DROP POLICY IF EXISTS "Service role full access sessoes"  ON public.whatsapp_assessor_sessoes;

-- Leitura por qualquer usuário logado — expunha as credenciais a todos
-- os gabinetes, não só ao super-admin.
DROP POLICY IF EXISTS "Authenticated read config" ON public.notification_whatsapp_config;

-- As policies superadmin_* liberavam também para has_role(uid,'admin'),
-- que é o papel de admin de gabinete: um tenant enxergava a credencial
-- global usada por todos os outros.
DROP POLICY IF EXISTS superadmin_select_notification_config ON public.notification_whatsapp_config;
DROP POLICY IF EXISTS superadmin_insert_notification_config ON public.notification_whatsapp_config;
DROP POLICY IF EXISTS superadmin_update_notification_config ON public.notification_whatsapp_config;
DROP POLICY IF EXISTS superadmin_delete_notification_config ON public.notification_whatsapp_config;

CREATE POLICY notification_config_superadmin ON public.notification_whatsapp_config
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

REVOKE ALL ON public.notification_whatsapp_config  FROM anon;
REVOKE ALL ON public.whatsapp_assessor_logs        FROM anon;
REVOKE ALL ON public.whatsapp_assessor_sessoes     FROM anon;

-- ------------------------------------------------------------
-- 4c. Trigger: aceitar credenciais W-API
--
-- A versão atual de trigger_notificar_usuario_whatsapp() só dispara se
-- zapi_instance_id, zapi_token E zapi_client_token estiverem preenchidos.
-- Sem esta atualização, limpar os campos da Z-API depois da migração faz
-- o trigger sair silencioso e NENHUMA notificação é enviada.
--
-- Mudou apenas o bloco de checagem de credenciais; o resto é idêntico.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_notificar_usuario_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_config RECORD;
  v_telefone text;
  v_nome text;
  v_func_url text;
  v_credenciais_ok boolean;
BEGIN
  SELECT * INTO v_config
  FROM public.notification_whatsapp_config
  WHERE ativo = true
  LIMIT 1;

  IF v_config IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_config.supabase_url IS NULL OR v_config.supabase_anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Credenciais do provedor ativo (W-API por padrão, Z-API como rollback)
  IF COALESCE(v_config.provedor, 'wapi') = 'zapi' THEN
    v_credenciais_ok := v_config.zapi_instance_id IS NOT NULL
                    AND v_config.zapi_token IS NOT NULL
                    AND v_config.zapi_client_token IS NOT NULL;
  ELSE
    v_credenciais_ok := v_config.wapi_instance_id IS NOT NULL
                    AND v_config.wapi_token IS NOT NULL;
  END IF;

  IF NOT v_credenciais_ok THEN
    RETURN NEW;
  END IF;

  IF NOT (v_config.tipos_ativos @> to_jsonb(NEW.tipo::text)) THEN
    RETURN NEW;
  END IF;

  SELECT telefone, nome INTO v_telefone, v_nome
  FROM public.profiles
  WHERE id = NEW.destinatario_id;

  IF v_telefone IS NULL OR trim(v_telefone) = '' THEN
    RETURN NEW;
  END IF;

  v_func_url := v_config.supabase_url || '/functions/v1/notificar-usuario-whatsapp';

  PERFORM net.http_post(
    url     := v_func_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_config.supabase_anon_key
    ),
    body    := jsonb_build_object(
      'notificacao_id',         NEW.id,
      'destinatario_id',        NEW.destinatario_id,
      'destinatario_nome',      COALESCE(v_nome, 'Usuário'),
      'destinatario_telefone',  v_telefone,
      'tipo',                   NEW.tipo,
      'titulo',                 NEW.titulo,
      'mensagem',               NEW.mensagem,
      'url_destino',            COALESCE(NEW.url_destino, ''),
      'tenant_id',              COALESCE(NEW.tenant_id::text, '')
    )
  );

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- NUNCA bloquear a criação da notificação interna
    RAISE WARNING '[notificar-usuario-whatsapp] Erro ao disparar: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------
-- 5. Agenda padrão para os gabinetes existentes
--    (mantém o comportamento atual de 3 envios/dia até que cada
--     gabinete ajuste seus próprios dias e horários)
-- ------------------------------------------------------------

INSERT INTO public.notificacao_whatsapp_agenda (tenant_id)
SELECT t.id FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

-- ------------------------------------------------------------
-- 6. Cron do despachante — roda a cada 5 minutos e cada tenant
--    decide, pelo seu fuso, se algum horário venceu.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.despachar_notificacoes_whatsapp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/despachar-notificacoes-whatsapp',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.unschedule('despachar-notificacoes-whatsapp')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'despachar-notificacoes-whatsapp'
);

SELECT cron.schedule(
  'despachar-notificacoes-whatsapp',
  '*/5 * * * *',
  'SELECT public.despachar_notificacoes_whatsapp();'
);

-- ------------------------------------------------------------
-- 7. updated_at automático na agenda
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_notificacao_agenda()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_notificacao_agenda ON public.notificacao_whatsapp_agenda;
CREATE TRIGGER trg_touch_notificacao_agenda
  BEFORE UPDATE ON public.notificacao_whatsapp_agenda
  FOR EACH ROW EXECUTE FUNCTION public.touch_notificacao_agenda();
