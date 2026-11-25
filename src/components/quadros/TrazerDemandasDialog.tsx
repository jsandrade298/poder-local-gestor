import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Filter, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { usePessoasGabinete } from "@/hooks/useQuadros";
import { aplicarBusca } from "@/lib/busca";
import { SeloPrazo } from "./CartaoDoQuadro";
import { cn } from "@/lib/utils";

/**
 * Trazer demandas para um quadro. Em vez de ter de lembrar o que procurar,
 * a pessoa VÊ as demandas (abertas, por padrão) e vai filtrando: texto livre
 * (título, protocolo, munícipe, descrição, endereço), status, área,
 * responsável, munícipe e prazo. Escolhe várias de uma vez e a etapa.
 */

export interface DemandaParaQuadro {
  id: string; protocolo: string; titulo: string; descricao: string | null; status: string | null;
  data_prazo: string | null; created_at: string | null; responsavel_id: string | null; bairro: string | null;
  areas: { nome: string } | null; municipes: { nome: string } | null;
}

type Prazo = "todos" | "atrasadas" | "semana" | "mes" | "sem";
type Ordem = "recentes" | "prazo" | "antigas";
const POR_PAGINA = 30;
const ROTULO_PRAZO: Record<Prazo, string> = { todos: "Qualquer prazo", atrasadas: "Atrasadas", semana: "Vencem em 7 dias", mes: "Vencem este mês", sem: "Sem prazo" };
const ROTULO_ORDEM: Record<Ordem, string> = { recentes: "Mais recentes", prazo: "Prazo mais próximo", antigas: "Mais antigas" };

const isoLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Botão de filtro em formato de pílula, com o resumo do que está escolhido. */
function Pilula({ rotulo, valor, ativo, children, largura = "w-64" }: {
  rotulo: string; valor?: string; ativo: boolean; largura?: string;
  /** Função recebe "fechar", para escolhas únicas fecharem o menu sozinhas */
  children: React.ReactNode | ((fechar: () => void) => React.ReactNode);
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex h-8 max-w-full items-center gap-1 rounded-full border px-3 text-xs transition-colors",
          ativo ? "border-primary/50 bg-primary/10 text-primary font-medium" : "bg-card text-muted-foreground hover:text-foreground")}>
          <span className="shrink-0">{rotulo}{valor ? ":" : ""}</span>
          {valor && <span className="truncate max-w-[9rem]">{valor}</span>}
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("p-2", largura)}>{typeof children === "function" ? children(() => setAberto(false)) : children}</PopoverContent>
    </Popover>
  );
}

function ListaMarcar({ itens, marcados, onMudar }: { itens: { v: string; rotulo: string; cor?: string }[]; marcados: string[]; onMudar: (v: string[]) => void }) {
  const [filtro, setFiltro] = useState("");
  const visiveis = itens.filter((i) => i.rotulo.toLowerCase().includes(filtro.toLowerCase()));
  return (
    <div className="space-y-1.5">
      {itens.length > 8 && <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Procurar…" className="h-8 text-xs" />}
      <div className="max-h-60 overflow-y-auto space-y-0.5">
        {visiveis.map((i) => {
          const on = marcados.includes(i.v);
          return (
            <button key={i.v} type="button" onClick={() => onMudar(on ? marcados.filter((x) => x !== i.v) : [...marcados, i.v])}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
              <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", on && "border-primary bg-primary text-primary-foreground")}>{on && <Check className="h-3 w-3" />}</span>
              {i.cor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: i.cor }} />}
              <span className="truncate">{i.rotulo}</span>
            </button>
          );
        })}
        {visiveis.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Nada encontrado.</p>}
      </div>
      {marcados.length > 0 && <button type="button" onClick={() => onMudar([])} className="w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted">Limpar</button>}
    </div>
  );
}

