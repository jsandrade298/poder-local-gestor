import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDemandaStatus, DemandaStatus } from "@/hooks/useDemandaStatus";
import { useDemandaNotification } from "@/contexts/DemandaNotificationContext";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logError } from "@/lib/errorUtils";

export interface MovimentoDemandaKanban {
  demanda: {
    id: string;
    titulo: string;
    protocolo: string;
    status: string;
    municipe_id?: string | null;
  };
  colunaDestino: string;
  colunaDestinoTitulo: string;
}

/**
 * Sugere um status do gabinete para a coluna de destino do Kanban.
 * Os status são configuráveis por gabinete, então a sugestão é por
 * aproximação (ordem, is_final e nome) — o usuário sempre pode trocar.
 */
export function sugerirStatusParaColuna(coluna: string, statusList: DemandaStatus[]): string | null {
  if (statusList.length === 0) return null;
  const ordenados = [...statusList].sort((a, b) => a.ordem - b.ordem);
  const naoFinais = ordenados.filter((s) => !s.is_final);
  const texto = (s: DemandaStatus) => `${s.slug} ${s.nome}`.toLowerCase();

  if (coluna === "feito") {
    return ordenados.find((s) => s.is_final)?.slug ?? null;
  }

  if (coluna === "em_progresso") {
    const porNome =
      naoFinais.find((s) => /andamento|progresso|produ|execu/.test(texto(s))) ??
      naoFinais.find((s) => /encaminh|analise|análise/.test(texto(s)));
    return (porNome ?? naoFinais[1] ?? naoFinais[0])?.slug ?? null;
  }

  // a_fazer (ou qualquer outra coluna): o status inicial
  return (naoFinais.find((s) => s.slug === "solicitada") ?? naoFinais[0])?.slug ?? null;
}

interface Props {
  movimento: MovimentoDemandaKanban | null;
  onClose: () => void;
}

export function ConfirmarStatusDemandaDialog({ movimento, onClose }: Props) {
  const queryClient = useQueryClient();
  const { statusList, getStatusLabel, shouldNotify } = useDemandaStatus();
  const { addNotification } = useDemandaNotification();
  const [novoStatus, setNovoStatus] = useState<string>("");

  useEffect(() => {
    if (movimento) {
      setNovoStatus(
        sugerirStatusParaColuna(movimento.colunaDestino, statusList) ?? movimento.demanda.status
      );
    }
  }, [movimento, statusList]);

  const atualizarStatus = useMutation({
    mutationFn: async ({ demandaId, statusAnterior, status }: { demandaId: string; statusAnterior: string; status: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const { data: demanda, error: fetchError } = await supabase
        .from("demandas")
        .select("id, titulo, protocolo, municipe_id, municipes(nome, telefone, bairro)")
        .eq("id", demandaId)
        .single();
      if (fetchError) throw fetchError;

      const { error } = await supabase.from("demandas").update({ status }).eq("id", demandaId);
      if (error) throw error;

      const municipe = (demanda as any)?.municipes;

      // Mesmo efeito colateral da edição de demanda: registro no prontuário do munícipe
      if (demanda?.municipe_id) {
        const { error: prontuarioError } = await supabase.from("municipe_atividades").insert({
          municipe_id: demanda.municipe_id,
          created_by: userId,
          tipo_atividade: "anotacao",
          titulo: `Demanda #${demanda.protocolo} - Status alterado`,
          descricao: `A demanda "${demanda.titulo}" teve seu status alterado de "${getStatusLabel(statusAnterior)}" para "${getStatusLabel(status)}" (pelo Kanban).`,
          data_atividade: new Date().toISOString(),
        });
        if (prontuarioError) logError("Erro ao registrar no prontuário:", prontuarioError);
      }

      // Mesmo efeito colateral da edição: aviso por WhatsApp se o status estiver configurado para isso
      let whatsappEnviado = false;
      if (municipe?.telefone && shouldNotify(status)) {
        const { data: whatsConfigs } = await supabase
          .from("configuracoes")
          .select("chave, valor")
          .in("chave", ["whatsapp_instancia_demandas", "whatsapp_mensagem_demandas", "whatsapp_demandas_ativo"]);
        const cfg = (whatsConfigs || []).reduce((acc: Record<string, string>, item: any) => {
          acc[item.chave] = item.valor;
          return acc;
        }, {});
        if (cfg.whatsapp_demandas_ativo === "true" && cfg.whatsapp_instancia_demandas && cfg.whatsapp_mensagem_demandas) {
          addNotification({
            demanda_id: demandaId,
            demanda_titulo: demanda.titulo,
            demanda_protocolo: demanda.protocolo || "",
            municipe_nome: municipe.nome,
            municipe_bairro: municipe.bairro || "",
            telefone: municipe.telefone,
            novo_status: getStatusLabel(status),
            instanceName: cfg.whatsapp_instancia_demandas,
          });
          whatsappEnviado = true;
        }
      }

      return { whatsappEnviado, municipeNome: municipe?.nome, municipeId: demanda?.municipe_id };
    },
    onSuccess: (result, vars) => {
      toast.success(
        result.whatsappEnviado
          ? `Status alterado para "${getStatusLabel(vars.status)}" e WhatsApp enviado para ${result.municipeNome}`
          : `Status alterado para "${getStatusLabel(vars.status)}"`
      );
      queryClient.invalidateQueries({ queryKey: ["demandas"] });
      queryClient.invalidateQueries({ queryKey: ["demandas-kanban"] });
      if (result.municipeId) {
        queryClient.invalidateQueries({ queryKey: ["municipe-atividades", result.municipeId] });
      }
      onClose();
    },
    onError: (error: any) => {
      logError("Erro ao atualizar status pelo Kanban:", error);
      toast.error("Erro ao atualizar o status da demanda");
    },
  });

  if (!movimento) return null;

  const { demanda, colunaDestinoTitulo } = movimento;
  const mudou = novoStatus && novoStatus !== demanda.status;
  const vaiNotificar = mudou && shouldNotify(novoStatus);

  return (
    <Dialog open={!!movimento} onOpenChange={(open) => !open && !atualizarStatus.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar o status da demanda?</DialogTitle>
          <DialogDescription>
            O cartão <strong>{demanda.protocolo}</strong> — {demanda.titulo} foi movido para{" "}
            <strong>{colunaDestinoTitulo}</strong>. O status atual é{" "}
            <strong>{getStatusLabel(demanda.status)}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Novo status</Label>
          <StatusSelect value={novoStatus} onValueChange={setNovoStatus} />
          {vaiNotificar && (
            <p className="text-xs text-muted-foreground">
              Este status está configurado para avisar o munícipe pelo WhatsApp.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={atualizarStatus.isPending}>
            Manter status atual
          </Button>
          <Button
            onClick={() =>
              atualizarStatus.mutate({ demandaId: demanda.id, statusAnterior: demanda.status, status: novoStatus })
            }
            disabled={!mudou || atualizarStatus.isPending}
          >
            {atualizarStatus.isPending ? "Salvando..." : "Atualizar status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
