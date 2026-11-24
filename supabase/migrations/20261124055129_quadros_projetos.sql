-- ============================================================
-- Quadros: projetos com membros — 24/11/2026
--
-- Decisões do gabinete:
--   - todo o gabinete VÊ os projetos;
--   - só MEMBROS do projeto criam, editam, movem e excluem cartões,
--     colunas, checklist e comentários;
--   - QUALQUER pessoa do gabinete pode criar um projeto (e vira membro).
--
-- Novidades nos cartões de projeto:
--   - colaboradores (além do responsável);
--   - várias demandas vinculadas por cartão;
--   - histórico automático (gravado pelo banco, não pelo app).
--
-- Nada existente é apagado. Os membros iniciais de cada projeto atual
-- são quem já trabalha nele: quem criou o projeto, responsáveis e
-- criadores de cartões e autores de comentários.
-- ============================================================


-- ── 1. Tabelas novas ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kanban_board_membros (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL DEFAULT public.get_my_tenant_id(),
  board_id   uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_kanban_board_membros_usuario ON public.kanban_board_membros (usuario_id);

CREATE TABLE IF NOT EXISTS public.kanban_board_card_colaboradores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL DEFAULT public.get_my_tenant_id(),
  card_id    uuid NOT NULL REFERENCES public.kanban_board_cards(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_kanban_card_colab_usuario ON public.kanban_board_card_colaboradores (usuario_id);

CREATE TABLE IF NOT EXISTS public.kanban_board_card_demandas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL DEFAULT public.get_my_tenant_id(),
  card_id    uuid NOT NULL REFERENCES public.kanban_board_cards(id) ON DELETE CASCADE,
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, demanda_id)
);
CREATE INDEX IF NOT EXISTS idx_kanban_card_demandas_demanda ON public.kanban_board_card_demandas (demanda_id);

