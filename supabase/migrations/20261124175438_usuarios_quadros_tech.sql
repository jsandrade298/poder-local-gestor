-- ============================================================
-- 24/11/2026 — Quadro pessoal automático, perfil "Tech" e saída de
-- usuários sem perder dados.
--
-- 1) Toda pessoa do gabinete tem um quadro pessoal (criado sozinho).
-- 2) O perfil visual "jovem" passa a se chamar "tech".
-- 3) Usuário pode ser DESATIVADO (profiles.ativo) ou ter tudo o que é
--    dele TRANSFERIDO para outra pessoa antes de ser excluído. Antes, a
--    exclusão apagava atividades, prontuário, anexos e agendas.
-- ============================================================

-- ── 1. Quadro pessoal para todos ────────────────────────────────
CREATE OR REPLACE FUNCTION public.garantir_quadro_pessoal(p_usuario uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_board uuid;
  v_tenant uuid;
  v_nome text;
BEGIN
  SELECT id INTO v_board FROM public.kanban_boards WHERE tipo = 'pessoal' AND dono_id = p_usuario;
  IF v_board IS NOT NULL THEN RETURN v_board; END IF;

  SELECT tenant_id, nome INTO v_tenant, v_nome FROM public.profiles WHERE id = p_usuario;
  IF v_tenant IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.kanban_boards (tenant_id, nome, descricao, cor, icone, tipo, dono_id, criado_por)
  VALUES (v_tenant, 'Quadro de ' || coalesce(nullif(v_nome, ''), 'sem nome'),
          'Quadro pessoal: o gabinete vê, só o dono edita.', '#475569', '🗂️', 'pessoal', p_usuario, p_usuario)
  RETURNING id INTO v_board;

  INSERT INTO public.kanban_board_colunas (tenant_id, board_id, nome, slug, cor, ordem)
  VALUES (v_tenant, v_board, 'A Fazer', 'a_fazer', '#3b82f6', 1),
         (v_tenant, v_board, 'Em Progresso', 'em_progresso', '#f59e0b', 2),
         (v_tenant, v_board, 'Feito', 'feito', '#22c55e', 3);
  RETURN v_board;
END; $$;
REVOKE ALL ON FUNCTION public.garantir_quadro_pessoal(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.profiles_criar_quadro_pessoal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    PERFORM public.garantir_quadro_pessoal(NEW.id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.profiles_criar_quadro_pessoal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_criar_quadro_pessoal ON public.profiles;
CREATE TRIGGER trg_profiles_criar_quadro_pessoal
  AFTER INSERT OR UPDATE OF tenant_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_criar_quadro_pessoal();

SELECT public.garantir_quadro_pessoal(p.id)
FROM public.profiles p
WHERE p.tenant_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.kanban_boards b WHERE b.tipo = 'pessoal' AND b.dono_id = p.id);

-- ── 2. "Jovem" passa a ser "Tech" ───────────────────────────────
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_perfil_visual_check;
UPDATE public.tenants SET perfil_visual = 'tech' WHERE perfil_visual = 'jovem';
ALTER TABLE public.tenants ADD CONSTRAINT tenants_perfil_visual_check CHECK (perfil_visual IN ('brasil', 'tech'));

CREATE OR REPLACE FUNCTION public.admin_set_tenant_perfil(p_tenant_id uuid, p_perfil text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Acesso negado: apenas superadmins'; END IF;
  IF p_perfil NOT IN ('brasil', 'tech') THEN RAISE EXCEPTION 'Perfil visual inválido: %', p_perfil; END IF;
  UPDATE public.tenants SET perfil_visual = p_perfil, updated_at = now() WHERE id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant não encontrado'; END IF;
  RETURN json_build_object('tenant_id', p_tenant_id, 'perfil_visual', p_perfil);
END; $$;

-- ── 3. Usuário ativo / inativo ──────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Resumo do que está ligado a uma pessoa (para o modal de saída)
CREATE OR REPLACE FUNCTION public.usuario_vinculos(p_usuario uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = p_usuario;
  IF NOT (public.is_superadmin() OR (v_tenant = public.get_my_tenant_id() AND public.is_tenant_admin())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN json_build_object(
    'demandas_responsavel', (SELECT count(*) FROM demandas WHERE responsavel_id = p_usuario),
    'demandas_cadastradas', (SELECT count(*) FROM demandas WHERE criado_por = p_usuario),
    'atividades', (SELECT count(*) FROM demanda_atividades WHERE created_by = p_usuario),
    'prontuario', (SELECT count(*) FROM municipe_atividades WHERE created_by = p_usuario),
    'anexos', (SELECT count(*) FROM anexos WHERE uploaded_by = p_usuario),
    'agendas', (SELECT count(*) FROM agendas WHERE solicitante_id = p_usuario OR validador_id = p_usuario),
    'cartoes', (SELECT count(*) FROM kanban_board_cards WHERE responsavel_id = p_usuario OR created_by = p_usuario),
    'quadro_pessoal', (SELECT count(*) FROM kanban_board_cards c JOIN kanban_boards b ON b.id = c.board_id
                       WHERE b.tipo = 'pessoal' AND b.dono_id = p_usuario AND c.arquivado_em IS NULL),
    'areas', (SELECT count(*) FROM areas WHERE responsavel_id = p_usuario)
  );
END; $$;
REVOKE ALL ON FUNCTION public.usuario_vinculos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_vinculos(uuid) TO authenticated;

-- Transfere TUDO de uma pessoa para outra (mesmo gabinete). Só a
-- função de servidor delete-user chama (ela confere quem pediu).
CREATE OR REPLACE FUNCTION public.transferir_vinculos_usuario(p_de uuid, p_para uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n int; r jsonb := '{}'::jsonb;
  v_t1 uuid; v_t2 uuid;
  v_quadro uuid; v_nome text;
BEGIN
  SELECT tenant_id, nome INTO v_t1, v_nome FROM profiles WHERE id = p_de;
  SELECT tenant_id INTO v_t2 FROM profiles WHERE id = p_para;
  IF p_de = p_para OR v_t1 IS NULL OR v_t1 IS DISTINCT FROM v_t2 THEN
    RAISE EXCEPTION 'Transferência inválida: as duas pessoas precisam ser do mesmo gabinete';
  END IF;

  -- Demandas
  UPDATE demandas SET responsavel_id = p_para WHERE responsavel_id = p_de; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('demandas_responsavel', n);
  UPDATE demandas SET criado_por = p_para WHERE criado_por = p_de;         GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('demandas_cadastradas', n);
  UPDATE demandas SET representante_id = p_para WHERE representante_id = p_de;
  UPDATE demanda_atividades SET created_by = p_para WHERE created_by = p_de; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('atividades', n);
  UPDATE anexos SET uploaded_by = p_para WHERE uploaded_by = p_de;         GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('anexos', n);
  -- Munícipes
  UPDATE municipe_atividades SET created_by = p_para WHERE created_by = p_de; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('prontuario', n);
  UPDATE municipes SET representante_id = p_para WHERE representante_id = p_de;
  -- Agenda
  UPDATE agendas SET solicitante_id = p_para WHERE solicitante_id = p_de;  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('agendas_solicitadas', n);
  UPDATE agendas SET validador_id = p_para WHERE validador_id = p_de;      GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('agendas_validadas', n);
  INSERT INTO agenda_acompanhantes (agenda_id, usuario_id, tenant_id)
    SELECT agenda_id, p_para, tenant_id FROM agenda_acompanhantes WHERE usuario_id = p_de
    ON CONFLICT (agenda_id, usuario_id) DO NOTHING;
  DELETE FROM agenda_acompanhantes WHERE usuario_id = p_de;
  UPDATE agenda_mensagens SET remetente_id = p_para WHERE remetente_id = p_de;
  -- Quadros
  UPDATE kanban_board_cards SET responsavel_id = p_para WHERE responsavel_id = p_de; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('cartoes', n);
  UPDATE kanban_board_cards SET created_by = p_para WHERE created_by = p_de;
  UPDATE kanban_board_card_comentarios SET autor_id = p_para WHERE autor_id = p_de;
  UPDATE kanban_boards SET criado_por = p_para WHERE criado_por = p_de AND tipo <> 'pessoal';
  INSERT INTO kanban_board_membros (tenant_id, board_id, usuario_id)
    SELECT tenant_id, board_id, p_para FROM kanban_board_membros WHERE usuario_id = p_de
    ON CONFLICT (board_id, usuario_id) DO NOTHING;
  INSERT INTO kanban_board_card_colaboradores (tenant_id, card_id, usuario_id)
    SELECT tenant_id, card_id, p_para FROM kanban_board_card_colaboradores WHERE usuario_id = p_de
    ON CONFLICT (card_id, usuario_id) DO NOTHING;
  -- O quadro pessoal de quem sai vira um projeto arquivado de quem recebe (nada se perde)
  SELECT id INTO v_quadro FROM kanban_boards WHERE tipo = 'pessoal' AND dono_id = p_de;
  IF v_quadro IS NOT NULL THEN
    UPDATE kanban_boards SET tipo = 'projeto', dono_id = NULL, criado_por = p_para,
      nome = 'Quadro de ' || coalesce(v_nome, 'ex-membro') || ' (ex-membro)', arquivado_em = now()
    WHERE id = v_quadro;
    INSERT INTO kanban_board_membros (tenant_id, board_id, usuario_id) VALUES (v_t1, v_quadro, p_para)
      ON CONFLICT (board_id, usuario_id) DO NOTHING;
  END IF;
  -- Kanban antigo (congelado) e outras áreas
  UPDATE tarefas SET responsavel_id = p_para WHERE responsavel_id = p_de;
  UPDATE tarefa_comentarios SET autor_id = p_para WHERE autor_id = p_de;
  UPDATE areas SET responsavel_id = p_para WHERE responsavel_id = p_de;    GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('areas', n);
  UPDATE planos_acao SET responsavel_id = p_para WHERE responsavel_id = p_de;
  UPDATE planos_acao SET created_by = p_para WHERE created_by = p_de;
  UPDATE projetos_plano SET responsavel_id = p_para WHERE responsavel_id = p_de;
  UPDATE projetos_plano SET created_by = p_para WHERE created_by = p_de;
  UPDATE projeto_atualizacoes SET autor_id = p_para WHERE autor_id = p_de;
  UPDATE planilha_linha_atualizacoes SET autor_id = p_para WHERE autor_id = p_de;
  UPDATE camadas_geograficas SET created_by = p_para WHERE created_by = p_de;
  UPDATE dados_eleitorais SET created_by = p_para WHERE created_by = p_de;
  UPDATE kanban_historico SET movido_por = p_para WHERE movido_por = p_de;
  UPDATE ia_feedbacks SET user_id = p_para WHERE user_id = p_de;
  RETURN r;
END; $$;
REVOKE ALL ON FUNCTION public.transferir_vinculos_usuario(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transferir_vinculos_usuario(uuid, uuid) TO service_role;
