-- ============================================================
-- Jorginho, o mascote com IA do Jorgeus (27/11/2026)
--
--  - jorginho_uso: quantas perguntas cada pessoa fez por dia (limite
--    diário no servidor; o endpoint gratuito da NVIDIA tem cota).
--    Só a função do servidor grava; a pessoa só lê o próprio uso.
--  - jorginho_widgets: widgets criados na Oficina do Jorginho. São
--    "receitas" (tipo de visual + filtros), nunca código. O dono edita;
--    se marcar "compartilhado", a equipe do gabinete também vê.
-- Não altera nenhum dado existente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.jorginho_uso (
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia        date NOT NULL,
  perguntas  int  NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, dia)
);
ALTER TABLE public.jorginho_uso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS jorginho_uso_ler ON public.jorginho_uso;
CREATE POLICY jorginho_uso_ler ON public.jorginho_uso FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

-- Soma 1 pergunta no dia (fuso de Brasília) e devolve o total do dia
CREATE OR REPLACE FUNCTION public.jorginho_registrar_uso(p_usuario uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  INSERT INTO jorginho_uso (usuario_id, dia, perguntas)
  VALUES (p_usuario, (now() AT TIME ZONE 'America/Sao_Paulo')::date, 1)
  ON CONFLICT (usuario_id, dia) DO UPDATE SET perguntas = jorginho_uso.perguntas + 1
  RETURNING perguntas INTO n;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.jorginho_registrar_uso(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jorginho_registrar_uso(uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.jorginho_widgets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL DEFAULT public.get_my_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  dono_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo        text NOT NULL CHECK (length(titulo) BETWEEN 1 AND 80),
  pedido        text,
  spec          jsonb NOT NULL,
  compartilhado boolean NOT NULL DEFAULT false,
  ordem         int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jorginho_widgets_tenant ON public.jorginho_widgets (tenant_id, dono_id, ordem);
ALTER TABLE public.jorginho_widgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jorginho_widgets_ler ON public.jorginho_widgets;
CREATE POLICY jorginho_widgets_ler ON public.jorginho_widgets FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_my_tenant_id()) AND (dono_id = (SELECT auth.uid()) OR compartilhado));
DROP POLICY IF EXISTS jorginho_widgets_criar ON public.jorginho_widgets;
CREATE POLICY jorginho_widgets_criar ON public.jorginho_widgets FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_my_tenant_id()) AND dono_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS jorginho_widgets_editar ON public.jorginho_widgets;
CREATE POLICY jorginho_widgets_editar ON public.jorginho_widgets FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_my_tenant_id()) AND dono_id = (SELECT auth.uid()))
  WITH CHECK (tenant_id = (SELECT public.get_my_tenant_id()) AND dono_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS jorginho_widgets_apagar ON public.jorginho_widgets;
CREATE POLICY jorginho_widgets_apagar ON public.jorginho_widgets FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_my_tenant_id()) AND dono_id = (SELECT auth.uid()));