function EscolherMunicipe({ valor, onMudar }: { valor: { id: string; nome: string } | null; onMudar: (m: { id: string; nome: string } | null) => void }) {
  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  useEffect(() => { const t = setTimeout(() => setTermo(texto), 300); return () => clearTimeout(t); }, [texto]);
  const q = useQuery({
    queryKey: ["quadro-busca-municipe", termo],
    enabled: termo.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await aplicarBusca(supabase.from("municipes").select("id, nome, bairro").order("nome").limit(8), termo, { campos: ["nome"], camposNumericos: ["telefone", "cpf"] });
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; bairro: string | null }[];
    },
    staleTime: 60_000,
  });
  return (
    <div className="space-y-1.5">
      <Input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nome, telefone ou CPF" className="h-8 text-xs" />
      <div className="max-h-56 overflow-y-auto">
        {termo.trim().length < 2 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">Digite ao menos 2 letras.</p>
          : q.isLoading ? <p className="px-2 py-1.5 text-xs text-muted-foreground">Buscando…</p>
          : (q.data ?? []).length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum munícipe encontrado.</p>
          : (q.data ?? []).map((m) => (
            <button key={m.id} type="button" onClick={() => onMudar({ id: m.id, nome: m.nome })}
              className={cn("flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-muted", valor?.id === m.id && "bg-muted")}>
              <span className="text-sm truncate">{m.nome}</span>
              {m.bairro && <span className="text-[11px] text-muted-foreground truncate">{m.bairro}</span>}
            </button>
          ))}
      </div>
      {valor && <button type="button" onClick={() => onMudar(null)} className="w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted">Tirar o filtro de munícipe</button>}
    </div>
  );
}

