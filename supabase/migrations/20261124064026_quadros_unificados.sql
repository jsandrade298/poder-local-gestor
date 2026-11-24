-- ============================================================
-- Quadros unificados — 24/11/2026
--
-- O Kanban antigo (tabelas tarefas / demanda_kanbans) passa para o
-- modelo de Quadros (kanban_boards / kanban_board_cards):
--   • "Produção Legislativa"  → quadro de EQUIPE: todo o gabinete edita
--                                (como antes), inclusive quem entrar depois.
--   • "Meu quadro" de cada um → quadro PESSOAL: o gabinete vê, só o dono
--                                edita (decisão do gabinete, 24/11/2026).
--   • Projetos                → como já eram (membros editam).
--
-- Em qualquer quadro, quem é RESPONSÁVEL ou COLABORADOR de um cartão
-- pode editar aquele cartão (mover, checklist, comentar).
--
-- Nada é apagado: tarefas, demanda_kanbans, tarefa_colaboradores e
-- tarefa_comentarios ficam como estão (cópia de segurança). Cada cartão
-- novo guarda de onde veio (origem, origem_id), o que também permite
-- abrir links antigos (/kanban?tarefa=...). Rodar de novo não duplica.
-- ============================================================


-- ── 1. Tipo de quadro e origem do cartão ────────────────────────

