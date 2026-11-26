import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { fetchAll } from "@/lib/fetchAll";
import { normalizarBusca } from "@/lib/busca";

/**
 * Análises do gabinete (substitui aos poucos a Visão geral e o Balanço).
 *
 * Regras:
 *  - Tudo é calculado sobre TODAS as linhas (paginado), sem o limite de 1.000.
 *  - Cada gráfico informa a cobertura do dado; abaixo do mínimo, não aparece.
 *  - Não existe data de conclusão no banco: para demandas em status final,
 *    usamos a última alteração (updated_at) como estimativa — a tela avisa.
 */

/**
 * Período escolhido, como texto (guardado no navegador):
 *   "semana" | "quinzena" | "mes"   a semana (seg–dom), a quinzena (1–15 / 16–fim)
 *                                    ou o mês corrente; ":-1", ":-2"… voltam períodos
 *   "3" | "6" | "12"   últimos N meses
 *   "ano-2026"         o ano inteiro (até hoje, se for o ano atual)
 *   "tudo"             desde a primeira demanda registrada (mandato todo no sistema)
 */
export type Periodo = string;
export type PeriodoCurto = "semana" | "quinzena" | "mes";

export function periodoValido(p: string | null | undefined): p is Periodo {
  return !!p && (/^(3|6|12)$/.test(p) || /^ano-\d{4}$/.test(p) || p === "tudo" || /^(semana|quinzena|mes)(:-\d+)?$/.test(p) || !!lerPeriodoLivre(p));
}

/** "livre:2026-11-01:2026-11-25" → datas (início ≤ fim); outro formato → null */
export function lerPeriodoLivre(p: Periodo): { de: string; ate: string } | null {
  const m = p.match(/^livre:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
  if (!m || m[1] > m[2]) return null;
  return { de: m[1], ate: m[2] };
}

/** Filtros que valem para a tela toda (as demandas de fora não entram em nenhum número) */
export interface FiltrosAnalise { areaId?: string | null; responsavelId?: string | null }

const ROTULO_PRIORIDADE: Record<string, string> = { urgente: "Urgente", alta: "Alta", media: "Média", baixa: "Baixa" };
const ORDEM_PRIORIDADE = ["urgente", "alta", "media", "baixa"];

/** "semana:-2" → { tipo: "semana", desloc: -2 }; períodos longos → null */
export function lerPeriodoCurto(p: Periodo): { tipo: PeriodoCurto; desloc: number } | null {
  const m = p.match(/^(semana|quinzena|mes)(?::(-\d+))?$/);
  return m ? { tipo: m[1] as PeriodoCurto, desloc: Math.min(0, Number(m[2] || 0)) } : null;
}

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaMes = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Começo e fim (completo) de uma semana/quinzena/mês, contando a partir de hoje. */
function janelaCurta(tipo: PeriodoCurto, desloc: number, hoje: Date) {
  if (tipo === "semana") {
    const inicio = inicioSemana(hoje);
    inicio.setDate(inicio.getDate() + 7 * desloc);
    const fim = new Date(inicio); fim.setDate(fim.getDate() + 6);
    return { inicio, fim };
  }
  if (tipo === "mes") {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() + desloc, 1);
    return { inicio, fim: new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0) };
  }
  // Quinzena: 1ª = dias 1 a 15; 2ª = dia 16 até o fim do mês
  const idx = hoje.getFullYear() * 24 + hoje.getMonth() * 2 + (hoje.getDate() > 15 ? 1 : 0) + desloc;
  const ano = Math.floor(idx / 24), mes = Math.floor((idx % 24) / 2), segunda = idx % 2 === 1;
  return {
    inicio: new Date(ano, mes, segunda ? 16 : 1),
    fim: segunda ? new Date(ano, mes + 1, 0) : new Date(ano, mes, 15),
    segunda,
  };
}

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (d: Date) => `${NOMES_MES[d.getMonth()]}/${d.getFullYear()}`;

