import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  diaISO, inicioDoDia, somarDias, useAcoesPedidos, useEventosGoogle, useStatusGoogle,
} from "@/hooks/useGoogleAgenda";
import { EXPEDIENTE_PADRAO, conflitosCom, faixaHorario, horariosLivres } from "./agendaUtil";

/**
 * Pedir um horário na agenda do mandato. Só o necessário para virar evento
 * no Google: título, até 3 opções de data/horário, local e descrição.
 * Cada opção mostra na hora se bate com algo já marcado (pode pedir assim
 * mesmo: o parlamentar às vezes passa rapidamente em dois compromissos).
 * Editores da agenda podem marcar direto (aprova a 1ª opção).
 */

interface Opcao { data: string; hIni: string; hFim: string }
const vazia = (data = ""): Opcao => ({ data, hIni: "09:00", hFim: "10:00" });
const paraISO = (o: Opcao) => ({ inicio: new Date(`${o.data}T${o.hIni}:00`), fim: new Date(`${o.data}T${o.hFim}:00`) });
const hhmm = (d: Date) => d.toTimeString().slice(0, 5);

export function PedirHorarioDialog({
  aberto, onClose, inicial,
}: {
  aberto: boolean;
  onClose: () => void;
  inicial?: { titulo?: string; local?: string; descricao?: string; demandaId?: string | null; municipeId?: string | null; inicio?: Date; fim?: Date };
}) {
  const status = useStatusGoogle(aberto);
  const editor = !!status.data?.souEditorMandato;
  const { criar, decidir } = useAcoesPedidos();
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [opcoes, setOpcoes] = useState<Opcao[]>([vazia()]);
  const [marcarDireto, setMarcarDireto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTitulo(inicial?.titulo ?? ""); setLocal(inicial?.local ?? ""); setDescricao(inicial?.descricao ?? "");
    setOpcoes([inicial?.inicio && inicial?.fim
      ? { data: diaISO(inicial.inicio), hIni: hhmm(inicial.inicio), hFim: hhmm(inicial.fim) }
      : vazia(diaISO(somarDias(new Date(), 1)))]);
    setMarcarDireto(false);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Agenda do mandato nos próximos 60 dias: conflitos e sugestão de horários livres
  const hoje0 = useMemo(() => inicioDoDia(new Date()), []);
  const agenda = useEventosGoogle(hoje0, somarDias(hoje0, 60), aberto);
  const doMandato = useMemo(() => (agenda.data?.eventos ?? []).filter((e) => e.origem === "mandato"), [agenda.data]);

  const analise = opcoes.map((o) => {
    if (!o.data) return { valida: false, conflitos: [] as typeof doMandato };
    const { inicio, fim } = paraISO(o);
    if (!(fim > inicio)) return { valida: false, erro: "o fim precisa ser depois do início", conflitos: [] as typeof doMandato };
    return { valida: true, conflitos: conflitosCom(inicio, fim, doMandato) };
  });
  const validas = opcoes.filter((_, i) => analise[i].valida);

  const sugerir = () => {
    const base = opcoes.find((o) => o.data) ?? vazia();
    const dur = Math.max(15, Math.round((paraISO({ ...base, data: "2000-01-01" }).fim.getTime() - paraISO({ ...base, data: "2000-01-01" }).inicio.getTime()) / 60000)) || 60;
    const achadas: Opcao[] = [];
    for (let i = 0; i < 21 && achadas.length < 3; i++) {
      const dia = somarDias(hoje0, i);
      const r = horariosLivres(dia, doMandato.filter((e) => diaISO(new Date(e.inicio)) === diaISO(dia)), EXPEDIENTE_PADRAO, dur);
      for (const l of r.livres) {
        if (achadas.length >= 3) break;
        const fim = new Date(l.de.getTime() + dur * 60000);
        achadas.push({ data: diaISO(l.de), hIni: hhmm(l.de), hFim: hhmm(fim) });
        break; // um por dia, para variar as datas
      }
    }
    if (achadas.length) setOpcoes(achadas);
  };

  const enviando = criar.isPending || decidir.isPending;
  const enviar = () => {
    const ops = validas.map((o) => { const { inicio, fim } = paraISO(o); return { inicio: inicio.toISOString(), fim: fim.toISOString() }; });
    criar.mutate({ titulo: titulo.trim(), local: local.trim() || undefined, descricao: descricao.trim() || undefined, opcoes: ops, demandaId: inicial?.demandaId, municipeId: inicial?.municipeId }, {
      onSuccess: (r) => {
        if (marcarDireto && editor && r?.id) decidir.mutate({ pedidoId: r.id, decisao: "aprovar", opcao: ops[0] }, { onSuccess: onClose });
        else onClose();
      },
    });
  };

  const semMandato = status.data && !status.data.mandato;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !enviando && !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pedir horário na agenda do mandato</DialogTitle>
          <DialogDescription>Sugira até 3 opções. Quem edita a agenda aprova uma, propõe outra ou recusa — você é avisado.</DialogDescription>
        </DialogHeader>

        {semMandato ? (
          <p className="text-sm text-muted-foreground">A agenda do mandato ainda não foi conectada. Peça a um editor da agenda para conectá-la.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ph-titulo">O que é</Label>
              <Input id="ph-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Visita à UBS do Jardim Ângela" autoFocus />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Opções de horário</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={sugerir} disabled={agenda.isLoading}>
                  <Sparkles className="h-3.5 w-3.5" /> Sugerir horários livres
                </Button>
              </div>
              {opcoes.map((o, i) => {
                const a = analise[i];
                return (
                  <div key={i} className="rounded-lg border p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground w-14 shrink-0">Opção {i + 1}</span>
                      <Input type="date" className="h-9" value={o.data} min={diaISO(new Date())}
                        onChange={(e) => setOpcoes((l) => l.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)))} aria-label={`Data da opção ${i + 1}`} />
                      {opcoes.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setOpcoes((l) => l.filter((_, j) => j !== i))} aria-label={`Tirar a opção ${i + 1}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pl-16">
                      <Input type="time" className="h-9" value={o.hIni} aria-label="Início"
                        onChange={(e) => {
                          const v = e.target.value; const [h, m] = v.split(":").map(Number);
                          setOpcoes((l) => l.map((x, j) => (j === i ? { ...x, hIni: v, hFim: Number.isNaN(h) ? x.hFim : `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}` } : x)));
                        }} />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input type="time" className="h-9" value={o.hFim} aria-label="Fim"
                        onChange={(e) => setOpcoes((l) => l.map((x, j) => (j === i ? { ...x, hFim: e.target.value } : x)))} />
                    </div>
                    {a.erro ? <p className="pl-16 text-xs text-destructive">{a.erro}</p> : a.valida && (
                      a.conflitos.length > 0 ? (
                        <p className="pl-16 flex items-start gap-1 text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>Mesmo horário de: {a.conflitos.map((c) => `${c.titulo} (${faixaHorario(c)})`).join("; ")}</span>
                        </p>
                      ) : agenda.data && (
                        <p className="pl-16 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Horário livre na agenda do mandato</p>
                      )
                    )}
                  </div>
                );
              })}
              {opcoes.length < 3 && (
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => setOpcoes((l) => [...l, vazia(l[l.length - 1]?.data || "")])}>
                  <Plus className="h-3.5 w-3.5" /> Outra opção
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ph-local">Local</Label>
              <Input id="ph-local" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Endereço ou link" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph-desc">Detalhes</Label>
              <Textarea id="ph-desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Quem vai, pauta, observações…" />
            </div>

            {editor && (
              <label className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer">
                <Switch checked={marcarDireto} onCheckedChange={setMarcarDireto} className="mt-0.5" />
                <span>
                  <span className="font-medium">Já marcar na agenda</span>
                  <span className="block text-xs text-muted-foreground">Você edita a agenda do mandato: a 1ª opção entra direto, sem esperar aprovação.</span>
                </span>
              </label>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
          {!semMandato && (
            <Button onClick={enviar} disabled={!titulo.trim() || validas.length === 0 || enviando}>
              {enviando ? "Enviando…" : marcarDireto && editor ? "Marcar na agenda" : "Enviar pedido"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

