import { diaISO, horaCurta, inicioDoDia, somarDias, type EventoGoogle } from "@/hooks/useGoogleAgenda";

/** "09:00–10:30" ou "dia inteiro" */
export function faixaHorario(e: EventoGoogle) {
  if (e.diaInteiro) return "dia inteiro";
  return `${horaCurta(e.inicio)}–${horaCurta(e.fim)}`;
}

const ms = (iso: string) => new Date(iso).getTime();

/**
 * Agrupa os eventos de um dia em blocos de horário: eventos que se
 * sobrepõem ficam no mesmo bloco (são simultâneos). Dia inteiro vem à parte.
 * Eventos marcados como "disponível" no Google não contam como conflito.
 */
export function agruparPorHorario(eventos: EventoGoogle[]) {
  const diaInteiro = eventos.filter((e) => e.diaInteiro);
  const comHora = eventos.filter((e) => !e.diaInteiro).sort((a, b) => ms(a.inicio) - ms(b.inicio));
  const blocos: EventoGoogle[][] = [];
  let atual: EventoGoogle[] = [];
  let fimAtual = -Infinity;
  for (const e of comHora) {
    const conta = !e.livre;
    if (atual.length > 0 && conta && ms(e.inicio) < fimAtual) {
      atual.push(e);
      fimAtual = Math.max(fimAtual, ms(e.fim));
    } else {
      if (atual.length) blocos.push(atual);
      atual = [e];
      fimAtual = conta ? ms(e.fim) : -Infinity;
    }
  }
  if (atual.length) blocos.push(atual);
  return { diaInteiro, blocos };
}

/** Eventos que batem com o intervalo [inicio, fim) — para o aviso de conflito. */
export function conflitosCom(inicio: Date, fim: Date, eventos: EventoGoogle[], ignorarId?: string) {
  const a = inicio.getTime(), b = fim.getTime();
  return eventos.filter((e) => e.id !== ignorarId && !e.livre && !e.diaInteiro && ms(e.inicio) < b && ms(e.fim) > a);
}

export interface Expediente { inicio: number; fim: number; diasUteis: boolean }
export const EXPEDIENTE_PADRAO: Expediente = { inicio: 8, fim: 18, diasUteis: true };

/** Horários livres de um dia, dentro do expediente, com pelo menos `duracaoMin`. */
export function horariosLivres(dia: Date, eventos: EventoGoogle[], exp: Expediente, duracaoMin: number) {
  const semana = (dia.getDay() + 6) % 7; // segunda = 0
  if (exp.diasUteis && semana >= 5) return { livres: [] as { de: Date; ate: Date }[], ocupados: [] as { de: Date; ate: Date; e: EventoGoogle }[], fechado: true };
  const ini = inicioDoDia(dia); ini.setHours(exp.inicio, 0, 0, 0);
  const fim = inicioDoDia(dia); fim.setHours(exp.fim, 0, 0, 0);
  const agora = new Date();
  const comeco = diaISO(dia) === diaISO(agora) && agora > ini ? new Date(Math.ceil(agora.getTime() / (15 * 60000)) * 15 * 60000) : ini;

  const ocupados = eventos
    .filter((e) => !e.diaInteiro && !e.livre && e.minhaResposta !== "declined")
    .map((e) => ({ de: new Date(Math.max(ms(e.inicio), ini.getTime())), ate: new Date(Math.min(ms(e.fim), fim.getTime())), e }))
    .filter((o) => o.ate > o.de)
    .sort((a, b) => a.de.getTime() - b.de.getTime());

  const livres: { de: Date; ate: Date }[] = [];
  let cursor = comeco;
  for (const o of ocupados) {
    if (o.de > cursor && (o.de.getTime() - cursor.getTime()) / 60000 >= duracaoMin) livres.push({ de: cursor, ate: o.de });
    if (o.ate > cursor) cursor = o.ate;
  }
  if (fim > cursor && (fim.getTime() - cursor.getTime()) / 60000 >= duracaoMin) livres.push({ de: cursor, ate: fim });
  return { livres, ocupados, fechado: false };
}

export const horaDe = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Texto da descrição do Google sem HTML (para prévias). */
export function textoSimples(html: string) {
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<\/p>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

export function diasDoPeriodo(de: Date, n: number) {
  return Array.from({ length: n }, (_, i) => somarDias(de, i));
}

/** Paleta para personalizar a cor das agendas (boa leitura com texto branco). */
export const CORES_AGENDA = [
  "#1D4ED8", "#0E7490", "#047857", "#4D7C0F", "#B45309", "#C2410C",
  "#B91C1C", "#BE185D", "#7E22CE", "#4338CA", "#334155", "#0F766E",
];
