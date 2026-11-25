import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarCheck2, CheckCircle2, Lock, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { usePessoasGabinete } from "@/hooks/useQuadros";
import {
  diaISO, inicioDoDia, somarDias, useAcoesPedidos, useEventosGoogle, usePedidosAgenda, useStatusGoogle,
  type PedidoAgenda, type StatusPedido,
} from "@/hooks/useGoogleAgenda";
import { conflitosCom, faixaHorario } from "./agendaUtil";
import { cn } from "@/lib/utils";

/**
 * Pedidos de agenda do mandato.
 *  - Editores: "Aguardando decisão" — aprovar uma das opções (vira evento no
 *    Google), propor outro horário ou recusar. Cada opção mostra conflitos.
 *  - Todos: "Meus pedidos" — situação, responder a contrapropostas, cancelar.
 */

const ROTULO_STATUS: Record<StatusPedido, string> = {
  pendente: "aguardando", aprovado: "aprovado", recusado: "recusado", contraproposta: "outro horário proposto", cancelado: "cancelado",
};
const COR_STATUS: Record<StatusPedido, string> = {
  pendente: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  contraproposta: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  aprovado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  recusado: "bg-muted text-muted-foreground", cancelado: "bg-muted text-muted-foreground",
};
const quando = (o: { inicio: string; fim: string }) =>
  `${new Date(o.inicio).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })} · ${new Date(o.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}–${new Date(o.fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
const hhmm = (d: Date) => d.toTimeString().slice(0, 5);

function CartaoPedido({ p, editor, souEu, eventosMandato }: { p: PedidoAgenda; editor: boolean; souEu: boolean; eventosMandato: any[] }) {
  const { porId } = usePessoasGabinete();
  const { decidir, responder, cancelar } = useAcoesPedidos();
  const [modo, setModo] = useState<null | "contrapropor" | "recusar">(null);
  const [reservado, setReservado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [cData, setCData] = useState(diaISO(new Date(p.opcoes[0]?.inicio ?? Date.now())));
  const [cIni, setCIni] = useState(hhmm(new Date(p.opcoes[0]?.inicio ?? Date.now())));
  const [cFim, setCFim] = useState(hhmm(new Date(p.opcoes[0]?.fim ?? Date.now())));
  const aberto = p.status === "pendente" || p.status === "contraproposta";
  const ocupado = decidir.isPending || responder.isPending || cancelar.isPending;
  const passou = (o: { inicio: string }) => new Date(o.inicio) < new Date();

  return (
    <li className="rounded-xl border bg-card p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{p.titulo}</p>
          <p className="text-[11px] text-muted-foreground">
            {souEu ? "Você pediu" : `Pedido de ${porId.get(p.solicitante_id)?.nome?.split(" ")[0] || "alguém"}`} em {new Date(p.created_at).toLocaleDateString("pt-BR")}
            {p.demanda_id && <> · <Link to={`/demandas?id=${p.demanda_id}`} className="underline underline-offset-2">ver demanda</Link></>}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium", COR_STATUS[p.status])}>{ROTULO_STATUS[p.status]}</span>
      </div>
      {p.local && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{p.local}</p>}
      {p.descricao && <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{p.descricao}</p>}

      {/* Opções (ou o horário aprovado) */}
      {p.status === "aprovado" && p.escolhida ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Marcado: {quando(p.escolhida)}</p>
      ) : (
        <ul className="space-y-1">
          {p.opcoes.map((o, i) => {
            const conf = conflitosCom(new Date(o.inicio), new Date(o.fim), eventosMandato);
            return (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
                <span className="text-xs tabular-nums font-medium">{quando(o)}</span>
                {passou(o) ? <span className="text-[11px] text-muted-foreground">já passou</span> : conf.length > 0 ? (
                  <span className="flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-300" title={conf.map((c) => `${c.titulo} (${faixaHorario(c)})`).join("; ")}>
                    <AlertTriangle className="h-3 w-3" /> mesmo horário de {conf.length === 1 ? conf[0].titulo : `${conf.length} compromissos`}
                  </span>
                ) : <span className="text-[11px] text-emerald-700 dark:text-emerald-400">livre</span>}
                <span className="flex-1" />
                {editor && aberto && p.status === "pendente" && !passou(o) && (
                  <Button size="sm" className="h-7 px-2 text-xs gap-1" disabled={ocupado}
                    onClick={() => decidir.mutate({ pedidoId: p.id, decisao: "aprovar", opcao: o, reservado })}>
                    <CalendarCheck2 className="h-3.5 w-3.5" /> Aprovar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {p.status === "contraproposta" && p.contraproposta && (
        <div className="rounded-lg border border-violet-300/60 bg-violet-50/60 dark:bg-violet-950/20 px-3 py-2 text-xs space-y-1.5">
          <p><strong>Outro horário proposto:</strong> {quando(p.contraproposta)}{p.contraproposta.mensagem ? ` — ${p.contraproposta.mensagem}` : ""}</p>
          {souEu && (
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs" disabled={ocupado} onClick={() => responder.mutate({ pedidoId: p.id, aceitar: true })}>Aceitar</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={ocupado} onClick={() => responder.mutate({ pedidoId: p.id, aceitar: false })}>Não dá</Button>
            </div>
          )}
        </div>
      )}
      {(p.status === "recusado" || p.status === "cancelado") && p.motivo && <p className="text-xs text-muted-foreground">Motivo: {p.motivo}</p>}

      {/* Ações do editor */}
      {editor && p.status === "pendente" && (
        <div className="space-y-2 border-t pt-2">
          <label className="flex items-center gap-2 text-xs"><Switch checked={reservado} onCheckedChange={setReservado} /> <Lock className="h-3 w-3" /> Aprovar como reservado (equipe vê só "Ocupado")</label>
          {modo === null ? (
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModo("contrapropor")}>Propor outro horário</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setModo("recusar")}>Recusar</Button>
            </div>
          ) : modo === "contrapropor" ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Input type="date" className="h-8 w-auto text-xs" value={cData} onChange={(e) => setCData(e.target.value)} />
                <Input type="time" className="h-8 w-auto text-xs" value={cIni} onChange={(e) => setCIni(e.target.value)} />
                <span className="text-xs text-muted-foreground">até</span>
                <Input type="time" className="h-8 w-auto text-xs" value={cFim} onChange={(e) => setCFim(e.target.value)} />
              </div>
              <Textarea rows={2} className="text-xs" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Recado para quem pediu (opcional)" />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 text-xs" disabled={ocupado || !cData}
                  onClick={() => decidir.mutate({ pedidoId: p.id, decisao: "contrapropor", mensagem: motivo, opcao: { inicio: new Date(`${cData}T${cIni}:00`).toISOString(), fim: new Date(`${cData}T${cFim}:00`).toISOString() } })}>
                  Propor
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setModo(null)}>Voltar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Textarea rows={2} className="text-xs" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional, quem pediu verá)" />
              <div className="flex gap-1.5">
                <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={ocupado} onClick={() => decidir.mutate({ pedidoId: p.id, decisao: "recusar", motivo })}>Recusar pedido</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setModo(null)}>Voltar</Button>
              </div>
            </div>
          )}
        </div>
      )}
      {souEu && aberto && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" disabled={ocupado} onClick={() => cancelar.mutate(p.id)}><X className="h-3.5 w-3.5" /> Cancelar pedido</Button>
        </div>
      )}
    </li>
  );
}

export function PedidosAgendaSheet({ aberto, onAbertoChange }: { aberto: boolean; onAbertoChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const uid = user?.id || "";
  const status = useStatusGoogle(aberto);
  const editor = !!status.data?.souEditorMandato;
  const pedidos = usePedidosAgenda(aberto);
  const [aba, setAba] = useState<"decidir" | "meus">("decidir");
  const hoje0 = useMemo(() => inicioDoDia(new Date()), []);
  const agenda = useEventosGoogle(hoje0, somarDias(hoje0, 90), aberto);
  const doMandato = useMemo(() => (agenda.data?.eventos ?? []).filter((e) => e.origem === "mandato"), [agenda.data]);

  const todos = pedidos.data ?? [];
  const aguardando = todos.filter((p) => p.status === "pendente");
  const meus = todos.filter((p) => p.solicitante_id === uid);
  const abaAtual = editor ? aba : "meus";
  const lista = abaAtual === "decidir" ? aguardando : meus;

  return (
    <Sheet open={aberto} onOpenChange={onAbertoChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b text-left">
          <SheetTitle>Pedidos de agenda</SheetTitle>
          <SheetDescription>{editor ? "Aprove uma das opções, proponha outro horário ou recuse." : "Acompanhe os horários que você pediu na agenda do mandato."}</SheetDescription>
          {editor && (
            <div className="flex rounded-lg border bg-muted/30 p-0.5 w-fit mt-2" role="radiogroup" aria-label="Quais pedidos">
              {([["decidir", `Aguardando decisão (${aguardando.length})`], ["meus", `Meus pedidos (${meus.length})`]] as const).map(([v, r]) => (
                <button key={v} type="button" role="radio" aria-checked={abaAtual === v} onClick={() => setAba(v)}
                  className={cn("px-3 py-1 text-xs rounded-md", abaAtual === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>{r}</button>
              ))}
            </div>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {pedidos.isLoading ? <Skeleton className="h-32" /> : pedidos.isError ? (
            <p className="text-sm text-destructive">Não foi possível carregar os pedidos.</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{abaAtual === "decidir" ? "Nenhum pedido aguardando decisão." : "Você não tem pedidos recentes."}</p>
          ) : (
            <ul className="space-y-3">
              {lista.map((p) => <CartaoPedido key={p.id} p={p} editor={editor} souEu={p.solicitante_id === uid} eventosMandato={doMandato} />)}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground mt-6">
            Pedidos feitos no sistema antigo continuam em <Link to="/solicitar-agenda" className="underline underline-offset-2">Pedidos antigos</Link>.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