CREATE TABLE IF NOT EXISTS public.kanban_board_card_historico (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  card_id    uuid NOT NULL REFERENCES public.kanban_board_cards(id) ON DELETE CASCADE,
  usuario_id uuid DEFAULT auth.uid(),
  acao       text NOT NULL,      -- criou, moveu, prazo, responsavel, renomeou, checklist_*, colaborador_*, demanda_*
  detalhe    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kanban_card_hist_card ON public.kanban_board_card_historico (card_id, created_at DESC);


-- ── 2. Quem é membro ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.e_membro_do_quadro(p_board uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_board_membros m
    WHERE m.board_id = p_board AND m.usuario_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.e_membro_do_card(p_card uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_board_cards c
    JOIN public.kanban_board_membros m ON m.board_id = c.board_id
    WHERE c.id = p_card AND m.usuario_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.e_membro_do_quadro(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.e_membro_do_card(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e_membro_do_quadro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.e_membro_do_card(uuid) TO authenticated;

-- Quem cria o projeto vira membro (antes das colunas padrão serem inseridas)
CREATE OR REPLACE FUNCTION public.kanban_board_criador_membro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.kanban_board_membros (tenant_id, board_id, usuario_id)
  VALUES (NEW.tenant_id, NEW.id, coalesce(NEW.criado_por, auth.uid()))
  ON CONFLICT (board_id, usuario_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.kanban_board_criador_membro() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kanban_board_criador_membro ON public.kanban_boards;
CREATE TRIGGER trg_kanban_board_criador_membro
  AFTER INSERT ON public.kanban_boards
  FOR EACH ROW EXECUTE FUNCTION public.kanban_board_criador_membro();


-- ── 3. Membros iniciais dos projetos que já existem ─────────────

INSERT INTO public.kanban_board_membros (tenant_id, board_id, usuario_id)
SELECT DISTINCT b.tenant_id, b.id, x.usuario_id
FROM public.kanban_boards b
CROSS JOIN LATERAL (
  SELECT b.criado_por AS usuario_id
  UNION SELECT c.responsavel_id FROM public.kanban_board_cards c WHERE c.board_id = b.id
  UNION SELECT c.created_by     FROM public.kanban_board_cards c WHERE c.board_id = b.id
  UNION SELECT cm.autor_id      FROM public.kanban_board_card_comentarios cm
                                JOIN public.kanban_board_cards c ON c.id = cm.card_id
                                WHERE c.board_id = b.id
) x
JOIN public.profiles p ON p.id = x.usuario_id AND p.tenant_id = b.tenant_id
WHERE x.usuario_id IS NOT NULL
ON CONFLICT (board_id, usuario_id) DO NOTHING;


-- ── 4. Regras de acesso ─────────────────────────────────────────
-- Leitura: continua liberada no gabinete (regra existente + isolamento
-- restritivo por gabinete). Escrita: só membros.

-- Projetos: qualquer um cria; só membros alteram/arquivam/excluem
DROP POLICY IF EXISTS "Authenticated users can update kanban_boards" ON public.kanban_boards;
DROP POLICY IF EXISTS "Authenticated users can delete kanban_boards" ON public.kanban_boards;
CREATE POLICY membros_alteram_quadro ON public.kanban_boards FOR UPDATE TO authenticated
  USING ((SELECT public.e_membro_do_quadro(id))) WITH CHECK ((SELECT public.e_membro_do_quadro(id)));
CREATE POLICY membros_excluem_quadro ON public.kanban_boards FOR DELETE TO authenticated
  USING ((SELECT public.e_membro_do_quadro(id)));

-- Colunas e cartões: só membros do projeto
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kanban_board_colunas', 'kanban_board_cards'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated users can insert ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated users can update ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated users can delete ' || t, t);
    EXECUTE format('CREATE POLICY membros_criam ON public.%I FOR INSERT TO authenticated WITH CHECK (public.e_membro_do_quadro(board_id))', t);
    EXECUTE format('CREATE POLICY membros_alteram ON public.%I FOR UPDATE TO authenticated USING (public.e_membro_do_quadro(board_id)) WITH CHECK (public.e_membro_do_quadro(board_id))', t);
    EXECUTE format('CREATE POLICY membros_excluem ON public.%I FOR DELETE TO authenticated USING (public.e_membro_do_quadro(board_id))', t);
  END LOOP;
END $$;

-- Checklist e comentários: só membros do projeto do cartão
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kanban_board_card_checklist', 'kanban_board_card_comentarios'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated users can insert ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated users can update ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated users can delete ' || t, t);
    EXECUTE format('CREATE POLICY membros_criam ON public.%I FOR INSERT TO authenticated WITH CHECK (public.e_membro_do_card(card_id))', t);
    EXECUTE format('CREATE POLICY membros_alteram ON public.%I FOR UPDATE TO authenticated USING (public.e_membro_do_card(card_id)) WITH CHECK (public.e_membro_do_card(card_id))', t);
    EXECUTE format('CREATE POLICY membros_excluem ON public.%I FOR DELETE TO authenticated USING (public.e_membro_do_card(card_id))', t);
  END LOOP;
END $$;

-- Tabelas novas: todos do gabinete leem; só membros escrevem
ALTER TABLE public.kanban_board_membros           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_board_card_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_board_card_demandas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_board_card_historico     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kanban_board_membros', 'kanban_board_card_colaboradores', 'kanban_board_card_demandas', 'kanban_board_card_historico'] LOOP
    EXECUTE format('CREATE POLICY tenant_iso_restrito ON public.%I AS RESTRICTIVE FOR ALL TO public USING (tenant_id = (SELECT public.get_my_tenant_id())) WITH CHECK (tenant_id = (SELECT public.get_my_tenant_id()))', t);
    EXECUTE format('CREATE POLICY gabinete_le ON public.%I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;
END $$;

-- Membros: membros incluem e removem membros; cada um pode sair sozinho
CREATE POLICY membros_incluem ON public.kanban_board_membros FOR INSERT TO authenticated
  WITH CHECK (public.e_membro_do_quadro(board_id));
CREATE POLICY membros_removem ON public.kanban_board_membros FOR DELETE TO authenticated
  USING (public.e_membro_do_quadro(board_id) OR usuario_id = (SELECT auth.uid()));

CREATE POLICY membros_criam ON public.kanban_board_card_colaboradores FOR INSERT TO authenticated
  WITH CHECK (public.e_membro_do_card(card_id));
CREATE POLICY membros_excluem ON public.kanban_board_card_colaboradores FOR DELETE TO authenticated
  USING (public.e_membro_do_card(card_id));

CREATE POLICY membros_criam ON public.kanban_board_card_demandas FOR INSERT TO authenticated
  WITH CHECK (public.e_membro_do_card(card_id));
CREATE POLICY membros_excluem ON public.kanban_board_card_demandas FOR DELETE TO authenticated
  USING (public.e_membro_do_card(card_id));
-- Histórico: só o banco escreve (triggers abaixo, SECURITY DEFINER)

GRANT SELECT, INSERT, DELETE ON public.kanban_board_membros, public.kanban_board_card_colaboradores, public.kanban_board_card_demandas TO authenticated;
GRANT SELECT ON public.kanban_board_card_historico TO authenticated;
REVOKE ALL ON public.kanban_board_membros, public.kanban_board_card_colaboradores, public.kanban_board_card_demandas, public.kanban_board_card_historico FROM anon;


-- ── 5. Histórico automático ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.kanban_card_registrar(p_card uuid, p_tenant uuid, p_acao text, p_detalhe jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.kanban_board_card_historico (tenant_id, card_id, usuario_id, acao, detalhe)
  VALUES (p_tenant, p_card, auth.uid(), p_acao, p_detalhe);
$$;
REVOKE ALL ON FUNCTION public.kanban_card_registrar(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.kanban_card_hist_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.kanban_card_registrar(NEW.id, NEW.tenant_id, 'criou', jsonb_build_object('titulo', NEW.titulo));
    RETURN NEW;
  END IF;
  IF NEW.coluna_id IS DISTINCT FROM OLD.coluna_id THEN
    PERFORM public.kanban_card_registrar(NEW.id, NEW.tenant_id, 'moveu', jsonb_build_object(
      'de', (SELECT nome FROM public.kanban_board_colunas WHERE id = OLD.coluna_id),
      'para', (SELECT nome FROM public.kanban_board_colunas WHERE id = NEW.coluna_id)));
  END IF;
  IF NEW.data_prazo IS DISTINCT FROM OLD.data_prazo THEN
    PERFORM public.kanban_card_registrar(NEW.id, NEW.tenant_id, 'prazo', jsonb_build_object('de', OLD.data_prazo, 'para', NEW.data_prazo));
  END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    PERFORM public.kanban_card_registrar(NEW.id, NEW.tenant_id, 'responsavel', jsonb_build_object(
      'de', (SELECT nome FROM public.profiles WHERE id = OLD.responsavel_id),
      'para', (SELECT nome FROM public.profiles WHERE id = NEW.responsavel_id)));
  END IF;
  IF NEW.titulo IS DISTINCT FROM OLD.titulo THEN
    PERFORM public.kanban_card_registrar(NEW.id, NEW.tenant_id, 'renomeou', jsonb_build_object('de', OLD.titulo, 'para', NEW.titulo));
  END IF;
  IF NEW.arquivado_em IS DISTINCT FROM OLD.arquivado_em THEN
    PERFORM public.kanban_card_registrar(NEW.id, NEW.tenant_id, CASE WHEN NEW.arquivado_em IS NULL THEN 'desarquivou' ELSE 'arquivou' END, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kanban_card_hist_filhos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_card uuid;
  v_tenant uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  v_card := r.card_id;
  v_tenant := r.tenant_id;
  -- Cartão excluído em cascata: não registrar (o histórico some junto)
  IF NOT EXISTS (SELECT 1 FROM public.kanban_board_cards WHERE id = v_card) THEN
    RETURN r;
  END IF;

  IF TG_TABLE_NAME = 'kanban_board_card_checklist' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.kanban_card_registrar(v_card, v_tenant, 'checklist_incluiu', jsonb_build_object('item', NEW.texto));
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.kanban_card_registrar(v_card, v_tenant, 'checklist_excluiu', jsonb_build_object('item', OLD.texto));
    ELSIF NEW.concluido IS DISTINCT FROM OLD.concluido THEN
      PERFORM public.kanban_card_registrar(v_card, v_tenant, CASE WHEN NEW.concluido THEN 'checklist_concluiu' ELSE 'checklist_reabriu' END, jsonb_build_object('item', NEW.texto));
    END IF;
  ELSIF TG_TABLE_NAME = 'kanban_board_card_colaboradores' THEN
    PERFORM public.kanban_card_registrar(v_card, v_tenant,
      CASE WHEN TG_OP = 'INSERT' THEN 'colaborador_incluiu' ELSE 'colaborador_removeu' END,
      jsonb_build_object('pessoa', (SELECT nome FROM public.profiles WHERE id = r.usuario_id)));
  ELSIF TG_TABLE_NAME = 'kanban_board_card_demandas' THEN
    PERFORM public.kanban_card_registrar(v_card, v_tenant,
      CASE WHEN TG_OP = 'INSERT' THEN 'demanda_vinculou' ELSE 'demanda_desvinculou' END,
      jsonb_build_object('protocolo', (SELECT protocolo FROM public.demandas WHERE id = r.demanda_id)));
  END IF;
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.kanban_card_hist_card() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kanban_card_hist_filhos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kanban_card_hist ON public.kanban_board_cards;
CREATE TRIGGER trg_kanban_card_hist
  AFTER INSERT OR UPDATE ON public.kanban_board_cards
  FOR EACH ROW EXECUTE FUNCTION public.kanban_card_hist_card();

DROP TRIGGER IF EXISTS trg_kanban_ck_hist ON public.kanban_board_card_checklist;
CREATE TRIGGER trg_kanban_ck_hist
  AFTER INSERT OR UPDATE OR DELETE ON public.kanban_board_card_checklist
  FOR EACH ROW EXECUTE FUNCTION public.kanban_card_hist_filhos();

DROP TRIGGER IF EXISTS trg_kanban_colab_hist ON public.kanban_board_card_colaboradores;
CREATE TRIGGER trg_kanban_colab_hist
  AFTER INSERT OR DELETE ON public.kanban_board_card_colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.kanban_card_hist_filhos();

DROP TRIGGER IF EXISTS trg_kanban_dem_hist ON public.kanban_board_card_demandas;
CREATE TRIGGER trg_kanban_dem_hist
  AFTER INSERT OR DELETE ON public.kanban_board_card_demandas
  FOR EACH ROW EXECUTE FUNCTION public.kanban_card_hist_filhos();
