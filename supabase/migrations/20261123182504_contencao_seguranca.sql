-- ============================================================
-- Contenção de segurança — 23/11/2026
--
-- Fecha acessos que hoje permitem a qualquer visitante (só com a
-- chave anônima, que vai embutida no frontend) ou a qualquer
-- usuário logado:
--   1. criar conta admin sem login            (create_user_direct)
--   2. trocar de gabinete / se promover       (profiles)
--   3. entrar num gabinete pelo cadastro      (handle_new_user)
--   4. ler coordenadas de todos os gabinetes  (get_demandas_com_coordenadas)
--   5. ler dados de todos os gabinetes        (3 views SECURITY DEFINER)
--   6. gerar/revogar convite de representante de outro gabinete
--   7. ler/escrever a memória da IA de outro gabinete
--   8. chamar funções internas sem estar logado
--   9. cron do WhatsApp desativado rodando a cada 5 min
--
-- Nada aqui muda o uso normal do sistema: edge functions usam a
-- chave de serviço, e as telas do gabinete continuam com o mesmo
-- acesso de antes dentro do próprio gabinete.
--
-- "Contexto de servidor" abaixo = chamadas com service_role ou sem
-- JWT (trigger de cadastro do Auth, cron, SQL Editor). auth.role()
-- devolve 'anon' ou 'authenticated' só para chamadas vindas do app.
-- ============================================================


-- ------------------------------------------------------------
-- 1. create_user_direct: ninguém usa; inseria em auth.users com
--    papel admin sem checar quem chamava.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_user_direct(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------
-- 2. profiles: tenant_id, role_no_tenant e municipe_id deixam de
--    poder ser alterados pelo próprio usuário.
--
--    - tenant_id: só super admin (ou servidor)
--    - role_no_tenant / municipe_id: só admin do mesmo gabinete
--    - INSERT pelo app: bloqueado (perfis nascem no servidor)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_campos_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;  -- contexto de servidor
  END IF;

  IF public.is_superadmin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Perfis só podem ser criados pelo servidor'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Sem permissão para mudar o gabinete do usuário'
      USING ERRCODE = '42501';
  END IF;

  IF (NEW.role_no_tenant IS DISTINCT FROM OLD.role_no_tenant
      OR NEW.municipe_id IS DISTINCT FROM OLD.municipe_id)
     AND NOT (public.is_tenant_admin() AND OLD.tenant_id = public.get_my_tenant_id())
  THEN
    RAISE EXCEPTION 'Sem permissão para mudar o papel do usuário'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_campos_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_proteger_campos_profile ON public.profiles;
CREATE TRIGGER trg_proteger_campos_profile
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_profile();

-- Visitante sem login não tem por que escrever nessas tabelas
REVOKE INSERT, UPDATE, DELETE ON public.profiles   FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;


-- ------------------------------------------------------------
-- 3. handle_new_user: o tenant_id vinha de raw_user_meta_data,
--    que no cadastro público é preenchido pelo próprio usuário.
--    Os fluxos legítimos (create-user-custom, admin-create-user,
--    representante-accept-invite) gravam o perfil explicitamente
--    logo depois, com a chave de serviço — não dependem disto.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Perfil nasce sem gabinete e sem privilégio; quem cria o usuário
  -- (edge function com service_role) define gabinete e papel.
  INSERT INTO public.profiles (id, nome, email, tenant_id, role_no_tenant)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    NULL,
    'membro'
  )
  ON CONFLICT (id) DO UPDATE SET
    nome  = COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    email = NEW.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'usuario')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;


