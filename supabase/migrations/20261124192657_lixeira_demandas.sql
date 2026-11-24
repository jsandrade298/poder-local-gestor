-- ============================================================
-- Lixeira de demandas (24/11/2026)
--
-- Excluir uma demanda era definitivo e levava junto atividades, anexos e
-- vínculos com cartões. Agora "excluir" manda para a lixeira:
--   - a demanda some de todas as telas (regra RESTRICTIVE de leitura);
--   - dá para restaurar em até 30 dias;
--   - depois de 30 dias (ou ao "excluir de vez") sai do banco, e o app
--     apaga os arquivos dos anexos no Storage.
-- Nenhuma demanda existente muda: a coluna nova começa vazia.
-- ============================================================

ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS excluida_em timestamptz,
  ADD COLUMN IF NOT EXISTS excluida_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS demandas_lixeira_idx ON public.demandas (tenant_id, excluida_em) WHERE excluida_em IS NOT NULL;

-- Some de todas as leituras normais (e, por consequência, de edições)
DROP POLICY IF EXISTS fora_da_lixeira ON public.demandas;
CREATE POLICY fora_da_lixeira ON public.demandas AS RESTRICTIVE FOR SELECT TO authenticated
  USING (excluida_em IS NULL);

-- Quem pode mexer na lixeira: quem pode excluir demandas (equipe do gabinete,
-- não representante), sempre no próprio gabinete.
CREATE OR REPLACE FUNCTION public.pode_usar_lixeira()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND NOT public.is_representante() AND public.get_my_tenant_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.lixeira_mover_demandas(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.pode_usar_lixeira() THEN RAISE EXCEPTION 'Sem permissão para excluir demandas'; END IF;
  UPDATE public.demandas SET excluida_em = now(), excluida_por = auth.uid()
   WHERE id = ANY(p_ids) AND tenant_id = public.get_my_tenant_id() AND excluida_em IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.lixeira_restaurar_demandas(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.pode_usar_lixeira() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.demandas SET excluida_em = NULL, excluida_por = NULL
   WHERE id = ANY(p_ids) AND tenant_id = public.get_my_tenant_id() AND excluida_em IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.lixeira_listar_demandas()
RETURNS TABLE(id uuid, protocolo text, titulo text, status text, municipe_nome text,
              excluida_em timestamptz, excluida_por_nome text, anexos bigint, atividades bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.protocolo::text, d.titulo, d.status::text, m.nome, d.excluida_em, p.nome,
         (SELECT count(*) FROM public.anexos a WHERE a.demanda_id = d.id),
         (SELECT count(*) FROM public.demanda_atividades t WHERE t.demanda_id = d.id)
    FROM public.demandas d
    LEFT JOIN public.municipes m ON m.id = d.municipe_id
    LEFT JOIN public.profiles p ON p.id = d.excluida_por
   WHERE public.pode_usar_lixeira()
     AND d.tenant_id = public.get_my_tenant_id()
     AND d.excluida_em IS NOT NULL
   ORDER BY d.excluida_em DESC;
$$;

-- Excluir de vez: as escolhidas (p_ids) ou, sem p_ids, as que estão na
-- lixeira há mais de 30 dias. Devolve os caminhos dos anexos para o app
-- apagar os arquivos no Storage.
CREATE OR REPLACE FUNCTION public.lixeira_excluir_definitivo(p_ids uuid[] DEFAULT NULL)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE alvos uuid[]; caminhos text[];
BEGIN
  IF NOT public.pode_usar_lixeira() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT coalesce(array_agg(d.id), '{}') INTO alvos
    FROM public.demandas d
   WHERE d.tenant_id = public.get_my_tenant_id()
     AND d.excluida_em IS NOT NULL
     AND (CASE WHEN p_ids IS NULL THEN d.excluida_em < now() - interval '30 days' ELSE d.id = ANY(p_ids) END);
  IF cardinality(alvos) = 0 THEN RETURN '{}'; END IF;
  SELECT coalesce(array_agg(a.url_arquivo) FILTER (WHERE a.url_arquivo IS NOT NULL), '{}') INTO caminhos
    FROM public.anexos a WHERE a.demanda_id = ANY(alvos);
  DELETE FROM public.demandas WHERE id = ANY(alvos);
  RETURN caminhos;
END $$;

REVOKE ALL ON FUNCTION public.lixeira_mover_demandas(uuid[]), public.lixeira_restaurar_demandas(uuid[]),
  public.lixeira_listar_demandas(), public.lixeira_excluir_definitivo(uuid[]), public.pode_usar_lixeira() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lixeira_mover_demandas(uuid[]), public.lixeira_restaurar_demandas(uuid[]),
  public.lixeira_listar_demandas(), public.lixeira_excluir_definitivo(uuid[]), public.pode_usar_lixeira() TO authenticated;

-- Funções que leem demandas por fora das regras de leitura: ignorar a lixeira
CREATE OR REPLACE FUNCTION public.buscar_coordenadas_demandas(demanda_ids uuid[])
 RETURNS TABLE(id uuid, latitude numeric, longitude numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT d.id, d.latitude, d.longitude
  FROM public.demandas d
  WHERE d.id = ANY(demanda_ids)
    AND d.excluida_em IS NULL
    AND d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND (
      coalesce(auth.role(), '') NOT IN ('anon', 'authenticated')
      OR d.tenant_id = public.get_my_tenant_id()
      OR public.is_superadmin()
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_demandas_com_coordenadas()
 RETURNS TABLE(id uuid, latitude numeric, longitude numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT d.id, d.latitude, d.longitude
  FROM public.demandas d
  WHERE d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND d.excluida_em IS NULL
    AND (
      coalesce(auth.role(), '') NOT IN ('anon', 'authenticated')
      OR d.tenant_id = public.get_my_tenant_id()
      OR public.is_superadmin()
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_demandas_count_por_municipe()
 RETURNS TABLE(municipe_id uuid, total bigint, statuses text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT d.municipe_id, COUNT(*) AS total, ARRAY_AGG(DISTINCT d.status) AS statuses
  FROM demandas d
  WHERE d.tenant_id = get_my_tenant_id() AND d.excluida_em IS NULL
  GROUP BY d.municipe_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_demandas_por_municipe()
 RETURNS TABLE(municipe_id uuid, status text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT d.municipe_id, d.status
  FROM demandas d
  WHERE d.tenant_id = get_my_tenant_id() AND d.excluida_em IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.get_distinct_bairros_demandas()
 RETURNS TABLE(bairro text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT d.bairro
  FROM demandas d
  WHERE d.bairro IS NOT NULL AND d.bairro <> ''
    AND d.tenant_id = get_my_tenant_id() AND d.excluida_em IS NULL
  ORDER BY d.bairro;
$function$;

CREATE OR REPLACE FUNCTION public.get_distinct_cidades_demandas()
 RETURNS TABLE(cidade text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT d.cidade
  FROM demandas d
  WHERE d.cidade IS NOT NULL AND d.cidade <> ''
    AND d.tenant_id = get_my_tenant_id() AND d.excluida_em IS NULL
  ORDER BY d.cidade;
$function$;
