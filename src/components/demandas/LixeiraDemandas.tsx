import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Paperclip, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Lixeira de demandas: o que foi excluído fica aqui por 30 dias, com tudo
 * (atividades, anexos, vínculos com cartões). Dá para restaurar ou excluir de
 * vez. Passados 30 dias, sai sozinho na próxima vez que alguém abrir a lista.
 */

export const DIAS_LIXEIRA = 30;

interface ItemLixeira {
  id: string; protocolo: string; titulo: string; status: string; municipe_nome: string | null;
  excluida_em: string; excluida_por_nome: string | null; anexos: number; atividades: number;
}

const rpc = (nome: string, args?: Record<string, unknown>) => (supabase.rpc as any)(nome, args);

/** Apaga do Storage os arquivos dos anexos que saíram do banco. */
async function apagarArquivos(caminhos: string[] | null | undefined) {
  const lista = (caminhos ?? []).filter(Boolean);
  for (let i = 0; i < lista.length; i += 100) {
    await supabase.storage.from("demanda-anexos").remove(lista.slice(i, i + 100));
  }
}

/** Manda demandas para a lixeira (com "Desfazer" no aviso). */
export async function moverParaLixeira(ids: string[], aoMudar: () => void) {
  const { data, error } = await rpc("lixeira_mover_demandas", { p_ids: ids });
  if (error) throw error;
  const n = Number(data ?? 0);
  aoMudar();
  toast.success(n === 1 ? "Demanda na lixeira" : `${n.toLocaleString("pt-BR")} demandas na lixeira`, {
    description: `Dá para restaurar por ${DIAS_LIXEIRA} dias, em Demandas → Lixeira.`,
    action: {
      label: "Desfazer",
      onClick: async () => {
        const { error: e } = await rpc("lixeira_restaurar_demandas", { p_ids: ids });
        if (e) toast.error("Não foi possível desfazer: " + e.message);
        aoMudar();
      },
    },
  });
  return n;
}

/** Quantas estão na lixeira (para o botão). */
export function useContagemLixeira() {
  return useQuery({
    queryKey: ["lixeira-demandas"],
    queryFn: async () => {
      const { data, error } = await rpc("lixeira_listar_demandas");
      if (error) throw error;
      return (data ?? []) as ItemLixeira[];
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function LixeiraDemandas({ aberto, onAbertoChange }: { aberto: boolean; onAbertoChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const lista = useContagemLixeira();
  const [excluindo, setExcluindo] = useState<ItemLixeira | "todas" | null>(null);

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["lixeira-demandas"] });
    qc.invalidateQueries({ queryKey: ["demandas"] });
  };

  // Ao abrir: tira de vez o que passou de 30 dias (e os arquivos)
  useEffect(() => {
    if (!aberto) return;
    (async () => {
      const { data, error } = await rpc("lixeira_excluir_definitivo", { p_ids: null });
      if (!error && Array.isArray(data)) { await apagarArquivos(data); }
      lista.refetch();
    })();
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const restaurar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await rpc("lixeira_restaurar_demandas", { p_ids: ids });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (n) => { toast.success(n === 1 ? "Demanda restaurada" : `${n} demandas restauradas`); atualizar(); },
    onError: (e: any) => toast.error("Não foi possível restaurar: " + e.message),
  });

  const excluirDeVez = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await rpc("lixeira_excluir_definitivo", { p_ids: ids });
      if (error) throw error;
      await apagarArquivos(data);
      return ids.length;
    },
    onSuccess: (n) => { toast.success(n === 1 ? "Demanda excluída de vez" : `${n} demandas excluídas de vez`); atualizar(); },
    onError: (e: any) => toast.error("Não foi possível excluir: " + e.message),
  });

  const itens = lista.data ?? [];
  const diasRestantes = (iso: string) => Math.max(0, DIAS_LIXEIRA - Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  const alvo = excluindo === "todas" ? itens : excluindo ? [excluindo] : [];

  return (
    <>
      <Sheet open={aberto} onOpenChange={onAbertoChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b text-left">
            <SheetTitle>Lixeira de demandas</SheetTitle>
            <SheetDescription>
              Demandas excluídas ficam aqui por {DIAS_LIXEIRA} dias, com atividades e anexos. Restaure se foi engano.
            </SheetDescription>
            {itens.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" className="h-8 gap-1" disabled={restaurar.isPending}
                  onClick={() => restaurar.mutate(itens.map((i) => i.id))}>
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar todas ({itens.length})
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:text-destructive" onClick={() => setExcluindo("todas")}>
                  <Trash2 className="h-3.5 w-3.5" /> Esvaziar a lixeira
                </Button>
              </div>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto divide-y">
            {lista.isLoading ? (
              <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : lista.isError ? (
              <p className="p-5 text-sm text-muted-foreground">Não foi possível abrir a lixeira agora.</p>
            ) : itens.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">A lixeira está vazia.</p>
            ) : itens.map((d) => (
              <div key={d.id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug break-words">{d.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    #{d.protocolo}{d.municipe_nome ? ` · ${d.municipe_nome}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2">
                    <span>Excluída {d.excluida_por_nome ? `por ${d.excluida_por_nome.split(" ")[0]} ` : ""}em {new Date(d.excluida_em).toLocaleDateString("pt-BR")}</span>
                    <span>· sai em {diasRestantes(d.excluida_em)} dia{diasRestantes(d.excluida_em) === 1 ? "" : "s"}</span>
                    {d.atividades > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{d.atividades}</span>}
                    {d.anexos > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{d.anexos}</span>}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" disabled={restaurar.isPending} onClick={() => restaurar.mutate([d.id])}>
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" aria-label={`Excluir de vez a demanda ${d.protocolo}`} onClick={() => setExcluindo(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {excluindo === "todas" ? `Esvaziar a lixeira (${itens.length} demandas)?` : `Excluir de vez a demanda #${(excluindo as ItemLixeira | null)?.protocolo ?? ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vão junto as atividades, os anexos e os vínculos com cartões. Isso não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { excluirDeVez.mutate(alvo.map((i) => i.id)); setExcluindo(null); }}>
              Excluir de vez
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