-- ------------------------------------------------------------
-- 4. Coordenadas de demandas: passam a respeitar o gabinete.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_demandas_com_coordenadas()
RETURNS TABLE(id uuid, latitude numeric, longitude numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT d.id, d.latitude, d.longitude
  FROM public.demandas d
  WHERE d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND (
      coalesce(auth.role(), '') NOT IN ('anon', 'authenticated')
      OR d.tenant_id = public.get_my_tenant_id()
      OR public.is_superadmin()
    );
$function$;

CREATE OR REPLACE FUNCTION public.buscar_coordenadas_demandas(demanda_ids uuid[])
RETURNS TABLE(id uuid, latitude numeric, longitude numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT d.id, d.latitude, d.longitude
  FROM public.demandas d
  WHERE d.id = ANY(demanda_ids)
    AND d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND (
      coalesce(auth.role(), '') NOT IN ('anon', 'authenticated')
      OR d.tenant_id = public.get_my_tenant_id()
      OR public.is_superadmin()
    );
$function$;


-- ------------------------------------------------------------
-- 5. Views: passam a rodar com as permissões de quem consulta,
--    então o RLS de analises_tematicas e whatsapp_envios vale.
-- ------------------------------------------------------------
ALTER VIEW public.temas_semana_atual        SET (security_invoker = true);
ALTER VIEW public.resumo_temas_por_tenant   SET (security_invoker = true);
ALTER VIEW public.vw_whatsapp_envios_resumo SET (security_invoker = true);

REVOKE ALL ON public.temas_semana_atual        FROM anon;
REVOKE ALL ON public.resumo_temas_por_tenant   FROM anon;
REVOKE ALL ON public.vw_whatsapp_envios_resumo FROM anon;


-- ------------------------------------------------------------
-- 6. Convite de representante: só alguém do gabinete do munícipe
--    (e que não seja representante) gera ou revoga.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_convite_representante(p_municipe_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token    text;
  v_expires  timestamptz;
  v_municipe record;
  v_servidor boolean := coalesce(auth.role(), '') NOT IN ('anon', 'authenticated')
                        OR public.is_superadmin();
BEGIN
  IF NOT v_servidor AND (auth.uid() IS NULL OR public.is_representante()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_municipe FROM public.municipes WHERE id = p_municipe_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Munícipe não encontrado';
  END IF;

  IF NOT v_servidor AND v_municipe.tenant_id IS DISTINCT FROM public.get_my_tenant_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_token   := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + interval '7 days';

  UPDATE public.municipes SET
    representante_ativo  = true,
    invite_token         = v_token,
    invite_expires_at    = v_expires,
    invite_token_usado   = false
  WHERE id = p_municipe_id;

  RETURN json_build_object(
    'token',      v_token,
    'expires_at', v_expires,
    'municipe',   v_municipe.nome
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.revogar_acesso_representante(p_municipe_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id uuid;
  v_tenant_id  uuid;
  v_servidor   boolean := coalesce(auth.role(), '') NOT IN ('anon', 'authenticated')
                          OR public.is_superadmin();
BEGIN
  IF NOT v_servidor THEN
    IF auth.uid() IS NULL OR public.is_representante() THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;

    SELECT tenant_id INTO v_tenant_id FROM public.municipes WHERE id = p_municipe_id;
    IF v_tenant_id IS DISTINCT FROM public.get_my_tenant_id() THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
  END IF;

  SELECT id INTO v_profile_id
    FROM public.profiles
   WHERE municipe_id = p_municipe_id
     AND role_no_tenant = 'representante'
   LIMIT 1;

  UPDATE public.municipes SET
    representante_ativo  = false,
    invite_token         = null,
    invite_expires_at    = null,
    invite_token_usado   = false
  WHERE id = p_municipe_id;

  IF v_profile_id IS NOT NULL THEN
    UPDATE public.profiles
       SET role_no_tenant = 'viewer',
           municipe_id    = null
     WHERE id = v_profile_id;
  END IF;
END;
$function$;


-- ------------------------------------------------------------
-- 7. Memória da IA: só o próprio gabinete lê e escreve.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_memorias_relevantes(p_tenant_id uuid, p_limite integer DEFAULT 15)
RETURNS TABLE(id uuid, categoria text, conteudo text, confianca numeric, vezes_usado integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    m.id,
    m.categoria,
    m.conteudo,
    m.confianca,
    m.vezes_usado
  FROM public.tenant_memoria_ia m
  WHERE
    m.tenant_id = p_tenant_id
    AND m.ativo  = true
    AND (
      coalesce(auth.role(), '') NOT IN ('anon', 'authenticated')
      OR p_tenant_id = public.get_my_tenant_id()
      OR public.is_superadmin()
    )
  ORDER BY
    CASE m.categoria WHEN 'correcao' THEN 1 ELSE 2 END ASC,
    m.confianca DESC,
    m.vezes_usado DESC,
    m.updated_at DESC
  LIMIT p_limite;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_memoria_ia(p_tenant_id uuid, p_categoria text, p_conteudo text, p_confianca numeric, p_origem text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_new_id      uuid;
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
     AND p_tenant_id IS DISTINCT FROM public.get_my_tenant_id()
     AND NOT public.is_superadmin()
  THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.tenant_memoria_ia
  WHERE
    tenant_id = p_tenant_id
    AND categoria = p_categoria
    AND ativo = true
    AND (
      LOWER(SUBSTRING(conteudo, 1, 100)) = LOWER(SUBSTRING(p_conteudo, 1, 100))
      OR conteudo ILIKE '%' || SUBSTRING(p_conteudo, 1, 60) || '%'
    )
  ORDER BY confianca DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.tenant_memoria_ia
    SET
      confianca  = LEAST(1.0, confianca + 0.05),
      updated_at = now()
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  ELSE
    INSERT INTO public.tenant_memoria_ia
      (tenant_id, categoria, conteudo, confianca, origem)
    VALUES
      (p_tenant_id, p_categoria, p_conteudo, p_confianca, p_origem)
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
  END IF;
END;
$function$;


-- ------------------------------------------------------------
-- 8. Funções internas: visitante sem login não executa.
--    Usuário logado e edge functions mantêm o acesso.
--    (validar_token_convite fica de fora: a página de convite
--     roda sem login e precisa dela.)
-- ------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = ANY (ARRAY[
        'get_demandas_com_coordenadas', 'buscar_coordenadas_demandas',
        'gerar_convite_representante', 'revogar_acesso_representante',
        'buscar_memorias_relevantes', 'upsert_memoria_ia',
        'registrar_uso_memoria', 'decair_memorias_ia',
        'increment_ia_usage', 'increment_mapbox_usage',
        'increment_openai_usage', 'increment_whatsapp_usage',
        'get_tenant_id_for_user',
        'agendar_exclusao_agenda', 'cancelar_exclusao_agenda'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.fn);
  END LOOP;
END;
$$;

-- Só o cron (postgres) chama esta
REVOKE ALL ON FUNCTION public.despachar_notificacoes_whatsapp() FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------
-- 9. Notificações por WhatsApp foram desativadas: parar o cron.
-- ------------------------------------------------------------
SELECT cron.unschedule('despachar-notificacoes-whatsapp')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'despachar-notificacoes-whatsapp');