export function TrazerDemandasDialog({ aberto, onClose, quadroNome, colunas, jaNoQuadro, onTrazer }: {
  aberto: boolean;
  onClose: () => void;
  quadroNome: string;
  /** Etapas onde a demanda pode entrar (a primeira é a sugerida) */
  colunas: { id: string; nome: string; cor?: string | null }[];
  jaNoQuadro: Set<string>;
  onTrazer: (demandas: DemandaParaQuadro[], colunaId: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const { statusList, finalSlugs } = useDemandaStatus();
  const { pessoas, porId } = usePessoasGabinete();
  const areasQ = useQuery({
    queryKey: ["areas-lista-quadro"],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60_000,
  });

  const abertosPadrao = useMemo(() => statusList.filter((s) => !s.is_final).map((s) => s.slug), [statusList]);
  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  const [status, setStatus] = useState<string[] | null>(null); // null = "abertas" (padrão)
  const [areas, setAreas] = useState<string[]>([]);
  const [responsavel, setResponsavel] = useState<string>("todos");
  const [municipe, setMunicipe] = useState<{ id: string; nome: string } | null>(null);
  const [prazo, setPrazo] = useState<Prazo>("todos");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [esconderJa, setEsconderJa] = useState(true);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [escolhidas, setEscolhidas] = useState<Map<string, DemandaParaQuadro>>(new Map());
  const [coluna, setColuna] = useState("");
  const [trazendo, setTrazendo] = useState(false);
  const [filtrosCel, setFiltrosCel] = useState(false);

  useEffect(() => { const t = setTimeout(() => setTermo(texto), 300); return () => clearTimeout(t); }, [texto]);
  useEffect(() => { if (aberto) { setColuna((c) => (colunas.some((x) => x.id === c) ? c : colunas[0]?.id || "")); } }, [aberto, colunas]);
  // Fechou: começa do zero na próxima vez
  useEffect(() => {
    if (aberto) return;
    setTexto(""); setTermo(""); setStatus(null); setAreas([]); setResponsavel("todos"); setMunicipe(null);
    setPrazo("todos"); setOrdem("recentes"); setEsconderJa(true); setLimite(POR_PAGINA); setEscolhidas(new Map()); setFiltrosCel(false);
  }, [aberto]);

  const statusUsados = status ?? abertosPadrao;
  const idsNoQuadro = useMemo(() => [...jaNoQuadro], [jaNoQuadro]);
  const filtroNoServidor = esconderJa && idsNoQuadro.length > 0 && idsNoQuadro.length <= 300;
  const chave = [termo, statusUsados.join(","), areas.join(","), responsavel, municipe?.id, prazo, ordem, filtroNoServidor ? idsNoQuadro.length : 0];
  useEffect(() => setLimite(POR_PAGINA), chave); // eslint-disable-line react-hooks/exhaustive-deps

  const busca = useQuery({
    queryKey: ["quadro-trazer-demandas", ...chave, limite],
    enabled: aberto && statusList.length > 0,
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      let q = supabase.from("demandas")
        .select("id, protocolo, titulo, descricao, status, data_prazo, created_at, responsavel_id, bairro, areas(nome), municipes(nome)", { count: "exact" });
      if (statusUsados.length) q = q.in("status", statusUsados);
      if (areas.length) q = q.in("area_id", areas);
      if (responsavel === "eu" && user?.id) q = q.eq("responsavel_id", user.id);
      else if (responsavel === "ninguem") q = q.is("responsavel_id", null);
      else if (responsavel !== "todos") q = q.eq("responsavel_id", responsavel);
      if (municipe) q = q.eq("municipe_id", municipe.id);
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      if (prazo === "atrasadas") q = q.lt("data_prazo", isoLocal(hoje));
      else if (prazo === "semana") { const f = new Date(hoje); f.setDate(f.getDate() + 7); q = q.gte("data_prazo", isoLocal(hoje)).lte("data_prazo", isoLocal(f)); }
      else if (prazo === "mes") q = q.gte("data_prazo", isoLocal(hoje)).lte("data_prazo", isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));
      else if (prazo === "sem") q = q.is("data_prazo", null);
      if (filtroNoServidor) q = q.not("id", "in", `(${idsNoQuadro.join(",")})`);
      q = aplicarBusca(q, termo, { campos: ["todos"] });
      q = ordem === "prazo" ? q.order("data_prazo", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
        : q.order("created_at", { ascending: ordem === "antigas" });
      const { data, error, count } = await q.range(0, limite - 1);
      if (error) throw error;
      return { lista: (data ?? []) as unknown as DemandaParaQuadro[], total: count ?? 0 };
    },
    staleTime: 30_000,
  });

  const lista = (busca.data?.lista ?? []).filter((d) => !(esconderJa && !filtroNoServidor && jaNoQuadro.has(d.id)));
  const total = busca.data?.total ?? 0;
  const selecionaveis = lista.filter((d) => !jaNoQuadro.has(d.id));
  const todasMarcadas = selecionaveis.length > 0 && selecionaveis.every((d) => escolhidas.has(d.id));
  const finais = new Set(finalSlugs);

  const marcar = (d: DemandaParaQuadro) => setEscolhidas((m) => { const n = new Map(m); if (n.has(d.id)) n.delete(d.id); else n.set(d.id, d); return n; });
  const marcarPagina = () => setEscolhidas((m) => {
    const n = new Map(m);
    if (todasMarcadas) selecionaveis.forEach((d) => n.delete(d.id)); else selecionaveis.forEach((d) => n.set(d.id, d));
    return n;
  });

  const statusResumo = status === null ? "Abertas" : status.length === 0 ? "Todos" : status.length === 1 ? (statusList.find((s) => s.slug === status[0])?.nome ?? "1") : `${status.length}`;
  const respResumo = responsavel === "todos" ? undefined : responsavel === "eu" ? "Eu" : responsavel === "ninguem" ? "Sem responsável" : porId.get(responsavel)?.nome;
  const qtdFiltros = (status !== null ? 1 : 0) + (areas.length ? 1 : 0) + (responsavel !== "todos" ? 1 : 0) + (municipe ? 1 : 0) + (prazo !== "todos" ? 1 : 0);
  const limpar = () => { setStatus(null); setAreas([]); setResponsavel("todos"); setMunicipe(null); setPrazo("todos"); };

  const trazer = async () => {
    if (!coluna || escolhidas.size === 0) return;
    setTrazendo(true);
    try { await onTrazer([...escolhidas.values()], coluna); onClose(); }
    finally { setTrazendo(false); }
  };

  const filtros = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pilula rotulo="Status" valor={statusResumo} ativo={status !== null}>
        <div className="mb-1 flex gap-1">
          <button type="button" onClick={() => setStatus(null)} className={cn("flex-1 rounded-md border px-2 py-1 text-xs", status === null && "border-primary bg-primary/10 text-primary")}>Só abertas</button>
          <button type="button" onClick={() => setStatus([])} className={cn("flex-1 rounded-md border px-2 py-1 text-xs", status?.length === 0 && "border-primary bg-primary/10 text-primary")}>Todos</button>
        </div>
        <ListaMarcar itens={statusList.map((s) => ({ v: s.slug, rotulo: s.nome, cor: s.cor }))} marcados={status ?? []} onMudar={(v) => setStatus(v)} />
      </Pilula>
      <Pilula rotulo="Área" valor={areas.length === 1 ? areasQ.data?.find((a) => a.id === areas[0])?.nome : areas.length ? `${areas.length}` : undefined} ativo={areas.length > 0}>
        <ListaMarcar itens={(areasQ.data ?? []).map((a) => ({ v: a.id, rotulo: a.nome }))} marcados={areas} onMudar={setAreas} />
      </Pilula>
      <Pilula rotulo="Responsável" valor={respResumo} ativo={responsavel !== "todos"}>
        {(fechar) => <div className="max-h-64 overflow-y-auto space-y-0.5">
          {[["todos", "Qualquer pessoa"], ["eu", "Eu"], ["ninguem", "Sem responsável"], ...pessoas.map((p) => [p.id, p.nome] as [string, string])].map(([v, r]) => (
            <button key={v} type="button" onClick={() => { setResponsavel(v); fechar(); }}
              className={cn("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", responsavel === v && "bg-muted font-medium")}>
              <span className="truncate">{r}</span>{responsavel === v && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>}
      </Pilula>
      <Pilula rotulo="Munícipe" valor={municipe?.nome} ativo={!!municipe} largura="w-72">
        {(fechar) => <EscolherMunicipe valor={municipe} onMudar={(m) => { setMunicipe(m); fechar(); }} />}
      </Pilula>
      <Pilula rotulo="Prazo" valor={prazo === "todos" ? undefined : ROTULO_PRAZO[prazo]} ativo={prazo !== "todos"} largura="w-56">
        {(fechar) => <div className="space-y-0.5">
          {(Object.keys(ROTULO_PRAZO) as Prazo[]).map((p) => (
            <button key={p} type="button" onClick={() => { setPrazo(p); fechar(); }}
              className={cn("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", prazo === p && "bg-muted font-medium")}>
              {ROTULO_PRAZO[p]}{prazo === p && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>}
      </Pilula>
      {qtdFiltros > 0 && <button type="button" onClick={limpar} className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /> Limpar filtros</button>}
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !trazendo && onClose()}>
      <DialogContent className="max-w-3xl h-[88vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 space-y-1 text-left">
          <DialogTitle>Trazer demandas para {quadroNome}</DialogTitle>
          <DialogDescription>Cada demanda vira um cartão já vinculado, com descrição, área, responsável e prazo. Ao mudar de etapa, você escolhe se o status da demanda acompanha.</DialogDescription>
        </DialogHeader>

        {/* Busca + filtros */}
        <div className="space-y-2 border-b px-5 pb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Título, protocolo, munícipe, descrição, bairro…" className="h-9 pl-8" aria-label="Buscar demandas" />
            </div>
            <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 sm:hidden" onClick={() => setFiltrosCel((v) => !v)} aria-expanded={filtrosCel}>
              <Filter className="h-4 w-4" />{qtdFiltros > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{qtdFiltros}</span>}
            </Button>
          </div>
          <div className={cn(filtrosCel ? "block" : "hidden", "sm:block")}>{filtros}</div>
        </div>

        {/* Barra da lista */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/30 px-5 py-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={todasMarcadas} onCheckedChange={marcarPagina} disabled={selecionaveis.length === 0} aria-label="Marcar todas as mostradas" />
            <span className="text-muted-foreground tabular-nums">
              {busca.isLoading ? "Buscando…" : `${total.toLocaleString("pt-BR")} ${total === 1 ? "demanda" : "demandas"}`}
            </span>
          </label>
          {busca.isFetching && !busca.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <span className="flex-1" />
          <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
            <Checkbox checked={esconderJa} onCheckedChange={(v) => setEsconderJa(!!v)} /> Esconder as que já estão no quadro
          </label>
          <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
            <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-transparent px-1 text-xs shadow-none" aria-label="Ordenar"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(ROTULO_ORDEM) as Ordem[]).map((o) => <SelectItem key={o} value={o}>{ROTULO_ORDEM[o]}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {busca.isError ? (
            <p className="p-6 text-center text-sm text-destructive">Não foi possível buscar as demandas. <button type="button" className="underline" onClick={() => busca.refetch()}>Tentar de novo</button></p>
          ) : busca.isLoading ? (
            <div className="space-y-2 p-5">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : lista.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma demanda com esses filtros.
              {qtdFiltros > 0 && <> <button type="button" onClick={limpar} className="text-primary underline">Limpar filtros</button></>}
            </div>
          ) : (
            <ul className="divide-y">
              {lista.map((d) => {
                const ja = jaNoQuadro.has(d.id);
                const on = escolhidas.has(d.id);
                const st = statusList.find((s) => s.slug === d.status);
                const resp = d.responsavel_id ? porId.get(d.responsavel_id)?.nome : null;
                return (
                  <li key={d.id}>
                    <label className={cn("flex gap-3 px-5 py-3 transition-colors", ja ? "opacity-60" : "cursor-pointer hover:bg-muted/50", on && "bg-primary/5")}>
                      <Checkbox checked={on || ja} disabled={ja} onCheckedChange={() => marcar(d)} className="mt-0.5" aria-label={`Escolher ${d.titulo}`} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className="font-mono font-medium text-primary">#{d.protocolo}</span>
                          {st && <span className="inline-flex items-center gap-1 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: st.cor }} />{st.nome}</span>}
                          {d.data_prazo && <SeloPrazo prazo={{ data: d.data_prazo }} concluido={finais.has(d.status || "")} />}
                          {ja && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">já está no quadro</span>}
                        </div>
                        <p className="text-sm font-medium leading-snug [overflow-wrap:anywhere]">{d.titulo}</p>
                        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          {[d.areas?.nome, d.municipes?.nome, d.bairro, resp ? `Resp.: ${resp}` : "Sem responsável",
                            d.created_at ? `entrou em ${new Date(d.created_at).toLocaleDateString("pt-BR")}` : null].filter(Boolean).join(" · ")}
                        </p>
                        {d.descricao && <p className="text-xs text-muted-foreground/80 line-clamp-1 [overflow-wrap:anywhere]">{d.descricao}</p>}
                      </div>
                    </label>
                  </li>
                );
              })}
              {(busca.data?.lista.length ?? 0) < total && (
                <li className="p-3 text-center">
                  <Button variant="ghost" size="sm" disabled={busca.isFetching} onClick={() => setLimite((l) => l + POR_PAGINA)}>
                    {busca.isFetching ? "Carregando…" : `Mostrar mais (${Math.min(POR_PAGINA, total - (busca.data?.lista.length ?? 0))})`}
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Rodapé: quantas e para qual etapa */}
        <div className="flex flex-wrap items-center gap-2 border-t bg-card px-5 py-3">
          <span className="text-sm">
            {escolhidas.size === 0 ? <span className="text-muted-foreground">Escolha uma ou mais demandas</span>
              : <><strong className="tabular-nums">{escolhidas.size}</strong> {escolhidas.size === 1 ? "escolhida" : "escolhidas"} <button type="button" onClick={() => setEscolhidas(new Map())} className="ml-1 text-xs text-muted-foreground underline">desmarcar</button></>}
          </span>
          <span className="flex-1" />
          <span className="text-xs text-muted-foreground">Entrar em</span>
          <Select value={coluna} onValueChange={setColuna}>
            <SelectTrigger className="h-9 w-auto min-w-[140px] max-w-[200px]" aria-label="Etapa"><SelectValue placeholder="Etapa" /></SelectTrigger>
            <SelectContent>{colunas.map((c) => (
              <SelectItem key={c.id} value={c.id}><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.cor || "#888" }} />{c.nome}</span></SelectItem>
            ))}</SelectContent>
          </Select>
          <Button onClick={trazer} disabled={escolhidas.size === 0 || !coluna || trazendo}>
            {trazendo ? "Trazendo…" : escolhidas.size > 1 ? `Trazer ${escolhidas.size} demandas` : "Trazer demanda"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