ALTER TABLE public.kanban_boards
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'projeto',
  ADD COLUMN IF NOT EXISTS dono_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.kanban_boards ADD CONSTRAINT kanban_boards_tipo_check
    CHECK (tipo IN ('projeto', 'equipe', 'pessoal'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.kanban_boards ADD CONSTRAINT kanban_boards_pessoal_tem_dono
    CHECK (tipo <> 'pessoal' OR dono_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Um quadro de equipe por gabinete; um quadro pessoal por pessoa
CREATE UNIQUE INDEX IF NOT EXISTS ux_kanban_boards_equipe
  ON public.kanban_boards (tenant_id) WHERE tipo = 'equipe';
CREATE UNIQUE INDEX IF NOT EXISTS ux_kanban_boards_pessoal
  ON public.kanban_boards (dono_id) WHERE tipo = 'pessoal';

ALTER TABLE public.kanban_board_cards
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS origem_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS ux_kanban_cards_origem
  ON public.kanban_board_cards (origem, origem_id) WHERE origem_id IS NOT NULL;

-- Quem cria vira membro — exceto quando não há criador (quadro de equipe
-- criado pelo sistema: lá todos já editam).
CREATE OR REPLACE FUNCTION public.kanban_board_criador_membro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_quem uuid := coalesce(NEW.criado_por, auth.uid());
BEGIN
  IF v_quem IS NOT NULL AND NEW.tipo <> 'equipe' THEN
    INSERT INTO public.kanban_board_membros (tenant_id, board_id, usuario_id)
    VALUES (NEW.tenant_id, NEW.id, v_quem)
    ON CONFLICT (board_id, usuario_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Quem cria um quadro pessoal só pode criá-lo para si
CREATE OR REPLACE FUNCTION public.kanban_board_validar_tipo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.tipo = 'pessoal' AND NEW.dono_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Quadro pessoal só pode ser criado pelo próprio dono';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.dono_id IS DISTINCT FROM OLD.dono_id) THEN
      RAISE EXCEPTION 'O tipo e o dono do quadro não podem ser alterados';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.kanban_board_validar_tipo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kanban_board_validar_tipo ON public.kanban_boards;
CREATE TRIGGER trg_kanban_board_validar_tipo
  BEFORE INSERT OR UPDATE ON public.kanban_boards
  FOR EACH ROW EXECUTE FUNCTION public.kanban_board_validar_tipo();


-- ── 2. Quem edita ───────────────────────────────────────────────

-- Membro do quadro: está na lista de membros, ou o quadro é de equipe
-- (todo o gabinete). Isolamento por gabinete garantido aqui também.
CREATE OR REPLACE FUNCTION public.e_membro_do_quadro(p_board uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_boards b
    WHERE b.id = p_board
      AND b.tenant_id = public.get_my_tenant_id()
      AND (
        b.tipo = 'equipe'
        OR EXISTS (SELECT 1 FROM public.kanban_board_membros m
                   WHERE m.board_id = b.id AND m.usuario_id = auth.uid())
      )
  );
$$;

-- Pode mexer no cartão: membro do quadro, responsável ou colaborador
CREATE OR REPLACE FUNCTION public.e_membro_do_card(p_card uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_board_cards c
    WHERE c.id = p_card
      AND (
        public.e_membro_do_quadro(c.board_id)
        OR c.responsavel_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.kanban_board_card_colaboradores k
                   WHERE k.card_id = c.id AND k.usuario_id = auth.uid())
      )
  );
$$;

-- Responsável e colaboradores também alteram o próprio cartão
DROP POLICY IF EXISTS participantes_alteram ON public.kanban_board_cards;
CREATE POLICY participantes_alteram ON public.kanban_board_cards FOR UPDATE TO authenticated
  USING ((SELECT public.e_membro_do_card(id)))
  WITH CHECK ((SELECT public.e_membro_do_card(id)));


-- ── 3. Migração do Kanban antigo ────────────────────────────────
-- O histórico automático é desligado durante a cópia (senão cada cartão
-- ganharia linhas "criou / incluiu colaborador" com a data de hoje);
-- no lugar, cada cartão recebe uma linha "trazido do Kanban antigo".

ALTER TABLE public.kanban_board_cards DISABLE TRIGGER trg_kanban_card_hist;
ALTER TABLE public.kanban_board_cards DISABLE TRIGGER update_kanban_board_cards_updated_at;
ALTER TABLE public.kanban_board_card_colaboradores DISABLE TRIGGER trg_kanban_colab_hist;
ALTER TABLE public.kanban_board_card_demandas DISABLE TRIGGER trg_kanban_dem_hist;

-- 3a. Quadros de equipe (um por gabinete que usava a Produção Legislativa).
-- "Criado por" (obrigatório) = quem mais criou tarefas nele; senão, a
-- primeira pessoa cadastrada no gabinete. Não muda quem edita (todos).
INSERT INTO public.kanban_boards (tenant_id, nome, descricao, cor, icone, tipo, criado_por, created_at)
SELECT x.tenant_id, 'Produção Legislativa',
  'Quadro da equipe: todo o gabinete vê e edita.', '#0f766e', '⚖️', 'equipe',
  coalesce(
    (SELECT t.created_by FROM public.tarefas t JOIN public.profiles p ON p.id = t.created_by
     WHERE t.tenant_id = x.tenant_id AND t.kanban_type = 'producao-legislativa'
     GROUP BY t.created_by ORDER BY count(*) DESC LIMIT 1),
    (SELECT p.id FROM public.profiles p WHERE p.tenant_id = x.tenant_id ORDER BY p.created_at LIMIT 1)
  ),
  now()
FROM (
  SELECT tenant_id FROM public.tarefas WHERE kanban_type = 'producao-legislativa'
  UNION SELECT tenant_id FROM public.demanda_kanbans WHERE kanban_type = 'producao-legislativa'
) x
WHERE x.tenant_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3b. Quadros pessoais (um por dono de "Meu quadro" com algo dentro)
INSERT INTO public.kanban_boards (tenant_id, nome, descricao, cor, icone, tipo, dono_id, criado_por, created_at)
SELECT DISTINCT ON (p.id) p.tenant_id, 'Quadro de ' || coalesce(nullif(p.nome, ''), 'sem nome'),
  'Quadro pessoal: o gabinete vê, só o dono edita.', '#475569', '🗂️', 'pessoal', p.id, p.id, now()
FROM (
  SELECT kanban_type FROM public.tarefas WHERE kanban_type ~ '^[0-9a-f-]{36}$'
  UNION SELECT kanban_type FROM public.demanda_kanbans WHERE kanban_type ~ '^[0-9a-f-]{36}$'
) x
JOIN public.profiles p ON p.id = x.kanban_type::uuid
WHERE p.tenant_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3c. Etapas (as mesmas do Kanban antigo), só nos quadros sem etapas
INSERT INTO public.kanban_board_colunas (tenant_id, board_id, nome, slug, cor, ordem)
SELECT b.tenant_id, b.id, e.nome, e.slug, e.cor, e.ordem
FROM public.kanban_boards b
CROSS JOIN (VALUES ('A Fazer', 'a_fazer', '#3b82f6', 1),
                   ('Em Progresso', 'em_progresso', '#f59e0b', 2),
                   ('Feito', 'feito', '#22c55e', 3)) AS e(nome, slug, cor, ordem)
WHERE b.tipo IN ('equipe', 'pessoal')
  AND NOT EXISTS (SELECT 1 FROM public.kanban_board_colunas c WHERE c.board_id = b.id);

-- Quadro de destino de cada item antigo
CREATE TEMP TABLE _destino ON COMMIT DROP AS
SELECT b.id AS board_id, b.tenant_id, b.criado_por,
       CASE WHEN b.tipo = 'equipe' THEN 'producao-legislativa' ELSE b.dono_id::text END AS kanban_type
FROM public.kanban_boards b
WHERE b.tipo IN ('equipe', 'pessoal');

-- 3d. Tarefas → cartões
INSERT INTO public.kanban_board_cards
  (tenant_id, board_id, coluna_id, titulo, descricao, responsavel_id, prioridade, cor, data_prazo,
   ordem, created_by, created_at, updated_at, origem, origem_id)
SELECT t.tenant_id, d.board_id, col.id,
  coalesce(nullif(trim(t.titulo), ''), 'Sem título'), t.descricao,
  CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = t.responsavel_id) THEN t.responsavel_id END,
  CASE WHEN t.prioridade IN ('baixa', 'media', 'alta', 'urgente') THEN t.prioridade ELSE 'media' END,
  coalesce(t.cor, '#3b82f6'), t.data_prazo,
  row_number() OVER (PARTITION BY d.board_id, col.id ORDER BY t.created_at),
  coalesce(CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = t.created_by) THEN t.created_by END, d.criado_por),
  t.created_at,
  CASE WHEN t.kanban_position = 'feito' THEN coalesce(t.completed_at, t.updated_at, t.created_at)
       ELSE coalesce(t.updated_at, t.created_at) END,
  'tarefa', t.id
FROM public.tarefas t
JOIN _destino d ON d.tenant_id = t.tenant_id AND d.kanban_type = t.kanban_type
JOIN public.kanban_board_colunas col ON col.board_id = d.board_id
  AND col.slug = CASE WHEN t.completed THEN 'feito' ELSE coalesce(t.kanban_position, 'a_fazer') END
ON CONFLICT (origem, origem_id) WHERE origem_id IS NOT NULL DO NOTHING;

-- 3e. Demandas no quadro → cartões vinculados à demanda
INSERT INTO public.kanban_board_cards
  (tenant_id, board_id, coluna_id, titulo, descricao, responsavel_id, prioridade, cor, data_prazo,
   ordem, created_by, created_at, updated_at, origem, origem_id)
SELECT dk.tenant_id, d.board_id, col.id,
  coalesce(nullif(trim(dm.titulo), ''), 'Demanda ' || dm.protocolo), NULL,
  dm.responsavel_id,
  CASE WHEN dm.prioridade IN ('baixa', 'media', 'alta', 'urgente') THEN dm.prioridade ELSE 'media' END,
  '#0f766e', NULL,
  1000 + row_number() OVER (PARTITION BY d.board_id, col.id ORDER BY dk.created_at),
  d.criado_por, dk.created_at, coalesce(dk.updated_at, dk.created_at),
  'demanda_kanban', dk.id
FROM public.demanda_kanbans dk
JOIN public.demandas dm ON dm.id = dk.demanda_id
JOIN _destino d ON d.tenant_id = dk.tenant_id AND d.kanban_type = dk.kanban_type
JOIN public.kanban_board_colunas col ON col.board_id = d.board_id AND col.slug = coalesce(dk.kanban_position, 'a_fazer')
ON CONFLICT (origem, origem_id) WHERE origem_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_board_card_demandas (tenant_id, card_id, demanda_id, created_by, created_at)
SELECT c.tenant_id, c.id, dk.demanda_id, NULL, dk.created_at
FROM public.kanban_board_cards c
JOIN public.demanda_kanbans dk ON c.origem = 'demanda_kanban' AND c.origem_id = dk.id
ON CONFLICT (card_id, demanda_id) DO NOTHING;

-- 3f. Colaboradores e comentários das tarefas
INSERT INTO public.kanban_board_card_colaboradores (tenant_id, card_id, usuario_id, created_at)
SELECT c.tenant_id, c.id, tc.colaborador_id, tc.created_at
FROM public.tarefa_colaboradores tc
JOIN public.kanban_board_cards c ON c.origem = 'tarefa' AND c.origem_id = tc.tarefa_id
JOIN public.profiles p ON p.id = tc.colaborador_id
ON CONFLICT (card_id, usuario_id) DO NOTHING;

INSERT INTO public.kanban_board_card_comentarios (tenant_id, card_id, autor_id, texto, created_at)
SELECT c.tenant_id, c.id, cm.autor_id, coalesce(cm.texto, ''), cm.created_at
FROM public.tarefa_comentarios cm
JOIN public.kanban_board_cards c ON c.origem = 'tarefa' AND c.origem_id = cm.tarefa_id
JOIN public.profiles p ON p.id = cm.autor_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_board_card_comentarios x
  WHERE x.card_id = c.id AND x.autor_id = cm.autor_id AND x.created_at = cm.created_at
);

-- 3g. Uma linha de histórico por cartão trazido
INSERT INTO public.kanban_board_card_historico (tenant_id, card_id, usuario_id, acao, detalhe, created_at)
SELECT c.tenant_id, c.id, CASE WHEN c.origem = 'tarefa' THEN c.created_by END, 'importou',
  jsonb_build_object('de', CASE WHEN c.origem = 'tarefa' THEN 'tarefa do Kanban antigo' ELSE 'demanda no Kanban antigo' END),
  c.created_at
FROM public.kanban_board_cards c
WHERE c.origem IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.kanban_board_card_historico h WHERE h.card_id = c.id AND h.acao = 'importou');

ALTER TABLE public.kanban_board_cards ENABLE TRIGGER trg_kanban_card_hist;
ALTER TABLE public.kanban_board_cards ENABLE TRIGGER update_kanban_board_cards_updated_at;
ALTER TABLE public.kanban_board_card_colaboradores ENABLE TRIGGER trg_kanban_colab_hist;
ALTER TABLE public.kanban_board_card_demandas ENABLE TRIGGER trg_kanban_dem_hist;
