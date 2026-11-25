import { useState } from "react";
import { CalendarDays, Check, Clock, ExternalLink, FileText, HelpCircle, Lock, MapPin, Pencil, Trash2, User, Users, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";
import { RegistroCompromisso } from "./RegistroCompromisso";
import { ROTULO_ORIGEM, ROTULO_RESPOSTA, diaISO, horaCurta, somarDias, useAcoesGoogle, type EventoGoogle } from "@/hooks/useGoogleAgenda";
import { cn } from "@/lib/utils";

function quando(e: EventoGoogle) {
  const dia = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso)
    .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  if (e.diaInteiro) {
    const ultimo = diaISO(somarDias(new Date(e.fim.slice(0, 10) + "T12:00:00"), -1));
    return ultimo === e.inicio.slice(0, 10) ? `${dia(e.inicio)} · dia inteiro` : `${dia(e.inicio)} até ${dia(ultimo)}`;
  }
  const mesmoDia = diaISO(new Date(e.inicio)) === diaISO(new Date(e.fim));
  return mesmoDia ? `${dia(e.inicio)} · ${horaCurta(e.inicio)} às ${horaCurta(e.fim)}` : `${dia(e.inicio)} ${horaCurta(e.inicio)} até ${dia(e.fim)} ${horaCurta(e.fim)}`;
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;
/** Descrição do Google pode vir com HTML simples; mostramos como texto, com links clicáveis. */
function DescricaoTexto({ texto }: { texto: string }) {
  const limpo = texto.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  return (
    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
      {limpo.split(URL_RE).map((parte, i) => /^https?:\/\//.test(parte)
        ? <a key={i} href={parte} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 break-all">{parte}</a>
        : <span key={i}>{parte}</span>)}
    </p>
  );
}

export function EventoDetalheDialog({ evento, onClose, onEditar }: { evento: EventoGoogle | null; onClose: () => void; onEditar: (e: EventoGoogle) => void }) {
  const { excluir, responder } = useAcoesGoogle();
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  if (!evento) return null;
  const e = evento;

  return (
    <>
      <Dialog open={!!evento} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 pr-6">
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: e.cor }} />
              <span className="leading-snug">{e.titulo}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2"><Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /><span className="first-letter:uppercase">{quando(e)}</span></p>
            <p className="flex items-start gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4 mt-0.5 shrink-0" />{ROTULO_ORIGEM[e.origem]} · {e.calendario}{e.recorrente ? " · repete" : ""}</p>
            {e.oculto ? (
              <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Compromisso reservado: o horário está ocupado, mas só quem edita a agenda do mandato vê os detalhes.
              </p>
            ) : e.reservado && e.origem === "mandato" && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Reservado: o resto da equipe vê só "Ocupado".
              </p>
            )}
            {e.local && (
              <p className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                {/^https?:\/\//.test(e.local)
                  ? <a href={e.local} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 break-all">{e.local}</a>
                  : <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.local)}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.local}</a>}
              </p>
            )}
            {e.meet && (
              <p className="flex items-center gap-2"><Video className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={e.meet} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Entrar na videochamada</a>
              </p>
            )}
            {e.descricao && <DescricaoTexto texto={e.descricao} />}

            {e.convidados.length > 0 && (
              <div>
                <p className="flex items-center gap-2 text-xs font-medium mb-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" /> {e.convidados.length} convidado{e.convidados.length === 1 ? "" : "s"}</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {e.convidados.map((c) => (
                    <li key={c.email} className="flex items-center gap-2 text-xs">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                        c.resposta === "accepted" ? "bg-emerald-500" : c.resposta === "declined" ? "bg-destructive" : c.resposta === "tentative" ? "bg-amber-500" : "bg-muted-foreground/40")} />
                      <span className="truncate flex-1">{c.nome || c.email}{c.eu ? " (você)" : ""}{c.organizador ? " · organiza" : ""}</span>
                      <span className="text-muted-foreground shrink-0">{ROTULO_RESPOSTA[c.resposta]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(e.vinculos?.demandaId || e.vinculos?.municipeId) && (
              <div className="flex flex-wrap gap-1.5">
                {e.vinculos.demandaId && (
                  <Link to={`/demandas?id=${e.vinculos.demandaId}`} onClick={onClose} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted">
                    <FileText className="h-3.5 w-3.5" /> Ver a demanda ligada
                  </Link>
                )}
                {e.vinculos.municipeId && (
                  <Link to={`/municipes?abrir=${e.vinculos.municipeId}`} onClick={onClose} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted">
                    <User className="h-3.5 w-3.5" /> Ver o munícipe
                  </Link>
                )}
              </div>
            )}

            {!e.oculto && <RegistroCompromisso evento={e} />}

            {(e.criadoNoJorgeusPor || e.editadoNoJorgeusPor) && (
              <p className="text-[11px] text-muted-foreground">
                {e.criadoNoJorgeusPor && <>Criado no Jorgeus por {e.criadoNoJorgeusPor}. </>}
                {e.editadoNoJorgeusPor && <>Última edição no Jorgeus por {e.editadoNoJorgeusPor}.</>}
              </p>
            )}
          </div>

          {/* Convite: responder como no Google Agenda */}
          {e.minhaResposta && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium mb-2">
                Você foi convidado{e.organizador ? ` por ${e.organizador}` : ""}. Vai participar?
                {e.minhaResposta !== "needsAction" && <span className="text-muted-foreground font-normal"> (resposta atual: {ROTULO_RESPOSTA[e.minhaResposta]})</span>}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {([["accepted", "Sim", Check], ["tentative", "Talvez", HelpCircle], ["declined", "Não", X]] as const).map(([r, rotulo, Ic]) => (
                  <Button key={r} size="sm" variant={e.minhaResposta === r ? "default" : "outline"} className="h-8 gap-1"
                    disabled={responder.isPending}
                    onClick={() => responder.mutate({ calendarId: e.calendarId, eventId: e.id, resposta: r }, { onSuccess: onClose })}>
                    <Ic className="h-3.5 w-3.5" /> {rotulo}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {e.podeEditar && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEditar(e)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>}
            {e.podeExcluir && (
              <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmarExclusao(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            )}
            <span className="flex-1" />
            {e.link && (
              <Button asChild size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
                <a href={e.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Abrir no Google</a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{e.titulo}"?</AlertDialogTitle>
            <AlertDialogDescription>
              O evento sai do Google Agenda{e.convidados.length > 0 ? " e os convidados recebem o aviso de cancelamento" : ""}.
              {e.recorrente ? " Só esta data é excluída; as outras repetições continuam." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => excluir.mutate({ origem: e.origem, calendarId: e.calendarId, eventId: e.id }, { onSuccess: () => { setConfirmarExclusao(false); onClose(); } })}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
