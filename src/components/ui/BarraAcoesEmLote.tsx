import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Peças comuns das ações em lote (Demandas, Munícipes…), para todas as telas
 * terem o mesmo jeito:
 *  - LinhaSelecaoLote: "Selecionar esta página" e "Selecionar todos os N deste filtro"
 *  - BarraAcoesEmLote: barra fixa embaixo, centralizada (acima da barra
 *    inferior no celular), com o total selecionado, as ações e o limpar.
 */

export const classeBotaoLote = "h-8 gap-1.5";

export function BarraAcoesEmLote({
  total, singular, plural, onLimpar, children,
}: {
  total: number;
  /** "selecionada" / "selecionado" */
  singular: string;
  plural: string;
  onLimpar: () => void;
  children: ReactNode;
}) {
  if (total === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-[4.5rem] md:bottom-4 z-40 flex justify-center px-3 pointer-events-none">
      <div role="toolbar" aria-label="Ações nos itens selecionados"
        className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border bg-card/95 backdrop-blur-md shadow-forte px-3 py-2 max-w-full">
        <span className="text-sm font-semibold tabular-nums pr-1">{total.toLocaleString("pt-BR")} {total === 1 ? singular : plural}</span>
        {children}
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onLimpar} aria-label="Limpar seleção" title="Limpar seleção">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function LinhaSelecaoLote({
  paginaToda, onAlternarPagina, naPagina, totalFiltro, selecionados, onSelecionarTodos, selecionandoTodos,
  rotuloPagina = "Selecionar esta página", nomePlural, todosOuTodas = "todos", singularSel, pluralSel,
}: {
  paginaToda: boolean;
  onAlternarPagina: () => void;
  naPagina: number;
  totalFiltro: number;
  selecionados: number;
  onSelecionarTodos: () => void;
  selecionandoTodos: boolean;
  rotuloPagina?: string;
  /** "demandas" / "munícipes" */
  nomePlural: string;
  todosOuTodas?: "todos" | "todas";
  singularSel: string;
  pluralSel: string;
}) {
  if (naPagina === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm">
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox checked={paginaToda} onCheckedChange={onAlternarPagina} aria-label={rotuloPagina} className="h-5 w-5" />
        <span className="text-muted-foreground">{rotuloPagina}</span>
      </label>
      {paginaToda && totalFiltro > naPagina && selecionados < totalFiltro && (
        <Button variant="link" size="sm" className="h-auto p-0" disabled={selecionandoTodos} onClick={onSelecionarTodos}>
          {selecionandoTodos ? "Selecionando…" : `Selecionar ${todosOuTodas} ${todosOuTodas === "todas" ? "as" : "os"} ${totalFiltro.toLocaleString("pt-BR")} ${nomePlural} deste filtro`}
        </Button>
      )}
      {selecionados > 0 && (
        <span className="text-muted-foreground">· {selecionados.toLocaleString("pt-BR")} {selecionados === 1 ? singularSel : pluralSel}</span>
      )}
    </div>
  );
}
