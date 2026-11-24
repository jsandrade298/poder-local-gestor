/**
 * Atalhos de "situação" para a lista de Demandas (?situacao=...).
 * Usados pelos números do Início para abrir a lista completa já filtrada.
 *
 *   sem-responsavel      abertas sem responsável
 *   vence-3              abertas com prazo entre hoje e daqui a 3 dias
 *   parada-30            abertas sem nenhuma alteração há 30+ dias
 *   parada-30-90         abertas sem alteração há 30 a 90 dias
 *
 * "Abertas" = status que não é final (configurado em Status das demandas).
 */

export type Situacao =
  | { tipo: "sem-responsavel"; texto: string }
  | { tipo: "vence"; min: number; texto: string }
  | { tipo: "parada"; min: number; max?: number; texto: string };

export function hojeLocalISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function somarDiasISO(iso: string, dias: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Momento de N dias atrás (ISO completo), para comparar com updated_at. */
export function diasAtrasISO(dias: number) {
  return new Date(Date.now() - dias * 86400000).toISOString();
}

export function textoDias(dias: number) {
  if (dias >= 365 && dias % 365 === 0) return dias === 365 ? "1 ano" : `${dias / 365} anos`;
  return `${dias} dias`;
}

export function descreverSituacao(valor: string | null | undefined): Situacao | null {
  if (!valor) return null;
  if (valor === "sem-responsavel") return { tipo: "sem-responsavel", texto: "demandas abertas sem responsável" };

  const vence = /^vence-(\d{1,3})$/.exec(valor);
  if (vence) {
    const min = Number(vence[1]);
    return { tipo: "vence", min, texto: `demandas abertas com prazo nos próximos ${min} dias` };
  }

  const parada = /^parada-(\d{1,4})(?:-(\d{1,4}))?$/.exec(valor);
  if (parada) {
    const min = Number(parada[1]);
    const max = parada[2] ? Number(parada[2]) : undefined;
    if (max !== undefined && max <= min) return null;
    return {
      tipo: "parada", min, max,
      texto: max
        ? `demandas abertas sem nenhuma alteração entre ${textoDias(min)} e ${textoDias(max)}`
        : `demandas abertas sem nenhuma alteração há mais de ${textoDias(min)}`,
    };
  }
  return null;
}
