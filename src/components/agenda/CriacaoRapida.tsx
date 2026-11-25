import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAcoesGoogle, type EventoGoogle, type OrigemAgenda, type StatusGoogle } from "@/hooks/useGoogleAgenda";
import { conflitosCom } from "./agendaUtil";
import { cn } from "@/lib/utils";

/**
 * Criação rápida (como no Google): clicou num horário vazio da grade,
 * aparece este balão com o título e a duração. "Salvar" cria direto;
 * "Mais opções" abre o formulário completo já preenchido.
 */

const escreve = (papel: string) => papel === "owner" || papel === "writer";
const DURACOES: [number, string][] = [[30, "30 min"], [60, "1 h"], [90, "1h30"], [120, "2 h"]];

export function destinosDeEscrita(status: StatusGoogle) {
  const lista: { origem: OrigemAgenda; id: string; nome: string; cor: string }[] = [];
  if (status.souEditorMandato) (status.mandato?.calendarios || []).filter((c) => escreve(c.papel)).forEach((c) => lista.push({ origem: "mandato", ...c }));
  (status.pessoal?.calendarios || []).filter((c) => escreve(c.papel)).forEach((c) => lista.push({ origem: "pessoal", ...c }));
  return lista;
}

export function CriacaoRapida({ inicio, fim, status, eventos, onMudarFim, onFechar, onMaisOpcoes }: {
  inicio: Date;
  fim: Date;
  status: StatusGoogle;
  /** Eventos já carregados, para avisar de conflito */
  eventos: EventoGoogle[];
  onMudarFim: (fim: Date) => void;
  onFechar: () => void;
  onMaisOpcoes: (v: { titulo: string; destino: string }) => void;
}) {
  const { criar } = useAcoesGoogle();
  const destinos = useMemo(() => destinosDeEscrita(status), [status]);
  const [titulo, setTitulo] = useState("");
  const [destino, setDestino] = useState(() => (destinos[0] ? `${destinos[0].origem}|${destinos[0].id}` : ""));
  const [origem, calendarId] = destino.split("|") as [OrigemAgenda, string];
  const duracao = Math.round((fim.getTime() - inicio.getTime()) / 60000);
  const conflitos = useMemo(() => conflitosCom(inicio, fim, eventos.filter((e) => e.origem === origem)), [inicio, fim, eventos, origem]);

  const quando = `${inicio.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })} · ${inicio.toTimeString().slice(0, 5)}–${fim.toTimeString().slice(0, 5)}`;
  const salvar = () => {
    if (!titulo.trim() || !calendarId || criar.isPending) return;
    criar.mutate(
      { origem, calendarId, evento: { titulo: titulo.trim(), diaInteiro: false, inicio: inicio.toISOString(), fim: fim.toISOString() } },
      { onSuccess: onFechar },
    );
  };

  return (
    <div className="space-y-2.5" onKeyDown={(e) => e.stopPropagation()}>
      <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Adicionar título" autoFocus aria-label="Título do evento"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); salvar(); } }}
        className="h-9 border-0 border-b rounded-none px-0 text-base font-medium shadow-none focus-visible:ring-0 focus-visible:border-primary" />
      <p className="text-sm first-letter:uppercase">{quando}</p>

      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Duração">
        {DURACOES.map(([min, rot]) => (
          <button key={min} type="button" role="radio" aria-checked={duracao === min}
            onClick={() => onMudarFim(new Date(inicio.getTime() + min * 60000))}
            className={cn("rounded-full border px-2.5 py-0.5 text-xs", duracao === min ? "border-primary bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground")}>
            {rot}
          </button>
        ))}
      </div>

      {destinos.length > 1 && (
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Agenda">
          {destinos.map((d) => {
            const v = `${d.origem}|${d.id}`;
            return (
              <button key={v} type="button" role="radio" aria-checked={destino === v} onClick={() => setDestino(v)}
                className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs", destino === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.cor }} />
                <span className="truncate">{d.origem === "mandato" ? "Mandato" : "Minha"} · {d.nome}</span>
              </button>
            );
          })}
        </div>
      )}

      {conflitos.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="[overflow-wrap:anywhere]">Mesmo horário de {conflitos.length === 1 ? `"${conflitos[0].titulo}"` : `${conflitos.length} compromissos`}. Dá para salvar assim.</span>
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => onMaisOpcoes({ titulo, destino })}>Mais opções</Button>
        <Button size="sm" onClick={salvar} disabled={!titulo.trim() || !calendarId || criar.isPending}>{criar.isPending ? "Salvando…" : "Salvar"}</Button>
      </div>
    </div>
  );
}
