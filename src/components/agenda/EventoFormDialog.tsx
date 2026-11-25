import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ROTULO_ORIGEM, diaISO, somarDias, useAcoesGoogle,
  type EventoGoogle, type OrigemAgenda, type StatusGoogle,
} from "@/hooks/useGoogleAgenda";

/**
 * Criar ou editar um evento do Google Agenda.
 * Só aparecem as agendas em que a pessoa pode escrever: as do mandato
 * (para editores) e as próprias.
 */

const escreve = (papel: string) => papel === "owner" || papel === "writer";
const horaDe = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export function EventoFormDialog({
  aberto, onClose, status, evento, diaInicial,
}: {
  aberto: boolean;
  onClose: () => void;
  status: StatusGoogle;
  /** Editando este evento; sem ele, cria um novo. */
  evento?: EventoGoogle | null;
  diaInicial?: Date;
}) {
  const { criar, editar } = useAcoesGoogle();
  const destinos = useMemo(() => {
    const lista: { origem: OrigemAgenda; id: string; nome: string; cor: string }[] = [];
    if (status.souEditorMandato) (status.mandato?.calendarios || []).filter((c) => escreve(c.papel)).forEach((c) => lista.push({ origem: "mandato", ...c }));
    (status.pessoal?.calendarios || []).filter((c) => escreve(c.papel)).forEach((c) => lista.push({ origem: "pessoal", ...c }));
    return lista;
  }, [status]);

  const [destino, setDestino] = useState("");
  const [titulo, setTitulo] = useState("");
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [data, setData] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [hIni, setHIni] = useState("09:00");
  const [hFim, setHFim] = useState("10:00");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [convidados, setConvidados] = useState<string[]>([]);
  const [novoConvidado, setNovoConvidado] = useState("");

  useEffect(() => {
    if (!aberto) return;
    if (evento) {
      setDestino(`${evento.origem}|${evento.calendarId}`);
      setTitulo(evento.titulo);
      setDiaInteiro(evento.diaInteiro);
      setData(evento.inicio.slice(0, 10));
      if (evento.diaInteiro) {
        setDataFim(diaISO(somarDias(new Date(evento.fim.slice(0, 10) + "T12:00:00"), -1)));
      } else {
        setData(diaISO(new Date(evento.inicio)));
        setDataFim(diaISO(new Date(evento.fim)));
        setHIni(horaDe(evento.inicio));
        setHFim(horaDe(evento.fim));
      }
      setLocal(evento.local);
      setDescricao(evento.descricao);
      setConvidados(evento.convidados.filter((c) => !c.organizador).map((c) => c.email));
    } else {
      const d = diaISO(diaInicial ?? new Date());
      setDestino(destinos[0] ? `${destinos[0].origem}|${destinos[0].id}` : "");
      setTitulo(""); setDiaInteiro(false); setData(d); setDataFim(d);
      setHIni("09:00"); setHFim("10:00"); setLocal(""); setDescricao(""); setConvidados([]);
    }
    setNovoConvidado("");
  }, [aberto, evento?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [origem, calendarId] = destino.split("|") as [OrigemAgenda, string];
  const salvando = criar.isPending || editar.isPending;

  const adicionarConvidado = () => {
    const e = novoConvidado.trim().toLowerCase();
    if (!/.+@.+\..+/.test(e) || convidados.includes(e)) return;
    setConvidados((l) => [...l, e]);
    setNovoConvidado("");
  };

  const salvar = () => {
    const fimData = dataFim || data;
    const corpo = diaInteiro
      ? { inicio: data, fim: diaISO(somarDias(new Date(fimData + "T12:00:00"), 1)) } // Google: fim exclusivo
      : { inicio: new Date(`${data}T${hIni}:00`).toISOString(), fim: new Date(`${fimData}T${hFim}:00`).toISOString() };
    const ev = {
      titulo, local, descricao, diaInteiro, ...corpo,
      convidados: convidados.map((email) => ({
        email, resposta: evento?.convidados.find((c) => c.email === email)?.resposta,
      })),
    };
    const fechar = { onSuccess: onClose };
    if (evento) editar.mutate({ origem: evento.origem, calendarId: evento.calendarId, eventId: evento.id, evento: ev }, fechar);
    else criar.mutate({ origem, calendarId, evento: ev }, fechar);
  };

  const fimAntes = !diaInteiro && new Date(`${dataFim || data}T${hFim}`) <= new Date(`${data}T${hIni}`);
  const pronto = !!titulo.trim() && !!data && !!calendarId && !fimAntes;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !salvando && !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{evento ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>
            {evento?.recorrente ? "Este evento se repete: a alteração vale só para esta data." : "Fica salvo direto no Google Agenda."}
          </DialogDescription>
        </DialogHeader>

        {destinos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma agenda em que você possa criar eventos. Conecte a sua agenda Google ou peça acesso de editor da agenda do mandato.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-titulo">Título</Label>
              <Input id="ev-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reunião com a associação de moradores" autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label>Agenda</Label>
              <Select value={destino} onValueChange={setDestino} disabled={!!evento}>
                <SelectTrigger><SelectValue placeholder="Escolha a agenda" /></SelectTrigger>
                <SelectContent>
                  {(["mandato", "pessoal"] as OrigemAgenda[]).map((o) => {
                    const itens = destinos.filter((d) => d.origem === o);
                    if (itens.length === 0) return null;
                    return (
                      <SelectGroup key={o}>
                        <SelectLabel>{ROTULO_ORIGEM[o]}</SelectLabel>
                        {itens.map((d) => (
                          <SelectItem key={d.id} value={`${d.origem}|${d.id}`}>
                            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.cor }} />{d.nome}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-sm"><Switch checked={diaInteiro} onCheckedChange={setDiaInteiro} /> Dia inteiro</label>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="ev-data">{diaInteiro ? "De" : "Data"}</Label>
                <Input id="ev-data" type="date" value={data} onChange={(e) => { setData(e.target.value); if (!dataFim || dataFim < e.target.value) setDataFim(e.target.value); }} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-data-fim">{diaInteiro ? "Até" : "Termina em"}</Label>
                <Input id="ev-data-fim" type="date" value={dataFim} min={data} onChange={(e) => setDataFim(e.target.value)} />
              </div>
              {!diaInteiro && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="ev-hi">Início</Label>
                    <Input id="ev-hi" type="time" value={hIni} onChange={(e) => {
                      const v = e.target.value; setHIni(v);
                      // mantém 1 hora de duração ao mudar o início
                      const [h, m] = v.split(":").map(Number);
                      if (!Number.isNaN(h)) setHFim(`${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
                    }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ev-hf">Fim</Label>
                    <Input id="ev-hf" type="time" value={hFim} onChange={(e) => setHFim(e.target.value)} />
                  </div>
                </>
              )}
            </div>
            {fimAntes && <p className="text-xs text-destructive">O fim precisa ser depois do início.</p>}

            <div className="space-y-1.5">
              <Label htmlFor="ev-local">Local</Label>
              <Input id="ev-local" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Endereço ou link" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">Descrição</Label>
              <Textarea id="ev-desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Pauta, observações…" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ev-conv">Convidados</Label>
              <div className="flex gap-2">
                <Input id="ev-conv" type="email" value={novoConvidado} onChange={(e) => setNovoConvidado(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); adicionarConvidado(); } }}
                  placeholder="e-mail e Enter" />
                <Button type="button" variant="outline" onClick={adicionarConvidado}>Incluir</Button>
              </div>
              {convidados.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {convidados.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs">
                      {c}
                      <button type="button" onClick={() => setConvidados((l) => l.filter((x) => x !== c))} aria-label={`Tirar ${c}`}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">O Google manda o convite por e-mail para cada um.</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          {destinos.length > 0 && (
            <Button onClick={salvar} disabled={!pronto || salvando}>{salvando ? "Salvando…" : evento ? "Salvar" : "Criar evento"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
