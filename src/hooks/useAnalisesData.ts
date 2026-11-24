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

export type Periodo = 3 | 6 | 12;

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

interface DemandaLinha {
  id: string;
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

function chaveBalde(d: Date, mensal: boolean) {
  return isoDia(mensal ? inicioMes(d) : inicioSemana(d));
}

function rotuloBalde(chave: string, mensal: boolean) {
  const d = new Date(chave + "T12:00:00");
  return mensal
    ? d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "")
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function gerarBaldes(inicio: Date, fim: Date, mensal: boolean) {
  const chaves: string[] = [];
  const cursor = mensal ? inicioMes(inicio) : inicioSemana(inicio);
  while (cursor <= fim) {
    chaves.push(isoDia(cursor));
    if (mensal) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 7);
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

export function useAnalisesData(periodo: Periodo) {
  const { statusList, finalSlugs, getStatusLabel } = useDemandaStatus();

  const demandasQ = useQuery({
    queryKey: ["analises-demandas"],
    queryFn: () =>
      fetchAll<DemandaLinha>((from, to) =>
        supabase.from("demandas")
          .select("id, status, created_at, updated_at, data_prazo, origem, bairro, responsavel_id, humor, areas(nome)")
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
    const demandas = demandasQ.data;
    const municipes = municipesQ.data;
    if (!demandas || statusList.length === 0) return null;

    const finais = new Set(finalSlugs);
    const ehFinal = (s: string | null) => finais.has(s || "");
    const hoje = hojeLocal();
    const hojeIso = isoDia(hoje);
    const inicio = new Date(hoje);
    inicio.setMonth(inicio.getMonth() - periodo);
    const mensal = periodo === 12;
    const nomes = new Map((pessoasQ.data ?? []).map((p) => [p.id, p.nome as string]));

    const noPeriodo = (iso: string) => new Date(iso) >= inicio;
    const entraram = demandas.filter((d) => noPeriodo(d.created_at));
    const concluidas = demandas.filter((d) => ehFinal(d.status) && noPeriodo(d.updated_at));
    const abertas = demandas.filter((d) => !ehFinal(d.status));

    // ── Entrada × conclusão por semana/mês ──
    const chaves = gerarBaldes(inicio, hoje, mensal);
    const entradaPor = new Map<string, number>();
    const conclusaoPor = new Map<string, number>();
    entraram.forEach((d) => {
      const k = chaveBalde(new Date(d.created_at), mensal);
      entradaPor.set(k, (entradaPor.get(k) || 0) + 1);
    });
    concluidas.forEach((d) => {
      const k = chaveBalde(new Date(d.updated_at), mensal);
      conclusaoPor.set(k, (conclusaoPor.get(k) || 0) + 1);
    });
    const fluxo = chaves.map((k) => ({
      chave: k,
      rotulo: rotuloBalde(k, mensal),
      entrada: entradaPor.get(k) || 0,
      conclusao: conclusaoPor.get(k) || 0,
    }));

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
        const k = chaveBalde(new Date(m.created_at), mensal);
        novosMap.set(k, (novosMap.get(k) || 0) + 1);
      });
      const telValido = municipes.filter((m) => (m.telefone || "").replace(/\D/g, "").replace(/^55/, "").length >= 10).length;
      base = {
        total: municipes.length,
        novosNoPeriodo: novos.length,
        novosPor: chaves.map((k) => ({ rotulo: rotuloBalde(k, mensal), valor: novosMap.get(k) || 0 })),
        telefone: cobertura(telValido, municipes.length),
        bairro: cobertura(municipes.filter((m) => m.bairro && m.bairro.trim()).length, municipes.length),
        nascimento: cobertura(municipes.filter((m) => m.data_nascimento).length, municipes.length),
      };
    }

    return {
      mensal,
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
      coberturaPrazo: cobertura(abertasComPrazo.length, abertas.length),
      bairros,
      coberturaBairro: cobertura(comBairro.length, entraram.length),
      equipe,
      semResponsavel,
      base,
      coberturaHumor: cobertura(demandas.filter((d) => d.humor).length, demandas.length),
    };
  }, [demandasQ.data, municipesQ.data, pessoasQ.data, statusList, finalSlugs, periodo]);

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
