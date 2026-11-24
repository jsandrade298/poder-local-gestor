import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Abre uma demanda no próprio lugar (por exemplo, dentro de um cartão do
 * quadro), com o mesmo modal da página Demandas: detalhes, atividades,
 * anexos, editar. Ao fechar, a pessoa continua onde estava.
 * Os modais são grandes, então só carregam no primeiro uso.
 */

const ViewDemandaDialog = lazy(() => import("@/components/forms/ViewDemandaDialog").then((m) => ({ default: m.ViewDemandaDialog })));
const EditDemandaDialog = lazy(() => import("@/components/forms/EditDemandaDialog").then((m) => ({ default: m.EditDemandaDialog })));

export function DemandaRapida({ demandaId, onClose }: { demandaId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  // O botão Editar fecha o modal de ver e chama a edição logo depois: o fechar
  // espera um instante para não confundir "fechar" com "ir editar".
  const indoEditar = useRef(false);

  const demanda = useQuery({
    queryKey: ["demanda-rapida", demandaId],
    enabled: !!demandaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("demandas").select("*, areas(nome), municipes(nome)").eq("id", demandaId!).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("A demanda não foi encontrada (pode estar na lixeira).");
      return data as any;
    },
    staleTime: 0,
    retry: false,
  });

  useEffect(() => { setEditando(false); }, [demandaId]);
  useEffect(() => {
    if (!demanda.isError) return;
    toast.error((demanda.error as Error)?.message || "Não foi possível abrir a demanda");
    onClose();
  }, [demanda.isError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mudou algo na demanda: o cartão (status no selo) e a lista de Demandas se atualizam
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["demanda-rapida", demandaId] });
    qc.invalidateQueries({ queryKey: ["quadro-extras"] });
    qc.invalidateQueries({ queryKey: ["cartao-demandas"] });
    qc.invalidateQueries({ queryKey: ["demandas"] });
  };

  if (!demandaId || !demanda.data) return null;

  return (
    <Suspense fallback={null}>
      <ViewDemandaDialog
        demanda={demanda.data}
        open={!editando}
        onOpenChange={(v) => {
          if (v) return;
          setTimeout(() => {
            if (indoEditar.current) return;
            atualizar();
            onClose();
          }, 200);
        }}
        onEdit={() => { indoEditar.current = true; setEditando(true); }}
      />
      {editando && (
        <EditDemandaDialog
          demanda={demanda.data}
          open={editando}
          // Terminou de editar: volta para a demanda (e dali, para o cartão)
          onOpenChange={(v) => { if (!v) { indoEditar.current = false; setEditando(false); atualizar(); } }}
        />
      )}
    </Suspense>
  );
}
