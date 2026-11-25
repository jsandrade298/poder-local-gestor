import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck2, Landmark, Link2Off, Lock, Settings2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CORES_AGENDA } from "./agendaUtil";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { chamarAgenda, useAcoesGoogle, type CalendarioGoogle, type OrigemAgenda, type StatusGoogle } from "@/hooks/useGoogleAgenda";
import { cn } from "@/lib/utils";

/** Escolher quais agendas da conta Google aparecem no Jorgeus. */
export function EscolherCalendariosDialog({ tipo, onClose, somenteLeitura }: { tipo: OrigemAgenda | null; onClose: () => void; somenteLeitura?: boolean }) {
  const { escolher } = useAcoesGoogle();
  const lista = useQuery({
    queryKey: ["google-agenda-calendarios", tipo],
    enabled: !!tipo,
    queryFn: () => chamarAgenda<{ calendarios: CalendarioGoogle[] }>("calendarios", { tipo }),
    staleTime: 0,
  });
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [cores, setCores] = useState<Record<string, string>>({});
  useEffect(() => {
    if (lista.data) {
      setMarcadas(new Set(lista.data.calendarios.filter((c) => c.escolhida).map((c) => c.id)));
      setCores({});
    }
  }, [lista.data]);

  return (
    <Dialog open={!!tipo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tipo === "mandato" ? "Agendas do mandato no Jorgeus" : "Suas agendas no Jorgeus"}</DialogTitle>
          <DialogDescription>
            Marque as agendas da conta Google que devem aparecer e, se quiser, troque a cor (toque na bolinha).{" "}
            {tipo === "mandato" ? "A cor e as agendas valem para toda a equipe." : "Só você vê as suas, com as cores que escolher."}
          </DialogDescription>
        </DialogHeader>
        {lista.isError ? (
          <p className="text-sm text-destructive">{(lista.error as Error).message}</p>
        ) : !lista.data ? <Skeleton className="h-32" /> : (
          <div className="min-w-0 space-y-1.5">
            {lista.data.calendarios.map((c) => (
              <label key={c.id} className={cn("flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2", !somenteLeitura && "cursor-pointer hover:bg-muted/40")}>
                <Checkbox checked={marcadas.has(c.id)} disabled={somenteLeitura}
                  onCheckedChange={(v) => setMarcadas((s) => { const n = new Set(s); if (v) n.add(c.id); else n.delete(c.id); return n; })} />
                {somenteLeitura ? (
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c.cor }} />
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" onClick={(ev) => ev.stopPropagation()} aria-label={`Cor da agenda ${c.nome}`}
                        className="h-5 w-5 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-background ring-transparent hover:ring-border"
                        style={{ background: cores[c.id] ?? c.cor }} />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start" onClick={(ev) => ev.stopPropagation()}>
                      <p className="text-[11px] text-muted-foreground mb-1.5">{tipo === "mandato" ? "Cor para todo o gabinete" : "Cor só para você"}</p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {CORES_AGENDA.map((cor) => (
                          <button key={cor} type="button" aria-label={`Usar ${cor}`} onClick={() => setCores((m) => ({ ...m, [c.id]: cor }))}
                            className={cn("h-6 w-6 rounded-full", (cores[c.id] ?? c.cor).toLowerCase() === cor.toLowerCase() && "ring-2 ring-offset-2 ring-foreground")}
                            style={{ background: cor }} />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium break-words [overflow-wrap:anywhere] line-clamp-2" title={c.nome}>{c.nome}{c.principal ? " (principal)" : ""}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {c.papel === "owner" || c.papel === "writer" ? "pode criar e editar" : "só visualização"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>{somenteLeitura ? "Fechar" : "Cancelar"}</Button>
          {!somenteLeitura && (
            <Button disabled={marcadas.size === 0 || escolher.isPending}
              onClick={() => escolher.mutate({ tipo: tipo!, ids: [...marcadas], cores }, { onSuccess: onClose })}>
              {escolher.isPending ? "Salvando…" : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Cartões de conexão: agenda do mandato e a minha. */
export function ConexoesAgenda({ status, compacto }: { status: StatusGoogle; compacto?: boolean }) {
  const { conectar, desconectar } = useAcoesGoogle();
  const [escolhendo, setEscolhendo] = useState<OrigemAgenda | null>(null);
  const [desligando, setDesligando] = useState<OrigemAgenda | null>(null);
  const editor = status.souEditorMandato;

  const Cartao = ({ tipo }: { tipo: OrigemAgenda }) => {
    const conta = tipo === "mandato" ? status.mandato : status.pessoal;
    const Icone = tipo === "mandato" ? Landmark : User;
    const podeGerir = tipo === "pessoal" || editor;
    return (
      <div className={cn("rounded-xl border bg-card p-4 flex flex-col gap-3", compacto && "p-3")}>
        <div className="flex items-start gap-3">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", conta ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            <Icone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{tipo === "mandato" ? "Agenda do mandato" : "Minha agenda Google"}</p>
            {conta ? (
              <p className="text-xs text-muted-foreground truncate">
                {conta.email || "Conta conectada"} · {conta.calendarios.length} agenda{conta.calendarios.length === 1 ? "" : "s"}
                {tipo === "mandato" && status.mandato?.conectadoPor ? ` · conectada por ${status.mandato.conectadoPor.split(" ")[0]}` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {tipo === "mandato"
                  ? (editor ? "A agenda do vereador, para toda a equipe ver. Conecte com a conta Google dele." : "Ainda não conectada. Quem edita a agenda do mandato pode conectá-la.")
                  : "Veja e gerencie sua agenda Google aqui, e responda convites."}
              </p>
            )}
          </div>
        </div>
        {conta ? (
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setEscolhendo(tipo)}>
              <Settings2 className="h-3.5 w-3.5" /> {podeGerir ? "Escolher agendas" : "Ver agendas"}
            </Button>
            {podeGerir && (
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground" onClick={() => setDesligando(tipo)}>
                <Link2Off className="h-3.5 w-3.5" /> Desconectar
              </Button>
            )}
          </div>
        ) : podeGerir ? (
          <Button size="sm" className="h-9 gap-1.5 self-start" disabled={!status.configurado || conectar.isPending} onClick={() => conectar.mutate(tipo)}>
            <CalendarCheck2 className="h-4 w-4" /> {conectar.isPending ? "Abrindo o Google…" : "Conectar com o Google"}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Só os editores da agenda conectam</span>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Cartao tipo="mandato" />
        <Cartao tipo="pessoal" />
      </div>
      {!status.configurado && (
        <p className="text-xs text-destructive mt-2">A integração com o Google ainda não está configurada no servidor (faltam as credenciais).</p>
      )}

      <EscolherCalendariosDialog tipo={escolhendo} onClose={() => setEscolhendo(null)} somenteLeitura={escolhendo === "mandato" && !editor} />

      <AlertDialog open={!!desligando} onOpenChange={(v) => !v && setDesligando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar {desligando === "mandato" ? "a agenda do mandato" : "sua agenda Google"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os eventos continuam no Google Agenda; só deixam de aparecer no Jorgeus
              {desligando === "mandato" ? " para toda a equipe" : ""}. Dá para conectar de novo quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (desligando) desconectar.mutate(desligando); setDesligando(null); }}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
