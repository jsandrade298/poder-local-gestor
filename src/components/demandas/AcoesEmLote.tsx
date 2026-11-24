import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Columns3, FolderInput, Trash2, UserRound, X } from "lucide-react";
import { EnviarParaQuadroDialog } from "./EnviarParaQuadroDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Ações em lote nas Demandas: mudar status, responsável ou área de várias
 * demandas de uma vez, enviar para um quadro (um cartão por demanda) e
 * mandar para a lixeira.
 * Cada mudança fica registrada nas atividades da demanda, para o histórico
 * dizer o que aconteceu e quem fez.
 */

export interface DemandaSelecionada { id: string; protocolo?: string | null; titulo?: string | null; status?: string | null }
type Acao = "status" | "responsavel" | "area";

const LOTE = 200;
const SEM_RESPONSAVEL = "__nenhum__";
const SEM_AREA = "__nenhuma__";

export function AcoesEmLote({
  selecionadas, statusList, pessoas, areas, onLimpar, onLixeira,
}: {
  selecionadas: DemandaSelecionada[];
  statusList: { slug: string; nome: string; cor?: string | null }[];
  pessoas: { id: string; nome: string }[];
  areas: { id: string; nome: string }[];
  onLimpar: () => void;
  /** Mandar as selecionadas para a lixeira (quem chama confirma e executa). */
  onLixeira?: () => void;
}) {
  const qc = useQueryClient();
  const [acao, setAcao] = useState<Acao | null>(null);
  const [valor, setValor] = useState("");
  const [registrar, setRegistrar] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [paraQuadro, setParaQuadro] = useState(false);
  const n = selecionadas.length;
  if (n === 0) return null;

  const abrir = (a: Acao) => { setAcao(a); setValor(""); setRegistrar(true); };

  const rotuloDoValor = () => {
    if (acao === "status") return statusList.find((s) => s.slug === valor)?.nome ?? valor;
    if (acao === "responsavel") return valor === SEM_RESPONSAVEL ? "sem responsável" : pessoas.find((p) => p.id === valor)?.nome ?? "";
    if (acao === "area") return valor === SEM_AREA ? "sem área" : areas.find((a) => a.id === valor)?.nome ?? "";
    return "";
  };

  const aplicar = async () => {
    if (!acao || !valor) return;
    setRodando(true);
    const campos: Record<string, unknown> =
      acao === "status" ? { status: valor }
        : acao === "responsavel" ? { responsavel_id: valor === SEM_RESPONSAVEL ? null : valor }
          : { area_id: valor === SEM_AREA ? null : valor };
    const rotulo = rotuloDoValor();
    const titulo = acao === "status" ? `Status alterado em lote para "${rotulo}"`
      : acao === "responsavel" ? `Responsável alterado em lote: ${rotulo}`
        : `Área alterada em lote: ${rotulo}`;

    try {
      const { data: u } = await supabase.auth.getUser();
      const ids = selecionadas.map((d) => d.id);
      const feitos: string[] = [];
      for (let i = 0; i < ids.length; i += LOTE) {
        const parte = ids.slice(i, i + LOTE);
        const { data, error } = await (supabase.from("demandas") as any).update(campos).in("id", parte).select("id");
        if (error) throw error;
        feitos.push(...(data ?? []).map((d: any) => d.id));
      }
      if (registrar && u.user && feitos.length > 0) {
        for (let i = 0; i < feitos.length; i += LOTE) {
          const linhas = feitos.slice(i, i + LOTE).map((demanda_id) => ({
            demanda_id, created_by: u.user!.id, tipo_atividade: "comentario", titulo,
            descricao: `Alteração feita em lote, junto com outras ${feitos.length - 1} demanda${feitos.length - 1 === 1 ? "" : "s"}.`,
          }));
          const { error } = await (supabase.from("demanda_atividades") as any).insert(linhas);
          if (error) console.warn("Atividades do lote não registradas:", error.message);
        }
      }
      const faltou = ids.length - feitos.length;
      toast.success(`${feitos.length.toLocaleString("pt-BR")} demanda${feitos.length === 1 ? "" : "s"} atualizada${feitos.length === 1 ? "" : "s"}`, {
        description: faltou > 0 ? `${faltou} não puderam ser alteradas (sem permissão).` : undefined,
      });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["inicio"] });
      setAcao(null);
      onLimpar();
    } catch (e: any) {
      toast.error("Não foi possível concluir: " + (e?.message || "erro"));
    } finally {
      setRodando(false);
    }
  };

  const TITULO: Record<Acao, string> = { status: "Mudar o status", responsavel: "Mudar o responsável", area: "Mudar a área" };

  return (
    <>
      {/* Barra fixa: acima da barra inferior no celular */}
      <div className="fixed inset-x-0 bottom-[4.5rem] md:bottom-4 z-40 flex justify-center px-3 pointer-events-none">
        <div role="toolbar" aria-label="Ações nas demandas selecionadas"
          className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card/95 backdrop-blur-md shadow-forte px-3 py-2 max-w-full">
          <span className="text-sm font-semibold tabular-nums pr-1">{n.toLocaleString("pt-BR")} selecionada{n === 1 ? "" : "s"}</span>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => abrir("status")}><ArrowRightLeft className="h-3.5 w-3.5" /> Status</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => abrir("responsavel")}><UserRound className="h-3.5 w-3.5" /> Responsável</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => abrir("area")}><FolderInput className="h-3.5 w-3.5" /> Área</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setParaQuadro(true)}><Columns3 className="h-3.5 w-3.5" /> Quadro</Button>
          {onLixeira && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-destructive hover:text-destructive" onClick={onLixeira}>
              <Trash2 className="h-3.5 w-3.5" /> Lixeira
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onLimpar} aria-label="Limpar seleção"><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {paraQuadro && (
        <EnviarParaQuadroDialog aberto={paraQuadro} onAbertoChange={setParaQuadro} selecionadas={selecionadas} onConcluido={onLimpar} />
      )}

      <Dialog open={!!acao} onOpenChange={(v) => !rodando && !v && setAcao(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{acao ? TITULO[acao] : ""} de {n.toLocaleString("pt-BR")} demanda{n === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Vale para todas as selecionadas{n <= 3 ? `: ${selecionadas.map((d) => "#" + (d.protocolo ?? "")).join(", ")}` : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>{acao === "status" ? "Novo status" : acao === "responsavel" ? "Novo responsável" : "Nova área"}</Label>
            <Select value={valor} onValueChange={setValor}>
              <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>
                {acao === "status" && statusList.map((s) => (
                  <SelectItem key={s.slug} value={s.slug}>
                    <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: s.cor || "currentColor" }} />{s.nome}</span>
                  </SelectItem>
                ))}
                {acao === "responsavel" && (
                  <>
                    <SelectItem value={SEM_RESPONSAVEL}>Sem responsável</SelectItem>
                    {pessoas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </>
                )}
                {acao === "area" && (
                  <>
                    <SelectItem value={SEM_AREA}>Sem área</SelectItem>
                    {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  </>
                )}
              </SelectContent>
            </Select>
            <label className="flex items-start gap-2 pt-2 text-sm cursor-pointer">
              <Checkbox checked={registrar} onCheckedChange={(v) => setRegistrar(!!v)} className="mt-0.5" />
              <span>Registrar nas atividades de cada demanda <span className="text-muted-foreground">(recomendado: o histórico mostra o que mudou e quem mudou)</span></span>
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAcao(null)} disabled={rodando}>Cancelar</Button>
            <Button onClick={aplicar} disabled={!valor || rodando} className={cn(rodando && "opacity-80")}>
              {rodando ? "Aplicando…" : `Aplicar em ${n.toLocaleString("pt-BR")}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