/** Abaixo disto (fração das demandas com o campo preenchido) o gráfico some. */
export const COBERTURA_MINIMA = 0.2;
/** Abaixo disto, o gráfico aparece com aviso de cobertura. */
export const COBERTURA_AVISO = 0.8;

const ROTULO_ORIGEM: Record<string, string> = {
  whatsapp_mandato: "WhatsApp do mandato",
  whatsapp_assessoria: "WhatsApp da assessoria",
  whatsapp_parlamentar: "WhatsApp do parlamentar",
  gabinete: "No gabinete",
  em_agenda: "Em agenda",
  instagram: "Instagram",
  telefone: "Telefone",
  email: "E-mail",
  outro: "Outro",
};

export interface DemandaLinha {
  id: string;
  protocolo: string;
  titulo: string;
  area_id: string | null;
  prioridade: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  data_prazo: string | null;
  origem: string | null;
  bairro: string | null;
  responsavel_id: string | null;
  humor: string | null;
  areas: { nome: string } | null;
}

interface MunicipeLinha {
  id: string;
  created_at: string;
  telefone: string | null;
  bairro: string | null;
  data_nascimento: string | null;
}

export interface Cobertura {
  preenchidas: number;
  total: number;
  fracao: number;
}

function cobertura(preenchidas: number, total: number): Cobertura {
  return { preenchidas, total, fracao: total > 0 ? preenchidas / total : 0 };
}

function hojeLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDia(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Início da semana (segunda-feira) de uma data. */
function inicioSemana(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dia = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - dia);
  return x;
}

function inicioMes(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Tamanho de cada barra/ponto dos gráficos de tempo */
export type Escala = "dia" | "semana" | "mes";

function chaveBalde(d: Date, escala: Escala) {
  if (escala === "dia") { const x = new Date(d); x.setHours(0, 0, 0, 0); return isoDia(x); }
  return isoDia(escala === "mes" ? inicioMes(d) : inicioSemana(d));
}

function rotuloBalde(chave: string, escala: Escala, poucosDias = false) {
  const d = new Date(chave + "T12:00:00");
  if (escala === "dia") return poucosDias ? `${DIAS_SEMANA[d.getDay()]} ${d.getDate()}` : diaMes(d);
  return escala === "mes"
    ? d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "")
    : diaMes(d);
}

function gerarBaldes(inicio: Date, fim: Date, escala: Escala) {
  const chaves: string[] = [];
  const cursor = escala === "mes" ? inicioMes(inicio) : escala === "semana" ? inicioSemana(inicio) : new Date(inicio);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= fim) {
    chaves.push(isoDia(cursor));
    if (escala === "mes") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + (escala === "semana" ? 7 : 1));
  }
  return chaves;
}

