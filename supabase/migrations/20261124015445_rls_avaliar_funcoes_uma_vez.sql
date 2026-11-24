-- ============================================================
-- Desempenho das regras de acesso (RLS) — 24/11/2026
--
-- As políticas chamavam get_my_tenant_id(), is_representante(),
-- is_superadmin(), is_tenant_admin(), auth.uid() e auth.role()
-- diretamente. O Postgres reavaliava essas funções PARA CADA LINHA:
-- em munícipes (13.673 linhas) uma busca levava ~0,9 s sozinha e,
-- com várias consultas ao mesmo tempo, passava do limite de 8 s.
--
-- Envolver a chamada em (SELECT ...) faz o Postgres calculá-la uma
-- única vez por consulta (InitPlan). O resultado é o mesmo, porque
-- essas funções não dependem da linha — só de quem está logado.
-- Recomendação oficial do Supabase (lint auth_rls_initplan).
--
-- Nada muda em quem enxerga o quê. A reescrita é idempotente: não
-- mexe em chamadas que já estão dentro de (SELECT ...).
-- ============================================================

CREATE OR REPLACE FUNCTION pg_temp.otimizar_expr_rls(e text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
           regexp_replace(
             e,
             '(?<!SELECT )\m(get_my_tenant_id|is_representante|is_superadmin|is_tenant_admin)\(\)',
             '(SELECT \1())', 'g'),
           '(?<!SELECT )\mauth\.(uid|role|jwt)\(\)',
           '(SELECT auth.\1())', 'g');
$$;

DO $$
DECLARE
  p record;
  v_qual text;
  v_chk  text;
  v_sql  text;
  v_total int := 0;
BEGIN
  FOR p IN
    SELECT n.nspname AS esquema, c.relname AS tabela, pol.polname AS politica,
           pg_get_expr(pol.polqual, pol.polrelid)      AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
    FROM pg_policy pol
    JOIN pg_class c     ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    v_qual := pg_temp.otimizar_expr_rls(p.qual);
    v_chk  := pg_temp.otimizar_expr_rls(p.chk);

    IF v_qual IS DISTINCT FROM p.qual OR v_chk IS DISTINCT FROM p.chk THEN
      v_sql := format('ALTER POLICY %I ON %I.%I', p.politica, p.esquema, p.tabela);
      IF v_qual IS NOT NULL THEN v_sql := v_sql || format(' USING (%s)', v_qual); END IF;
      IF v_chk  IS NOT NULL THEN v_sql := v_sql || format(' WITH CHECK (%s)', v_chk); END IF;
      EXECUTE v_sql;
      v_total := v_total + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Políticas otimizadas: %', v_total;
END;
$$;
