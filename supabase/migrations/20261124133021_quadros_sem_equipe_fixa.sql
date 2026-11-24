-- ============================================================
-- Quadros sem "quadro fixo da equipe" — 24/11/2026
--
-- Decisão do gabinete: não há quadro fixo. A Produção Legislativa vira
-- um projeto comum: só os MEMBROS editam, mudam ou excluem o quadro.
-- Membros iniciais = quem já trabalha nele (criador, responsáveis,
-- criadores e colaboradores de cartões, autores de comentários).
--
-- Quadro pessoal: só o DONO edita ou exclui — mesmo que alguém seja
-- incluído como membro por fora da tela. Quem é responsável ou
-- colaborador de um cartão continua editando aquele cartão.
--
-- Nenhum cartão é alterado.
-- ============================================================

-- 1. Membros da Produção Legislativa (quem já trabalha nela)
INSERT INTO public.kanban_board_membros (tenant_id, board_id, usuario_id)
SELECT DISTINCT b.tenant_id, b.id, x.u
FROM public.kanban_boards b
CROSS JOIN LATERAL (
  SELECT b.criado_por AS u
  UNION SELECT c.responsavel_id FROM public.kanban_board_cards c WHERE c.board_id = b.id
  UNION SELECT c.created_by FROM public.kanban_board_cards c WHERE c.board_id = b.id AND c.origem = 'tarefa'
  UNION SELECT k.usuario_id FROM public.kanban_board_card_colaboradores k
        JOIN public.kanban_board_cards c ON c.id = k.card_id WHERE c.board_id = b.id
  UNION SELECT cm.autor_id FROM public.kanban_board_card_comentarios cm
        JOIN public.kanban_board_cards c ON c.id = cm.card_id WHERE c.board_id = b.id
) x
JOIN public.profiles p ON p.id = x.u AND p.tenant_id = b.tenant_id
WHERE b.tipo = 'equipe' AND x.u IS NOT NULL
ON CONFLICT (board_id, usuario_id) DO NOTHING;

-- 2. Deixa de ser "da equipe" (o tipo só muda aqui, pelo banco)
UPDATE public.kanban_boards
SET tipo = 'projeto',
    descricao = 'Demandas e tarefas da produção legislativa.'
WHERE tipo = 'equipe';

-- 3. Quem é membro: pessoal = só o dono; projeto = lista de membros
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
      AND CASE
            WHEN b.tipo = 'pessoal' THEN b.dono_id = auth.uid()
            WHEN b.tipo = 'equipe'  THEN true
            ELSE EXISTS (SELECT 1 FROM public.kanban_board_membros m
                         WHERE m.board_id = b.id AND m.usuario_id = auth.uid())
          END
  );
$$;
