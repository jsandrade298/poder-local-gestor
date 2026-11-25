import { useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { eventoNoDia, horaCurta, inicioDaSemana, somarDias, useEventosGoogle } from "@/hooks/useGoogleAgenda";
import { toast } from "sonner";

/**
 * Texto pronto da agenda do mandato da semana (para WhatsApp, redes, equipe).
 * Reservados e "Ocupado" nunca entram.
 */
export function CompartilharSemanaDialog({ aberto, onClose, referencia }: { aberto: boolean; onClose: () => void; referencia: Date }) {
  const de = useMemo(() => inicioDaSemana(referencia), [referencia]);
  const ate = useMemo(() => somarDias(de, 7), [de]);
  const q = useEventosGoogle(de, ate, aberto);
  const [comLocal, setComLocal] = useState(true);
  const [fimDeSemana, setFimDeSemana] = useState(true);

  const { texto, deFora } = useMemo(() => {
    const todos = (q.data?.eventos ?? []).filter((e) => e.origem === "mandato");
    const publicos = todos.filter((e) => !e.reservado && !e.oculto);
    const fim = somarDias(de, 6);
    const linhas = [`📅 Agenda da semana — ${de.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })} a ${fim.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}`, ""];
    for (let i = 0; i < 7; i++) {
      const d = somarDias(de, i);
      if (!fimDeSemana && i >= 5) continue;
      const doDia = publicos.filter((e) => eventoNoDia(e, d));
      if (doDia.length === 0) continue;
      const nome = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
      linhas.push(`*${nome.charAt(0).toUpperCase() + nome.slice(1)}*`);
      doDia.forEach((e) => linhas.push(`• ${e.diaInteiro ? "Dia todo" : horaCurta(e.inicio)} — ${e.titulo}${comLocal && e.local ? ` (${e.local})` : ""}`));
      linhas.push("");
    }
    if (linhas.length <= 2) linhas.push("Nenhum compromisso público nesta semana.");
    return { texto: linhas.join("\n").trim(), deFora: todos.length - publicos.length };
  }, [q.data, de, comLocal, fimDeSemana]);

  const [editado, setEditado] = useState("");
  useEffect(() => { setEditado(texto); }, [texto]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(editado); toast.success("Texto copiado"); } catch { toast.error("Não foi possível copiar; selecione o texto e copie"); }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compartilhar a semana</DialogTitle>
          <DialogDescription>Agenda do mandato pronta para mandar. Dá para ajustar o texto antes.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><Switch checked={comLocal} onCheckedChange={setComLocal} /> Mostrar local</label>
          <label className="flex items-center gap-2"><Switch checked={fimDeSemana} onCheckedChange={setFimDeSemana} /> Incluir fim de semana</label>
        </div>
        {q.isLoading && !q.data ? <Skeleton className="h-48" /> : (
          <Textarea rows={12} value={editado} onChange={(e) => setEditado(e.target.value)} className="font-mono text-xs" aria-label="Texto da agenda da semana" />
        )}
        {deFora > 0 && <p className="text-[11px] text-muted-foreground">{deFora} compromisso{deFora === 1 ? " reservado ficou" : "s reservados ficaram"} de fora.</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="gap-1.5" onClick={copiar}><Copy className="h-4 w-4" /> Copiar</Button>
          <Button asChild className="gap-1.5">
            <a href={`https://wa.me/?text=${encodeURIComponent(editado)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /> Abrir no WhatsApp</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
