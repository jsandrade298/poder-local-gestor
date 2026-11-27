import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetchAll";
import { normalizarBusca } from "@/lib/busca";

/**
 * Receita de um widget da Oficina do Jotinha. É só uma DESCRIÇÃO (visual +
 * filtros); quem busca os números é o próprio app, com o login de quem vê —
 * a IA não roda na hora de mostrar e nenhum código gerado é executado.
 */

export interface ReceitaWidget {
  versao: 1;
  titulo: string;
  visual: "numero" | "barras" | "lista" | "linha";
  filtros: {
    situacao?: "abertas" | "concluidas" | "atrasadas" | "sem_responsavel" | "todas";
    status?: string[]; areas?: string[]; bairro?: string; responsavel?: string;
    prioridade?: "urgente" | "alta" | "media" | "baixa"; texto?: string;
  };
  periodo?: { tipo: "dias" | "vence"; n: number } | { tipo: "semana" | "mes" | "ano" };
  agrupar?: "area" | "bairro" | "status" | "responsavel" | "prioridade" | "dia" | "semana" | "mes";
  limite: number;
  meta?: number;
  cor: "primaria" | "verde" | "amarelo" | "vermelho";
  explicacao?: string;
}

export interface Referencias {
  uid: string;
  status: { slug: string; nome: string; is_final: boolean; cor?: string }[];
  areas: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
}

export type ResultadoWidget =
  | { visual: "numero"; total: number; meta?: number }
  | { visual: "barras"; itens: { nome: string; valor: number }[]; total: number }
  | { visual: "linha"; pontos: { rotulo: string; valor: number }[]; total: number }
  | { visual: "lista"; itens: { id: string; protocolo: string; titulo: string; prazo: string | null; status: string }[]; total: number };

const isoLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const parecido = (a: string, b: string) => { const x = normalizarBusca(a).trim(), y = normalizarBusca(b).trim(); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
const NADA = "00000000-0000-0000-0000-000000000000";

/** Início do período da receita (pela data de entrada) ou faixa de prazo ("vence"). */
export function janela(r: ReceitaWidget): { de?: string; ate?: string; venceAte?: string } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const p = r.periodo;
  if (!p) return {};
  if (p.tipo === "dias") { const d = new Date(hoje); d.setDate(d.getDate() - (p.n - 1)); return { de: isoLocal(d) }; }
  if (p.tipo === "vence") { const d = new Date(hoje); d.setDate(d.getDate() + p.n); return { venceAte: isoLocal(d) }; }
  if (p.tipo === "semana") { const d = new Date(hoje); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { de: isoLocal(d) }; }
  if (p.tipo === "mes") return { de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)) };
  return { de: `${hoje.getFullYear()}-01-01` };
}

export function descreverPeriodo(r: ReceitaWidget) {
  const p = r.periodo;
  if (!p) return "desde o início";
  if (p.tipo === "dias") return p.n === 1 ? "hoje" : `últimos ${p.n} dias`;
  if (p.tipo === "vence") return `prazo nos próximos ${p.n} dias`;
  return p.tipo === "semana" ? "nesta semana" : p.tipo === "mes" ? "neste mês" : "neste ano";
}

