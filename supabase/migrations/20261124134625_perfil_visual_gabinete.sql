-- ============================================================
-- Identidade visual Jorgeus: perfil visual por gabinete — 24/11/2026
--
-- Manual da marca: o Super Admin escolhe, para cada gabinete, o perfil
-- "Brasil!" (azul, verde-esmeralda, ouro) ou "Jovem" (roxo, ciano,
-- magenta, lima). Claro/escuro é escolha de cada usuário (no navegador).
-- Todos os gabinetes começam em "brasil".
-- ============================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS perfil_visual text NOT NULL DEFAULT 'brasil';

DO $$ BEGIN
  ALTER TABLE public.tenants ADD CONSTRAINT tenants_perfil_visual_check
    CHECK (perfil_visual IN ('brasil', 'jovem'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Só o Super Admin troca o perfil (o admin do gabinete pode editar o
-- próprio cadastro pela regra tenant_update, mas não o perfil visual).
CREATE OR REPLACE FUNCTION public.tenants_proteger_perfil_visual()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.perfil_visual IS DISTINCT FROM OLD.perfil_visual
     AND auth.uid() IS NOT NULL AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Só o Super Admin pode mudar o perfil visual do gabinete';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tenants_proteger_perfil_visual() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tenants_proteger_perfil_visual ON public.tenants;
CREATE TRIGGER trg_tenants_proteger_perfil_visual
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.tenants_proteger_perfil_visual();

-- Super Admin define o perfil
CREATE OR REPLACE FUNCTION public.admin_set_tenant_perfil(p_tenant_id uuid, p_perfil text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas superadmins';
  END IF;
  IF p_perfil NOT IN ('brasil', 'jovem') THEN
    RAISE EXCEPTION 'Perfil visual inválido: %', p_perfil;
  END IF;
  UPDATE public.tenants SET perfil_visual = p_perfil, updated_at = now() WHERE id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant não encontrado'; END IF;
  RETURN json_build_object('tenant_id', p_tenant_id, 'perfil_visual', p_perfil);
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_tenant_perfil(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_perfil(uuid, text) TO authenticated;

-- Lista de gabinetes do Admin SaaS passa a trazer o perfil
CREATE OR REPLACE FUNCTION public.admin_list_tenants()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas superadmins';
  END IF;

  SELECT json_agg(row_data) INTO result
  FROM (
    SELECT
      t.id, t.nome, t.slug, t.plano, t.ativo,
      t.max_usuarios, t.max_municipes, t.max_demandas, t.created_at,
      t.perfil_visual,
      COALESCE((SELECT count(*) FROM profiles p WHERE p.tenant_id = t.id), 0)                            AS total_usuarios,
      COALESCE((SELECT count(*) FROM municipes m WHERE m.tenant_id = t.id), 0)                           AS total_municipes,
      COALESCE((SELECT count(*) FROM demandas d WHERE d.tenant_id = t.id), 0)                            AS total_demandas,
      COALESCE((SELECT count(*) FROM whatsapp_instances w WHERE w.tenant_id = t.id AND w.active = true), 0) AS total_whatsapp_instances,
      COALESCE(u.ia_chamadas,    0) AS openai_chamadas,
      COALESCE(u.ia_tokens_input,  0) AS openai_tokens_input,
      COALESCE(u.ia_tokens_output, 0) AS openai_tokens_output,
      COALESCE(u.whatsapp_envios, 0) AS whatsapp_envios,
      COALESCE(u.mapbox_requests, 0) AS mapbox_requests
    FROM tenants t
    LEFT JOIN tenant_usage u
      ON u.tenant_id = t.id
      AND u.mes = date_trunc('month', now())::date
    ORDER BY t.created_at DESC
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
