import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { garantirQuadroPessoal, urlDoCartao } from "@/hooks/useQuadros";

/**
 * O Kanban antigo virou os Quadros (24/11/2026). Links antigos continuam
 * funcionando — notificações, favoritos, mensagens:
 *   /kanban?tarefa=ID                       → o cartão que veio dessa tarefa
 *   /kanban?quadro=producao-legislativa     → quadro da equipe
 *   /kanban?quadro=<id da pessoa>           → quadro pessoal dessa pessoa
 *   /kanban                                 → galeria de Quadros
 */
export default function KanbanRedirect() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    const ir = (url: string) => { if (!cancelado) navigate(url, { replace: true }); };

    (async () => {
      const tarefa = params.get("tarefa");
      const quadro = params.get("quadro");

      if (tarefa) {
        const { data } = await (supabase.from("kanban_board_cards") as any)
          .select("id, board_id").eq("origem", "tarefa").eq("origem_id", tarefa).maybeSingle();
        return ir(data ? urlDoCartao(data.board_id, data.id) : "/quadros");
      }
      if (quadro === "producao-legislativa") {
        const { data } = await (supabase.from("kanban_boards") as any).select("id").eq("tipo", "equipe").maybeSingle();
        return ir(data ? `/quadros/${data.id}` : "/quadros");
      }
      if (quadro) {
        if (quadro === user.id) return ir(`/quadros/${await garantirQuadroPessoal(user.id, profile?.nome)}`);
        const { data } = await (supabase.from("kanban_boards") as any).select("id")
          .eq("tipo", "pessoal").eq("dono_id", quadro).maybeSingle();
        return ir(data ? `/quadros/${data.id}` : "/quadros");
      }
      ir("/quadros");
    })().catch(() => setFalhou(true));

    return () => { cancelado = true; };
  }, [user, params]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
      <p className="text-sm text-muted-foreground">
        {falhou ? "Não foi possível abrir este quadro. Vá em Quadros no menu." : "Abrindo nos Quadros…"}
      </p>
    </div>
  );
}