/** Agrupa grafias diferentes do mesmo bairro ("Jd. São Luís", "jd sao luis"). */
function chaveBairro(b: string) {
  return normalizarBusca(b).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function topN<T extends { valor: number }>(itens: T[], n: number) {
  return [...itens].sort((a, b) => b.valor - a.valor).slice(0, n);
}

export function useAnalisesData(periodo: Periodo, filtros: FiltrosAnalise = {}) {
  const { statusList, finalSlugs, getStatusLabel } = useDemandaStatus();

  const demandasQ = useQuery({
    queryKey: ["analises-demandas"],
    queryFn: () =>
      fetchAll<DemandaLinha>((from, to) =>
        supabase.from("demandas")
          .select("id, protocolo, titulo, area_id, prioridade, status, created_at, updated_at, data_prazo, origem, bairro, responsavel_id, humor, areas(nome)")
          .order("id").range(from, to) as any
      ),
    staleTime: 5 * 60_000,
  });

  const municipesQ = useQuery({
    queryKey: ["analises-municipes"],
    queryFn: () =>
      fetchAll<MunicipeLinha>((from, to) =>
        supabase.from("municipes")
          .select("id, created_at, telefone, bairro, data_nascimento")
          .order("id").range(from, to) as any
      ),
    staleTime: 5 * 60_000,
  });

  const pessoasQ = useQuery({
    queryKey: ["analises-pessoas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60_000,
  });

  const resultado = useMemo(() => {
    const todasDemandas = demandasQ.data;
    const municipes = municipesQ.data;
    if (!todasDemandas || statusList.length === 0) return null;
    // Área e responsável escolhidos: valem para todos os números das demandas
    const demandas = todasDemandas.filter((d) =>
      (!filtros.areaId || (filtros.areaId === "sem" ? !d.area_id : d.area_id === filtros.areaId)) &&
      (!filtros.responsavelId || (filtros.responsavelId === "sem" ? !d.responsavel_id : d.responsavel_id === filtros.responsavelId)));

    const finais = new Set(finalSlugs);
    const ehFinal = (s: string | null) => finais.has(s || "");
    const hoje = hojeLocal();
    const hojeIso = isoDia(hoje);
    const nomes = new Map((pessoasQ.data ?? []).map((p) => [p.id, p.nome as string]));

    // ── Janela do período ──
    const primeira = todasDemandas.reduce<Date | null>((min, d) => {
      const x = new Date(d.created_at);
      return !min || x < min ? x : min;
    }, null) ?? hoje;
    const anoAtual = hoje.getFullYear();
    const anosDisponiveis: number[] = [];
    for (let a = primeira.getFullYear(); a <= anoAtual; a++) anosDisponiveis.push(a);

    let inicio: Date;
    let fim: Date = hoje;
    let rotulo: string;      // "nos últimos 6 meses", "em 2026", "desde fev/2026", "nesta semana (23/11 a 29/11)"
    let rotuloCurto: string; // "6m", "2026", "total", "semana"
    const curto = lerPeriodoCurto(periodo);
    const livre = lerPeriodoLivre(periodo);
    let navegacao: null | { tipo: PeriodoCurto; desloc: number; podeVoltar: boolean; podeAvancar: boolean; completo: boolean } = null;
    let anterior: null | { inicio: Date; fim: Date; rotulo: string } = null;
    if (curto) {
      const j = janelaCurta(curto.tipo, curto.desloc, hoje);
      inicio = j.inicio;
      fim = j.fim > hoje ? hoje : j.fim;
      const faixa = `${diaMes(j.inicio)} a ${diaMes(j.fim)}`;
      const nomeMes = j.inicio.toLocaleDateString("pt-BR", { month: "long" });
      if (curto.tipo === "semana") {
        rotulo = curto.desloc === 0 ? `nesta semana (${faixa})` : curto.desloc === -1 ? `na semana passada (${faixa})` : `na semana de ${faixa}`;
        rotuloCurto = "semana";
      } else if (curto.tipo === "quinzena") {
        rotulo = `${curto.desloc === 0 ? "nesta quinzena" : `na ${j.segunda ? "2ª" : "1ª"} quinzena de ${nomeMes}`} (${faixa}${j.inicio.getFullYear() !== anoAtual ? "/" + j.inicio.getFullYear() : ""})`;
        rotuloCurto = "quinzena";
      } else {
        rotulo = curto.desloc === 0 ? `neste mês (${mesAno(j.inicio)})` : curto.desloc === -1 ? `no mês passado (${mesAno(j.inicio)})` : `em ${mesAno(j.inicio)}`;
        rotuloCurto = "mês";
      }
      // Comparação justa: o período anterior até o MESMO ponto (ex.: seg–qua com seg–qua)
      const ja = janelaCurta(curto.tipo, curto.desloc - 1, hoje);
      const decorrido = fim.getTime() - inicio.getTime();
      const fimAnt = new Date(Math.min(ja.fim.getTime(), ja.inicio.getTime() + decorrido));
      anterior = {
        inicio: ja.inicio, fim: fimAnt,
        rotulo: curto.tipo === "semana" ? "à semana anterior" : curto.tipo === "quinzena" ? "à quinzena anterior" : "ao mês anterior",
      };
      navegacao = { ...curto, podeVoltar: j.inicio > primeira, podeAvancar: curto.desloc < 0, completo: j.fim <= hoje };
    } else if (livre) {
      inicio = new Date(`${livre.de}T00:00:00`);
      const fimEscolhido = new Date(`${livre.ate}T00:00:00`);
      fim = fimEscolhido > hoje ? hoje : fimEscolhido;
      const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
      rotulo = livre.de === livre.ate ? `em ${fmt(inicio)}` : `de ${fmt(inicio)} a ${fmt(fimEscolhido)}`;
      rotuloCurto = "período";
      // Compara com o mesmo número de dias logo antes
      const dur = Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1;
      const fimAnt = new Date(inicio); fimAnt.setDate(fimAnt.getDate() - 1);
      const iniAnt = new Date(fimAnt); iniAnt.setDate(iniAnt.getDate() - (dur - 1));
      anterior = { inicio: iniAnt, fim: fimAnt, rotulo: `aos ${dur} ${dur === 1 ? "dia" : "dias"} anteriores` };
    } else if (periodo.startsWith("ano-")) {
      const ano = Number(periodo.slice(4));
      inicio = new Date(ano, 0, 1);
      fim = ano < anoAtual ? new Date(ano, 11, 31) : hoje;
      rotulo = ano < anoAtual ? `em ${ano}` : `em ${ano} (até hoje)`;
      rotuloCurto = String(ano);
    } else if (periodo === "tudo") {
      inicio = inicioMes(primeira);
      rotulo = `desde ${mesAno(primeira)}`;
      rotuloCurto = "total";
    } else {
      const meses = Number(periodo) || 6;
      inicio = new Date(hoje);
      inicio.setMonth(inicio.getMonth() - meses);
      rotulo = `nos últimos ${meses} meses`;
      rotuloCurto = `${meses}m`;
    }
    const fimDoDia = new Date(fim);
    fimDoDia.setHours(23, 59, 59, 999);
    // Dias até ~1,5 mês; semanas até ~6 meses; acima disso, meses
    const diasNoPeriodo = (fim.getTime() - inicio.getTime()) / 86400000;
    const escala: Escala = diasNoPeriodo > 190 ? "mes" : diasNoPeriodo > 45 ? "semana" : "dia";
    const mensal = escala === "mes";
    const poucosDias = curto?.tipo === "semana";

    const noPeriodo = (iso: string) => {
      const d = new Date(iso);
      return d >= inicio && d <= fimDoDia;
    };
    const entraram = demandas.filter((d) => noPeriodo(d.created_at));
    const concluidas = demandas.filter((d) => ehFinal(d.status) && noPeriodo(d.updated_at));
    const abertas = demandas.filter((d) => !ehFinal(d.status));

    // Mesmo recorte no período anterior (só nos períodos curtos)
    let comparacao: null | { entraram: number; concluidas: number; rotulo: string } = null;
    if (anterior) {
      const ini = anterior.inicio, f = new Date(anterior.fim); f.setHours(23, 59, 59, 999);
      const noAnterior = (iso: string) => { const d = new Date(iso); return d >= ini && d <= f; };
      comparacao = {
        entraram: demandas.filter((d) => noAnterior(d.created_at)).length,
        concluidas: demandas.filter((d) => ehFinal(d.status) && noAnterior(d.updated_at)).length,
        rotulo: anterior.rotulo,
      };
    }

    // ── Entrada × conclusão por semana/mês ──
    // Períodos curtos mostram o período inteiro (os dias que ainda vão chegar ficam zerados)
    const chaves = gerarBaldes(inicio, curto ? janelaCurta(curto.tipo, curto.desloc, hoje).fim : fim, escala);
    const entradaPor = new Map<string, number>();
    const conclusaoPor = new Map<string, number>();
    entraram.forEach((d) => {
      const k = chaveBalde(new Date(d.created_at), escala);
      entradaPor.set(k, (entradaPor.get(k) || 0) + 1);
    });
    concluidas.forEach((d) => {
      const k = chaveBalde(new Date(d.updated_at), escala);
      conclusaoPor.set(k, (conclusaoPor.get(k) || 0) + 1);
    });
    // Dias que ainda não chegaram ficam vazios (sem linha), não como zero
    const futuro = (k: string) => k > hojeIso;
    const fluxo = chaves.map((k) => ({
      chave: k,
      rotulo: rotuloBalde(k, escala, poucosDias),
      entrada: futuro(k) ? (null as unknown as number) : entradaPor.get(k) || 0,
      conclusao: futuro(k) ? (null as unknown as number) : conclusaoPor.get(k) || 0,
    }));

    // Primeiro mês/semana muito acima dos outros = cadastro em massa ao começar
    // a usar o sistema (importação). Avisamos para não ler como "pico de pedidos".
    let picoInicial: { rotulo: string; valor: number } | null = null;
    const primeiroBalde = chaveBalde(primeira, escala);
    const idxPico = fluxo.findIndex((f) => f.chave === primeiroBalde);
    if (idxPico >= 0 && fluxo.length >= 4) {
      const outros = fluxo.filter((_, i) => i !== idxPico).map((f) => f.entrada).filter((v) => v > 0).sort((a, b) => a - b); // null (futuro) não passa em v > 0
      const med = outros.length ? outros[Math.floor(outros.length / 2)] : 0;
      if (med > 0 && fluxo[idxPico].entrada > med * 3) {
        picoInicial = { rotulo: fluxo[idxPico].rotulo, valor: fluxo[idxPico].entrada };
      }
    }

    // ── Tempo até concluir (dias, estimado) ──
    const tempos = concluidas
      .map((d) => (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 86400000)
      .filter((x) => x >= 0)
      .sort((a, b) => a - b);
    const mediana = tempos.length ? tempos[Math.floor(tempos.length / 2)] : null;

    // ── Canal de entrada ──
    const comOrigem = entraram.filter((d) => d.origem);
    const porOrigem = new Map<string, number>();
    comOrigem.forEach((d) => porOrigem.set(d.origem!, (porOrigem.get(d.origem!) || 0) + 1));
    const canais = topN(
      [...porOrigem.entries()].map(([k, valor]) => ({ nome: ROTULO_ORIGEM[k] || k, valor })),
      8
    );

    // ── Andamento (funil por status, demandas atuais) ──
    const porStatus = new Map<string, number>();
    demandas.forEach((d) => porStatus.set(d.status || "", (porStatus.get(d.status || "") || 0) + 1));
    const funil = statusList.map((s) => ({ nome: s.nome, valor: porStatus.get(s.slug) || 0, final: s.is_final }));

    // ── Prazo ──
    const concluidasComPrazo = concluidas.filter((d) => d.data_prazo);
    const noPrazo = concluidasComPrazo.filter((d) => isoDia(new Date(d.updated_at)) <= d.data_prazo!).length;
    const abertasComPrazo = abertas.filter((d) => d.data_prazo);
    const atrasadasAbertas = abertasComPrazo.filter((d) => d.data_prazo! < hojeIso);
    // Faixas de atraso: cada demanda entra em UMA faixa só (a soma dá o total de atrasadas).
    // Os filtros "ate-30", "31-60", "61-90" e "90" de Demandas abrem exatamente essas listas.
    const diasDeAtraso = (prazo: string) => Math.round((hoje.getTime() - new Date(prazo + "T00:00:00").getTime()) / 86400000);
    const atrasos = atrasadasAbertas.map((d) => diasDeAtraso(d.data_prazo!));
    const faixasAtraso = [
      { rotulo: "até 30 dias", filtro: "ate-30", valor: atrasos.filter((n) => n <= 30).length },
      { rotulo: "31 a 60 dias", filtro: "31-60", valor: atrasos.filter((n) => n > 30 && n <= 60).length },
      { rotulo: "61 a 90 dias", filtro: "61-90", valor: atrasos.filter((n) => n > 60 && n <= 90).length },
      { rotulo: "mais de 90", filtro: "90", valor: atrasos.filter((n) => n > 90).length },
    ];
    const atrasoPorArea = new Map<string, number>();
    atrasadasAbertas.forEach((d) => {
      const a = d.areas?.nome || "Sem área";
      atrasoPorArea.set(a, (atrasoPorArea.get(a) || 0) + 1);
    });

    // ── Território (bairros agrupados por grafia) ──
    const comBairro = entraram.filter((d) => d.bairro && d.bairro.trim());
    const grupos = new Map<string, { contagem: number; grafias: Map<string, number> }>();
    comBairro.forEach((d) => {
      const original = d.bairro!.trim();
      const k = chaveBairro(original);
      if (!k) return;
      const g = grupos.get(k) || { contagem: 0, grafias: new Map() };
      g.contagem++;
      g.grafias.set(original, (g.grafias.get(original) || 0) + 1);
      grupos.set(k, g);
    });
    const bairros = topN(
      [...grupos.values()].map((g) => ({
        nome: [...g.grafias.entries()].sort((a, b) => b[1] - a[1])[0][0],
        valor: g.contagem,
        grafias: g.grafias.size,
      })),
      10
    );

    // ── Equipe ──
    const equipeMap = new Map<string, { abertas: number; atrasadas: number; concluidas: number }>();
    const linhaEquipe = (id: string) => {
      const l = equipeMap.get(id) || { abertas: 0, atrasadas: 0, concluidas: 0 };
      equipeMap.set(id, l);
      return l;
    };
    abertas.forEach((d) => { if (d.responsavel_id) linhaEquipe(d.responsavel_id).abertas++; });
    atrasadasAbertas.forEach((d) => { if (d.responsavel_id) linhaEquipe(d.responsavel_id).atrasadas++; });
    concluidas.forEach((d) => { if (d.responsavel_id) linhaEquipe(d.responsavel_id).concluidas++; });
    const equipe = [...equipeMap.entries()]
      .map(([id, v]) => ({ id, nome: nomes.get(id) || "Usuário removido", ...v }))
      .sort((a, b) => b.abertas - a.abertas || b.atrasadas - a.atrasadas);
    const semResponsavel = abertas.filter((d) => !d.responsavel_id).length;

    // ── Base de munícipes ──
    let base: null | {
      total: number;
      novosNoPeriodo: number;
      novosPor: { rotulo: string; valor: number }[];
      telefone: Cobertura;
      bairro: Cobertura;
      nascimento: Cobertura;
    } = null;
    if (municipes) {
      const novos = municipes.filter((m) => noPeriodo(m.created_at));
      const novosMap = new Map<string, number>();
      novos.forEach((m) => {
        const k = chaveBalde(new Date(m.created_at), escala);
        novosMap.set(k, (novosMap.get(k) || 0) + 1);
      });
      const telValido = municipes.filter((m) => (m.telefone || "").replace(/\D/g, "").replace(/^55/, "").length >= 10).length;
      base = {
        total: municipes.length,
        novosNoPeriodo: novos.length,
        novosPor: chaves.map((k) => ({ rotulo: rotuloBalde(k, escala, poucosDias), chave: k, valor: k > hojeIso ? (null as unknown as number) : novosMap.get(k) || 0 })),
        telefone: cobertura(telValido, municipes.length),
        bairro: cobertura(municipes.filter((m) => m.bairro && m.bairro.trim()).length, municipes.length),
        nascimento: cobertura(municipes.filter((m) => m.data_nascimento).length, municipes.length),
      };
    }

    // ── Demandas recebidas no período: onde estão hoje (funil), por área e prioridade ──
    const porStatusRecebidas = new Map<string, number>();
    entraram.forEach((d) => porStatusRecebidas.set(d.status || "", (porStatusRecebidas.get(d.status || "") || 0) + 1));
    const funilRecebidas = statusList.map((s) => ({ slug: s.slug, nome: s.nome, cor: s.cor, final: s.is_final, valor: porStatusRecebidas.get(s.slug) || 0 }));
    const semStatusConhecido = entraram.length - funilRecebidas.reduce((n, f) => n + f.valor, 0);
    if (semStatusConhecido > 0) funilRecebidas.push({ slug: "_outro", nome: "Outro status", cor: "#94a3b8", final: false, valor: semStatusConhecido });
    const recebidasAbertas = entraram.filter((d) => !ehFinal(d.status));
    const recebidas = {
      total: entraram.length,
      concluidas: entraram.filter((d) => ehFinal(d.status)).length,
      abertas: recebidasAbertas.length,
      atrasadas: recebidasAbertas.filter((d) => d.data_prazo && d.data_prazo < hojeIso).length,
      semResponsavel: recebidasAbertas.filter((d) => !d.responsavel_id).length,
      semPrazo: recebidasAbertas.filter((d) => !d.data_prazo).length,
    };
    const areaMap = new Map<string, { id: string; nome: string; recebidas: number; concluidas: number; abertas: number; atrasadas: number }>();
    entraram.forEach((d) => {
      const id = d.area_id || "sem";
      const l = areaMap.get(id) || { id, nome: d.areas?.nome || "Sem área", recebidas: 0, concluidas: 0, abertas: 0, atrasadas: 0 };
      l.recebidas++;
      if (ehFinal(d.status)) l.concluidas++;
      else { l.abertas++; if (d.data_prazo && d.data_prazo < hojeIso) l.atrasadas++; }
      areaMap.set(id, l);
    });
    const porArea = [...areaMap.values()].sort((a, b) => b.recebidas - a.recebidas || a.nome.localeCompare(b.nome, "pt-BR"));
    const prioMap = new Map<string, number>();
    entraram.forEach((d) => { const p = d.prioridade || "sem"; prioMap.set(p, (prioMap.get(p) || 0) + 1); });
    const prioridades = [...ORDEM_PRIORIDADE, "sem"].filter((p) => prioMap.has(p))
      .map((p) => ({ nome: ROTULO_PRIORIDADE[p] || "Sem prioridade", valor: prioMap.get(p)! }));

    // ── Totais gerais (tudo o que já foi registrado, sem período) ──
    const concluidasTotal = demandas.filter((d) => ehFinal(d.status)).length;
    const geral = {
      desde: mesAno(primeira),
      demandas: demandas.length,
      concluidas: concluidasTotal,
      abertas: abertas.length,
      pctConcluidas: demandas.length ? concluidasTotal / demandas.length : 0,
      municipes: municipes?.length ?? null,
    };

    return {
      mensal,
      escala,
      comparacao,
      recebidas,
      funilRecebidas,
      porArea,
      prioridades,
      /** As demandas que entraram no período (para exportar) */
      listaEntraram: entraram,
      filtrado: !!(filtros.areaId || filtros.responsavelId),
      periodo: { rotulo, rotuloCurto, anosDisponiveis, ehPassado: fim < hoje, navegacao },
      geral,
      picoInicial,
      totais: {
        entraram: entraram.length,
        concluidas: concluidas.length,
        saldo: entraram.length - concluidas.length,
        abertasHoje: abertas.length,
        medianaDias: mediana,
        pctNoPrazo: concluidasComPrazo.length ? noPrazo / concluidasComPrazo.length : null,
        baseNoPrazo: concluidasComPrazo.length,
      },
      fluxo,
      canais,
      coberturaCanal: cobertura(comOrigem.length, entraram.length),
      funil,
      atrasoPorArea: topN([...atrasoPorArea.entries()].map(([nome, valor]) => ({ nome, valor })), 8),
      atrasadasAbertas: atrasadasAbertas.length,
      faixasAtraso,
      coberturaPrazo: cobertura(abertasComPrazo.length, abertas.length),
      bairros,
      coberturaBairro: cobertura(comBairro.length, entraram.length),
      equipe,
      semResponsavel,
      base,
      coberturaHumor: cobertura(demandas.filter((d) => d.humor).length, demandas.length),
    };
  }, [demandasQ.data, municipesQ.data, pessoasQ.data, statusList, finalSlugs, periodo, filtros.areaId, filtros.responsavelId]);

  return {
    dados: resultado,
    carregando: demandasQ.isLoading || statusList.length === 0,
    carregandoBase: municipesQ.isLoading,
    erro: demandasQ.isError,
    erroBase: municipesQ.isError,
    tentarDeNovo: () => { demandasQ.refetch(); municipesQ.refetch(); pessoasQ.refetch(); },
    getStatusLabel,
  };
}
