import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Download, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { DemandaLinha, FiltrosAnalise } from "@/hooks/useAnalisesData";

/**
 * Peças da tela Análises: período livre (de/até), filtros de área e
 * responsável, exportação, funil das demandas recebidas e a tabela por área.
 */

const num = (x: number) => x.toLocaleString("pt-BR");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const isoLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const isoHoje = () => isoLocal(new Date());
const br = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

// ─── Período personalizado ─────────────────────────────────────

export function PeriodoPersonalizado({ ativo, de, ate, onAplicar }: {
  ativo: boolean; de?: string; ate?: string; onAplicar: (de: string, ate: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const hoje = isoHoje();
  const [ini, setIni] = useState(de || "");
  const [fim, setFim] = useState(ate || hoje);
  const valido = !!ini && !!fim && ini <= fim;
  // Atalhos comuns para relatório
  const atalhos: [string, () => [string, string]][] = [
    ["Últimos 7 dias", () => { const d = new Date(); d.setDate(d.getDate() - 6); return [isoLocal(d), hoje]; }],
    ["Últimos 30 dias", () => { const d = new Date(); d.setDate(d.getDate() - 29); return [isoLocal(d), hoje]; }],
    ["Mês passado", () => { const n = new Date(); return [isoLocal(new Date(n.getFullYear(), n.getMonth() - 1, 1)), isoLocal(new Date(n.getFullYear(), n.getMonth(), 0))]; }],
    ["Este ano", () => [`${new Date().getFullYear()}-01-01`, hoje]],
  ];
  return (
    <Popover open={aberto} onOpenChange={(v) => { setAberto(v); if (v) { setIni(de || ""); setFim(ate || hoje); } }}>
      <PopoverTrigger asChild>
        <button type="button" role="radio" aria-checked={ativo}
          className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md transition-colors",
            ativo ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>
          <CalendarRange className="h-3.5 w-3.5" />
          {ativo && de && ate ? `${br(de)} – ${br(ate)}` : "Personalizado"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-3">
        <p className="text-sm font-medium">Escolha o período</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">De
            <Input type="date" value={ini} max={fim || hoje} onChange={(e) => setIni(e.target.value)} className="h-9 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Até
            <Input type="date" value={fim} min={ini || undefined} max={hoje} onChange={(e) => setFim(e.target.value)} className="h-9 text-sm text-foreground" />
          </label>
        </div>
        <div className="flex flex-wrap gap-1">
          {atalhos.map(([r, f]) => (
            <button key={r} type="button" onClick={() => { const [a, b] = f(); setIni(a); setFim(b); }}
              className="rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">{r}</button>
          ))}
        </div>
        {ini && fim && ini > fim && <p className="text-xs text-destructive">O início precisa ser antes do fim.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button size="sm" disabled={!valido} onClick={() => { onAplicar(ini, fim); setAberto(false); }}>Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Filtros (área e responsável) + exportar ───────────────────

export function FiltrosAnalises({ filtros, onMudar, pessoas, onExportar, podeExportar, acoes }: {
  filtros: FiltrosAnalise;
  onMudar: (f: FiltrosAnalise) => void;
  pessoas: { id: string; nome: string }[];
  onExportar: () => void;
  podeExportar: boolean;
  /** Botões extras à direita (ex.: Relatório) */
  acoes?: ReactNode;
}) {
  const areas = useQuery({
    queryKey: ["analises-areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60_000,
  });
  const ativos = (filtros.areaId ? 1 : 0) + (filtros.responsavelId ? 1 : 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filtrar</span>
      <Select value={filtros.areaId || "todas"} onValueChange={(v) => onMudar({ ...filtros, areaId: v === "todas" ? null : v })}>
        <SelectTrigger className={cn("h-8 w-auto min-w-[150px] max-w-[220px] text-xs", filtros.areaId && "ring-1 ring-primary/40 font-medium")} aria-label="Área">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as áreas</SelectItem>
          {(areas.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
          <SelectItem value="sem">Sem área</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filtros.responsavelId || "todos"} onValueChange={(v) => onMudar({ ...filtros, responsavelId: v === "todos" ? null : v })}>
        <SelectTrigger className={cn("h-8 w-auto min-w-[160px] max-w-[220px] text-xs", filtros.responsavelId && "ring-1 ring-primary/40 font-medium")} aria-label="Responsável">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os responsáveis</SelectItem>
          {pessoas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          <SelectItem value="sem">Sem responsável</SelectItem>
        </SelectContent>
      </Select>
      {ativos > 0 && (
        <button type="button" onClick={() => onMudar({})} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" /> Limpar filtros
        </button>
      )}
      <span className="flex-1" />
      {acoes}
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onExportar} disabled={!podeExportar}>
        <Download className="h-3.5 w-3.5" /> Exportar planilha
      </Button>
    </div>
  );
}

/** Planilha (CSV, abre no Excel) com as demandas que entraram no período. */
export function exportarCsv(lista: DemandaLinha[], opcoes: {
  nomeStatus: (s: string | null) => string; ehFinal: (s: string | null) => boolean; nomePessoa: (id: string | null) => string; rotulo: string;
}) {
  const hoje = isoHoje();
  const linhas = [
    ["Protocolo", "Título", "Status", "Situação", "Área", "Bairro", "Responsável", "Prioridade", "Entrou em", "Prazo"],
    ...lista.map((d) => [
      d.protocolo, d.titulo, opcoes.nomeStatus(d.status),
      opcoes.ehFinal(d.status) ? "Concluída" : d.data_prazo && d.data_prazo < hoje ? "Atrasada" : "Em aberto",
      d.areas?.nome || "", d.bairro || "", opcoes.nomePessoa(d.responsavel_id), d.prioridade || "",
      new Date(d.created_at).toLocaleDateString("pt-BR"), d.data_prazo ? br(d.data_prazo) : "",
    ]),
  ];
  const csv = "﻿" + linhas.map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `demandas-${opcoes.rotulo.replace(/[^\p{L}\d]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "periodo"}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Funil das demandas recebidas ──────────────────────────────

/**
 * Onde estão hoje as demandas que entraram no período. A largura de cada
 * faixa é proporcional à quantidade (com um mínimo para caber o texto).
 */
export function FunilRecebidas({ total, itens }: {
  total: number;
  itens: { slug: string; nome: string; cor: string; final: boolean; valor: number }[];
}) {
  if (total === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma demanda entrou neste período.</p>;
  return (
    <div className="space-y-1.5" role="list" aria-label="Demandas recebidas por status">
      <div className="flex items-center gap-3" role="listitem">
        <span className="w-32 shrink-0 truncate text-right text-xs font-semibold sm:w-40">Recebidas</span>
        <div className="flex-1">
          <div className="flex h-8 items-center rounded-md bg-primary px-2.5 text-sm font-bold tabular-nums text-primary-foreground">{num(total)}</div>
        </div>
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">100%</span>
      </div>
      {itens.map((s) => {
        const fr = s.valor / total;
        return (
          <div key={s.slug} className={cn("flex items-center gap-3", s.valor === 0 && "opacity-50")} role="listitem">
            <span className="w-32 shrink-0 truncate text-right text-xs sm:w-40" title={s.nome}>
              {s.nome}{s.final && <span className="ml-1 text-emerald-600 dark:text-emerald-400" aria-label="conta como concluído">✓</span>}
            </span>
            <div className="flex-1">
              <div className="flex h-7 items-center rounded-md px-2 text-xs font-semibold tabular-nums text-white"
                style={{ width: `max(${Math.max(fr * 100, 0)}%, 2.25rem)`, background: s.cor }}>
                {num(s.valor)}
              </div>
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{pct(fr)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Barras simples (alinhadas à esquerda, para colunas estreitas) ─

export function ListaBarras({ itens, total }: { itens: { nome: string; valor: number }[]; total: number }) {
  if (itens.length === 0) return <p className="py-3 text-sm text-muted-foreground">Nada para mostrar.</p>;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <ul className="space-y-1.5">
      {itens.map((i) => (
        <li key={i.nome} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
          <span className="truncate" title={i.nome}>{i.nome}</span>
          <span className="h-2.5 rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${(i.valor / max) * 100}%`, minWidth: i.valor ? 4 : 0, background: "var(--viz-seq)" }} />
          </span>
          <span className="w-[4.5rem] text-right tabular-nums"><strong>{num(i.valor)}</strong> <span className="text-muted-foreground">{total ? pct(i.valor / total) : ""}</span></span>
        </li>
      ))}
    </ul>
  );
}

// ─── Tabela por área ───────────────────────────────────────────

export function TabelaAreas({ linhas, onEscolher, areaFiltrada }: {
  linhas: { id: string; nome: string; recebidas: number; concluidas: number; abertas: number; atrasadas: number }[];
  onEscolher: (id: string) => void;
  areaFiltrada?: string | null;
}) {
  const [todas, setTodas] = useState(false);
  if (linhas.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma demanda entrou neste período.</p>;
  const max = Math.max(...linhas.map((l) => l.recebidas), 1);
  const visiveis = todas ? linhas : linhas.slice(0, 10);
  return (
    <div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-2 py-2 text-left font-medium">Área</th>
              <th className="px-2 py-2 text-left font-medium w-[34%]">Recebidas</th>
              <th className="px-2 py-2 text-right font-medium"><span className="sm:hidden">Concl.</span><span className="hidden sm:inline">Concluídas</span></th>
              <th className="px-2 py-2 text-right font-medium hidden sm:table-cell">Em aberto</th>
              <th className="px-2 py-2 text-right font-medium"><span className="sm:hidden">Atraso</span><span className="hidden sm:inline">Atrasadas</span></th>
              <th className="px-2 py-2 text-right font-medium hidden md:table-cell">% concluída</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.id} className={cn("border-b last:border-0", areaFiltrada === l.id && "bg-primary/5")}>
                <td className="px-2 py-2 max-w-[8rem] sm:max-w-[14rem]">
                  <button type="button" onClick={() => onEscolher(l.id)} className="block max-w-full truncate text-left hover:text-primary hover:underline" title={`Filtrar a tela por ${l.nome}`}>
                    {l.nome}
                  </button>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full" style={{ width: `${(l.recebidas / max) * 100}%`, minWidth: 4, background: "var(--viz-seq)" }} />
                    <span className="text-xs tabular-nums">{num(l.recebidas)}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{num(l.concluidas)}</td>
                <td className="px-2 py-2 text-right tabular-nums hidden sm:table-cell">{num(l.abertas)}</td>
                <td className={cn("px-2 py-2 text-right tabular-nums", l.atrasadas > 0 ? "text-destructive font-medium" : "text-muted-foreground")}>{num(l.atrasadas)}</td>
                <td className="px-2 py-2 text-right tabular-nums hidden md:table-cell">{pct(l.concluidas / l.recebidas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhas.length > 10 && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground">
          {todas ? "Mostrar só as 10 maiores" : `Ver todas as ${linhas.length} áreas`}
        </button>
      )}
    </div>
  );
}