function aplicar(q: any, r: ReceitaWidget, ref: Referencias) {
  const f = r.filtros || {};
  const hoje = isoLocal(new Date());
  const finais = ref.status.filter((s) => s.is_final).map((s) => s.slug);
  const lista = (xs: string[]) => `(${xs.map((x) => `"${x.replace(/"/g, "")}"`).join(",")})`;
  const sit = f.situacao || "todas";
  if (sit === "abertas" && finais.length) q = q.not("status", "in", lista(finais));
  if (sit === "concluidas") q = q.in("status", finais.length ? finais : ["__nenhum__"]);
  if (sit === "atrasadas") { q = q.lt("data_prazo", hoje).not("data_prazo", "is", null); if (finais.length) q = q.not("status", "in", lista(finais)); }
  if (sit === "sem_responsavel") { q = q.is("responsavel_id", null); if (finais.length) q = q.not("status", "in", lista(finais)); }
  if (f.status?.length) {
    const slugs = ref.status.filter((s) => f.status!.some((x) => parecido(s.nome, x) || parecido(s.slug, x))).map((s) => s.slug);
    q = q.in("status", slugs.length ? slugs : ["__nenhum__"]);
  }
  if (f.areas?.length) {
    if (f.areas.some((a) => /^sem/.test(normalizarBusca(a)))) q = q.is("area_id", null);
    else { const ids = ref.areas.filter((a) => f.areas!.some((x) => parecido(a.nome, x))).map((a) => a.id); q = q.in("area_id", ids.length ? ids : [NADA]); }
  }
  if (f.bairro) q = q.ilike("bairro", `%${f.bairro.replace(/[%_,()]/g, " ").trim()}%`);
  if (f.responsavel) {
    const n = normalizarBusca(f.responsavel);
    if (/^(ninguem|sem)/.test(n)) q = q.is("responsavel_id", null);
    else {
      const id = ["eu", "mim", "minhas", "meus"].includes(n) ? ref.uid : ref.pessoas.find((p) => parecido(p.nome, f.responsavel!))?.id;
      q = q.eq("responsavel_id", id ?? NADA);
    }
  }
  if (f.prioridade) q = q.eq("prioridade", f.prioridade);
  if (f.texto) for (const p of normalizarBusca(f.texto).replace(/[%_,()"\\]/g, " ").split(/\s+/).filter(Boolean)) q = q.ilike("busca", `%${p}%`);
  const j = janela(r);
  if (j.de) q = q.gte("created_at", `${j.de}T00:00:00`);
  if (j.venceAte) q = q.gte("data_prazo", hoje).lte("data_prazo", j.venceAte);
  return q;
}

const COLUNA: Record<string, string> = { area: "area_id", bairro: "bairro", status: "status", responsavel: "responsavel_id", prioridade: "prioridade" };
const PRIORIDADE: Record<string, string> = { urgente: "Urgente", alta: "Alta", media: "Média", baixa: "Baixa" };

export async function executarReceita(r: ReceitaWidget, ref: Referencias): Promise<ResultadoWidget> {
  if (r.visual === "numero") {
    const { count, error } = await aplicar(supabase.from("demandas").select("id", { count: "exact", head: true }), r, ref);
    if (error) throw error;
    return { visual: "numero", total: count ?? 0, meta: r.meta };
  }
  if (r.visual === "lista") {
    let q = aplicar(supabase.from("demandas").select("id, protocolo, titulo, data_prazo, status", { count: "exact" }), r, ref);
    q = r.filtros?.situacao === "atrasadas" || r.periodo?.tipo === "vence" ? q.order("data_prazo", { ascending: true }) : q.order("created_at", { ascending: false });
    const { data, count, error } = await q.limit(r.limite || 5);
    if (error) throw error;
    return {
      visual: "lista", total: count ?? 0,
      itens: (data ?? []).map((d: any) => ({ id: d.id, protocolo: d.protocolo, titulo: d.titulo, prazo: d.data_prazo, status: ref.status.find((s) => s.slug === d.status)?.nome || d.status })),
    };
  }
  if (r.visual === "barras") {
    const col = COLUNA[r.agrupar || "area"] || "area_id";
    const linhas = await fetchAll<any>((de, ate) => aplicar(supabase.from("demandas").select(`id, ${col}`).order("id"), r, ref).range(de, ate));
    const grupos = new Map<string, number>();
    linhas.forEach((l) => {
      const v = l[col];
      const nome = r.agrupar === "status" ? ref.status.find((s) => s.slug === v)?.nome || v || "–"
        : r.agrupar === "responsavel" ? (v ? ref.pessoas.find((p) => p.id === v)?.nome || "Pessoa" : "Sem responsável")
        : r.agrupar === "prioridade" ? PRIORIDADE[v] || "Sem prioridade"
        : r.agrupar === "bairro" ? (v ? String(v).trim() : "Sem bairro")
        : v ? ref.areas.find((a) => a.id === v)?.nome || "–" : "Sem área";
      grupos.set(nome, (grupos.get(nome) || 0) + 1);
    });
    return { visual: "barras", total: linhas.length, itens: [...grupos.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, r.limite || 8) };
  }
  // linha: entradas por dia/semana/mês dentro do período (padrão: 30 dias / 12 semanas / 12 meses)
  const escala = (r.agrupar === "dia" || r.agrupar === "mes" ? r.agrupar : "semana") as "dia" | "semana" | "mes";
  const rr: ReceitaWidget = r.periodo ? r : { ...r, periodo: { tipo: "dias", n: escala === "dia" ? 30 : escala === "semana" ? 84 : 365 } };
  const linhas = await fetchAll<any>((de, ate) => aplicar(supabase.from("demandas").select("id, created_at").order("id"), rr, ref).range(de, ate));
  const chave = (iso: string) => {
    const d = new Date(iso); d.setHours(0, 0, 0, 0);
    if (escala === "semana") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    if (escala === "mes") d.setDate(1);
    return isoLocal(d);
  };
  const mapa = new Map<string, number>();
  linhas.forEach((l) => mapa.set(chave(l.created_at), (mapa.get(chave(l.created_at)) || 0) + 1));
  // eixo completo, sem buracos
  const pontos: { rotulo: string; valor: number }[] = [];
  const ini = new Date(`${janela(rr).de}T12:00:00`);
  const cursor = new Date(chave(ini.toISOString()) + "T12:00:00");
  const fim = new Date();
  while (cursor <= fim && pontos.length < 400) {
    const k = isoLocal(cursor);
    const d = new Date(k + "T12:00:00");
    pontos.push({ rotulo: escala === "mes" ? d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), valor: mapa.get(k) || 0 });
    if (escala === "mes") cursor.setMonth(cursor.getMonth() + 1); else cursor.setDate(cursor.getDate() + (escala === "semana" ? 7 : 1));
  }
  return { visual: "linha", pontos, total: linhas.length };
}

/** Link para ver na tela Demandas o que o widget conta (quando os filtros cabem lá). */
export function linkDemandas(r: ReceitaWidget, ref: Referencias) {
  const p = new URLSearchParams();
  const f = r.filtros || {};
  if (f.situacao === "atrasadas") p.set("atraso", "overdue");
  if (f.situacao === "sem_responsavel") p.set("situacao", "sem-responsavel");
  ref.status.filter((s) => f.status?.some((x) => parecido(s.nome, x))).forEach((s) => p.append("status", s.slug));
  ref.areas.filter((a) => f.areas?.some((x) => parecido(a.nome, x))).forEach((a) => p.append("area", a.id));
  if (f.responsavel && ["eu", "mim"].includes(normalizarBusca(f.responsavel))) p.append("responsavel", ref.uid);
  const j = janela(r);
  if (j.de) p.set("de", j.de);
  if (f.texto) p.set("q", f.texto);
  return `/demandas${p.toString() ? `?${p}` : ""}`;
}
