-- ============================================================
-- Isolamento entre gabinetes — 24/11/2026
--
-- No Postgres, várias políticas PERMISSIVAS de uma tabela se somam
-- com OU: basta uma liberar a linha. Duas situações vazavam dados:
--
-- 1. demandas, municipes, demanda_atividades
--    Têm a regra do gabinete (tenant_iso_*) E uma regra de papel
--    (representante só vê o que é dele). Como se somavam com OU:
--      - atividades: a regra de papel libera "qualquer usuário logado",
--        então todo mundo via as atividades de TODOS os gabinetes;
--      - representante: a regra do gabinete liberava tudo do gabinete,
--        anulando a restrição "só o que é dele" (ler, editar, apagar).
--    Correção: a regra do gabinete passa a ser RESTRITIVA (E). Toda
--    linha precisa ser do gabinete do usuário E passar na regra de papel.
--
-- 2. kanban_boards, kanban_board_colunas, kanban_board_cards,
--    kanban_board_card_checklist, kanban_board_card_comentarios,
--    atividade_reacoes
--    Só tinham regras "true" / "qualquer logado": qualquer usuário de
--    qualquer gabinete podia ler, criar, alterar e apagar.
--    Correção: nova regra RESTRITIVA de gabinete para todas as operações.
--    (Todas têm tenant_id NOT NULL com default get_my_tenant_id().)
--
-- Edge functions (service_role) e funções SECURITY DEFINER (admin_*)
-- não passam por RLS e não são afetadas.
-- ============================================================

-- 1. tenant_iso_* viram restritivas em demandas, municipes, demanda_atividades
DO $$
DECLARE
  p record;
  v_cmd text;
  v_sql text;
BEGIN
  FOR p IN
    SELECT c.relname AS tabela, pol.polname AS politica, pol.polcmd AS cmd,
           pg_get_expr(pol.polqual, pol.polrelid)      AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk,
           coalesce((SELECT string_agg(quote_ident(r.rolname), ', ')
                     FROM pg_roles r WHERE r.oid = ANY (pol.polroles)), 'public') AS papeis
    FROM pg_policy pol
    JOIN pg_class c     ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('demandas', 'municipes', 'demanda_atividades')
      AND pol.polname LIKE 'tenant\_iso\_%'
      AND pol.polpermissive
  LOOP
    v_cmd := CASE p.cmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                        WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END;

    EXECUTE format('DROP POLICY %I ON public.%I', p.politica, p.tabela);

    v_sql := format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO %s',
                    p.politica, p.tabela, v_cmd, p.papeis);
    IF p.qual IS NOT NULL THEN v_sql := v_sql || format(' USING (%s)', p.qual); END IF;
    IF p.chk  IS NOT NULL THEN v_sql := v_sql || format(' WITH CHECK (%s)', p.chk); END IF;
    EXECUTE v_sql;
  END LOOP;
END;
$$;


-- 2. Regra restritiva de gabinete nas tabelas que não checavam gabinete
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kanban_boards', 'kanban_board_colunas', 'kanban_board_cards',
    'kanban_board_card_checklist', 'kanban_board_card_comentarios',
    'atividade_reacoes'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_iso_restrito ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_iso_restrito ON public.%I AS RESTRICTIVE FOR ALL TO public '
      || 'USING (tenant_id = (SELECT public.get_my_tenant_id())) '
      || 'WITH CHECK (tenant_id = (SELECT public.get_my_tenant_id()))', t);
  END LOOP;
END;
$$;
