import type { ReactNode } from "react";
import { CalendarClock, CalendarPlus, CheckSquare, Link2, MessageSquare, User } from "lucide-react";
import type { KanbanBoardCard } from "@/hooks/useKanbanBoards";
import type { DemandaNoCartao } from "@/hooks/useQuadros";
import { paraTexto } from "@/components/ui/EditorRico";
import { Avatar } from "./CartaoProjetoDrawer";
import { cn } from "@/lib/utils";

/**
 * Cartão de um quadro. Quando tem demanda vinculada, mostra o essencial dela
 * sem precisar abrir: descrição, área, munícipe, quando entrou, responsável
 * e o PRAZO — o prazo já cadastrado na demanda vale para o cartão se ele não
 * tiver um próprio (ninguém precisa digitar de novo).
 *  - detalhado: tudo isso
 *  - compacto: título, protocolo, prazo e pessoas (para quadros cheios)
 */

const hojeISO = () => new Date().toISOString().slice(0, 10);
const diasAte = (iso: string) =>
  Math.round((new Date(iso + "T12:00:00").getTime() - new Date(hojeISO() + "T12:00:00").getTime()) / 86400000);
const dataCurta = (iso: string, ano = false) =>
  new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", ...(ano ? { year: "2-digit" } : {}) }).replace(".", "");
const primeiroESobrenome = (nome?: string | null) => {
  const p = (nome || "").trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || "";
};

export interface PrazoCartao { data: string; daDemanda?: DemandaNoCartao }

/** Prazo do cartão: o dele; se não tiver, o mais próximo das demandas em aberto vinculadas. */
export function prazoDoCartao(c: KanbanBoardCard, dems: DemandaNoCartao[], statusFinais: Set<string>): PrazoCartao | null {
  if (c.data_prazo) return { data: c.data_prazo };
  const daDemanda = dems
    .filter((d) => d.data_prazo && !statusFinais.has(d.status || ""))
    .sort((a, b) => String(a.data_prazo).localeCompare(String(b.data_prazo)))[0];
  return daDemanda ? { data: daDemanda.data_prazo!, daDemanda } : null;
}

export function SeloPrazo({ prazo, concluido, className }: { prazo: PrazoCartao; concluido: boolean; className?: string }) {
  const d = diasAte(prazo.data);
  const origem = prazo.daDemanda ? ` (prazo da demanda #${prazo.daDemanda.protocolo})` : "";
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] tabular-nums";
  if (!concluido && d < 0) {
    return <span className={cn(base, "bg-destructive/10 text-destructive font-semibold", className)} title={`Venceu em ${dataCurta(prazo.data, true)}${origem}`}>
      <CalendarClock className="h-3 w-3" /> Atrasado {-d}d
    </span>;
  }
  if (!concluido && d <= 2) {
    return <span className={cn(base, "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold", className)} title={`Prazo: ${dataCurta(prazo.data, true)}${origem}`}>
      <CalendarClock className="h-3 w-3" /> {d === 0 ? "Vence hoje" : d === 1 ? "Vence amanhã" : `Vence em ${d}d`}
    </span>;
  }
  return <span className={cn(base, "bg-muted text-muted-foreground", className)} title={`Prazo${origem}`}>
    <CalendarClock className="h-3 w-3" /> {dataCurta(prazo.data, new Date(prazo.data).getFullYear() !== new Date().getFullYear())}
  </span>;
}

export function CartaoDoQuadro({
  c, dems, prazo, concluido, pessoas, nomeDe, contagens, menu, detalhado,
}: {
  c: KanbanBoardCard;
  dems: DemandaNoCartao[];
  prazo: PrazoCartao | null;
  /** Está numa etapa final (concluído): prazo não conta como atraso */
  concluido: boolean;
  /** Responsável primeiro, depois colaboradores */
  pessoas: string[];
  nomeDe: (id: string) => string | undefined;
  contagens?: { checklist?: { done: number; total: number }; comentarios?: number };
  menu?: ReactNode;
  detalhado: boolean;
}) {
  const dem = dems[0];
  const descricao = detalhado ? (paraTexto(c.descricao) || dem?.descricao || "").trim() : "";
  // Responsável: o do cartão; sem ele, o da demanda
  const responsavel = pessoas[0] || dem?.responsavel_id || null;
  const outros = (pessoas[0] ? pessoas.slice(1) : pessoas).filter((p) => p !== responsavel);
  const check = contagens?.checklist;

  return (
    <>
      {c.cor && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r" style={{ background: c.cor }} aria-hidden />}
      <div className="pl-1.5 space-y-1.5">
        <div className="flex items-start gap-1">
          <h3 className="text-[13px] font-medium leading-snug flex-1 min-w-0 [overflow-wrap:anywhere]">{c.titulo}</h3>
          {menu}
        </div>

        {dems.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {dems.slice(0, 2).map((d) => (
              <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10.5px] font-medium px-2 py-0.5"><Link2 className="h-3 w-3" />#{d.protocolo}</span>
            ))}
            {dems.length > 2 && <span className="rounded-full bg-muted text-[10.5px] px-2 py-0.5">+{dems.length - 2}</span>}
            {detalhado && dem?.area && <span className="inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10.5px] text-muted-foreground"><span className="truncate">{dem.area}</span></span>}
          </div>
        )}

        {descricao && <p className="text-[12px] leading-snug text-muted-foreground line-clamp-2 [overflow-wrap:anywhere]">{descricao}</p>}

        {detalhado && dem && (dem.municipe || dem.created_at) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {dem.municipe && <span className="inline-flex min-w-0 max-w-full items-center gap-1"><User className="h-3 w-3 shrink-0" /><span className="truncate">{dem.municipe}</span></span>}
            {dem.created_at && <span className="inline-flex items-center gap-1" title="Quando a demanda entrou"><CalendarPlus className="h-3 w-3" />{dataCurta(dem.created_at, true)}</span>}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
            {prazo && <SeloPrazo prazo={prazo} concluido={concluido} />}
            {check && check.total > 0 && <span className={cn("flex items-center gap-0.5", check.done === check.total && "text-emerald-600 dark:text-emerald-400")}><CheckSquare className="h-3 w-3" />{check.done}/{check.total}</span>}
            {(contagens?.comentarios ?? 0) > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{contagens!.comentarios}</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {outros.length > 0 && <div className="flex -space-x-1.5">{outros.slice(0, 3).map((pid) => <Avatar key={pid} id={pid} nome={nomeDe(pid)} size={20} />)}</div>}
            {responsavel && (
              <span className="flex items-center gap-1" title={`Responsável: ${nomeDe(responsavel) || ""}`}>
                <Avatar id={responsavel} nome={nomeDe(responsavel)} size={22} />
                {detalhado && <span className="max-w-[6.5rem] truncate text-[11px] text-muted-foreground">{primeiroESobrenome(nomeDe(responsavel))}</span>}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
