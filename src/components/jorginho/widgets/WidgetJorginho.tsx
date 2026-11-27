import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { usePessoasGabinete } from "@/hooks/useQuadros";
import { descreverPeriodo, executarReceita, linkDemandas, type ReceitaWidget, type Referencias } from "./receita";
import { JorginhoAvatar } from "../JorginhoAvatar";
import { cn } from "@/lib/utils";

const COR: Record<ReceitaWidget["cor"], string> = {
  primaria: "hsl(var(--primary))", verde: "#10B981", amarelo: "#EAB308", vermelho: "#DC2626",
};
const num = (x: number) => x.toLocaleString("pt-BR");

/** Status, áreas e pessoas do gabinete — o que a receita precisa para virar consulta. */
export function useReferencias(): Referencias | null {
  const { user } = useAuth();
  const { statusList } = useDemandaStatus();
  const { pessoas } = usePessoasGabinete();
  const areas = useQuery({
    queryKey: ["areas-referencia-widgets"],
    queryFn: async () => { const { data, error } = await supabase.from("areas").select("id, nome").order("nome"); if (error) throw error; return data ?? []; },
    staleTime: 10 * 60_000,
  });
  return useMemo(() => (user && statusList.length && areas.data ? {
    uid: user.id, status: statusList as any, areas: areas.data, pessoas: pessoas.map((p) => ({ id: p.id, nome: p.nome })),
  } : null), [user, statusList, areas.data, pessoas]);
}

export function ConteudoWidget({ receita, compacto }: { receita: ReceitaWidget; compacto?: boolean }) {
  const ref = useReferencias();
  const q = useQuery({
    queryKey: ["widget-jorginho", JSON.stringify(receita)],
    enabled: !!ref,
    queryFn: () => executarReceita(receita, ref!),
    staleTime: 2 * 60_000,
  });
  const cor = COR[receita.cor] || COR.primaria;
  if (!ref || q.isLoading) return <Skeleton className={compacto ? "h-16" : "h-24"} />;
  if (q.isError) return <p className="text-sm text-muted-foreground">Não consegui buscar os números agora.</p>;
  const r = q.data!;

  if (r.visual === "numero") {
    const fr = r.meta ? Math.min(1, r.total / r.meta) : null;
    return (
      <div>
        <p className="titulo-compacto text-4xl font-extrabold tabular-nums leading-none" style={{ color: cor }}>{num(r.total)}</p>
        {r.meta ? (
          <div className="mt-2">
            <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full transition-all" style={{ width: `${(fr || 0) * 100}%`, background: cor }} /></div>
            <p className="mt-1 text-[11px] text-muted-foreground">{r.total >= r.meta ? "Meta batida! 🎉" : `faltam ${num(r.meta - r.total)} para a meta de ${num(r.meta)}`}</p>
          </div>
        ) : null}
      </div>
    );
  }
  if (r.visual === "barras") {
    const max = Math.max(1, ...r.itens.map((i) => i.valor));
    if (!r.itens.length) return <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>;
    return (
      <ul className="space-y-1.5">
        {r.itens.map((i) => (
          <li key={i.nome} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs">
            <span className="truncate" title={i.nome}>{i.nome}</span>
            <span className="h-2.5 rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(i.valor / max) * 100}%`, minWidth: 4, background: cor }} /></span>
            <span className="w-8 text-right font-semibold tabular-nums">{num(i.valor)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (r.visual === "linha") {
    const max = Math.max(1, ...r.pontos.map((p) => p.valor));
    const W = 300, H = 80;
    const x = (i: number) => (r.pontos.length <= 1 ? 0 : (i / (r.pontos.length - 1)) * W);
    const y = (v: number) => H - (v / max) * (H - 6) - 3;
    const d = r.pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
    return (
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" preserveAspectRatio="none" role="img" aria-label={`${receita.titulo}: ${r.pontos.map((p) => `${p.rotulo} ${p.valor}`).join(", ")}`}>
          <path d={`${d} L${W},${H} L0,${H} Z`} fill={cor} opacity=".12" />
          <path d={d} fill="none" stroke={cor} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{r.pontos[0]?.rotulo}</span><span>{num(r.total)} no total</span><span>{r.pontos[r.pontos.length - 1]?.rotulo}</span>
        </div>
      </div>
    );
  }
  if (!r.itens.length) return <p className="text-sm text-muted-foreground">Nenhuma demanda com esses filtros. 🎉</p>;
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <ul className="divide-y text-sm">
      {r.itens.map((i) => (
        <li key={i.id}>
          <Link to={`/demandas?protocolo=${encodeURIComponent(i.protocolo)}`} className="flex items-center gap-2 py-1.5 hover:text-primary">
            <span className="min-w-0 flex-1 truncate">{i.titulo}</span>
            {i.prazo && <span className={cn("shrink-0 text-[11px] tabular-nums", i.prazo < hoje ? "text-destructive" : "text-muted-foreground")}>{new Date(i.prazo + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
          </Link>
        </li>
      ))}
      {r.total > r.itens.length && <li className="pt-1.5 text-[11px] text-muted-foreground">e mais {num(r.total - r.itens.length)}</li>}
    </ul>
  );
}

/** Widget no Início: cabeçalho com título, período e menu (editar, compartilhar, remover). */
export function CartaoWidget({ widget, meu, onEditar, onRemover, onCompartilhar }: {
  widget: { id: string; titulo: string; spec: ReceitaWidget; compartilhado: boolean; dono_id: string };
  meu: boolean;
  onEditar: () => void; onRemover: () => void; onCompartilhar: () => void;
}) {
  const ref = useReferencias();
  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-start gap-2 space-y-0 pb-2">
        <JorginhoAvatar className="h-9 w-8 shrink-0" expressao="ideia" parado />
        <div className="min-w-0 flex-1">
          <p className="titulo-compacto truncate text-sm font-semibold" title={widget.titulo}>{widget.titulo}</p>
          <p className="text-[11px] text-muted-foreground">{descreverPeriodo(widget.spec)}{widget.compartilhado ? " · compartilhado com a equipe" : ""}</p>
        </div>
        {ref && widget.spec.visual !== "lista" && (
          <Button asChild variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Ver em Demandas"><Link to={linkDemandas(widget.spec, ref)}><ChevronRight className="h-4 w-4" /></Link></Button>
        )}
        {meu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Opções do widget"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEditar}><Pencil className="mr-2 h-4 w-4" /> Ajustar com o Jotinha</DropdownMenuItem>
              <DropdownMenuItem onSelect={onCompartilhar}><Share2 className="mr-2 h-4 w-4" /> {widget.compartilhado ? "Deixar só para mim" : "Compartilhar com a equipe"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onRemover}><Trash2 className="mr-2 h-4 w-4" /> Remover do Início</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="pt-0"><ConteudoWidget receita={widget.spec} /></CardContent>
    </Card>
  );
}
