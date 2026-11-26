import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, LabelList,
} from "recharts";
import { AlertTriangle, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useAnalisesData, Periodo, periodoValido, lerPeriodoCurto, lerPeriodoLivre, Cobertura, COBERTURA_MINIMA, COBERTURA_AVISO,
  type FiltrosAnalise,
} from "@/hooks/useAnalisesData";
import { FiltrosAnalises, FunilRecebidas, ListaBarras, PeriodoPersonalizado, TabelaAreas, exportarCsv } from "@/components/analises/PecasAnalises";
import { usePessoasGabinete } from "@/hooks/useQuadros";
import { RelatorioPeriodo } from "@/components/analises/RelatorioPeriodo";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// ─── Tokens de gráfico (index.css: --viz-*) ─────────────────────
const COR = {
  serie1: "var(--viz-1)",
  serie2: "var(--viz-2)",
  seq: "var(--viz-seq)",
  grid: "var(--viz-grid)",
  eixo: "var(--viz-eixo)",
  texto: "var(--viz-texto)",
};
const EIXO = { fontSize: 11, fill: COR.texto };

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** 0,3 dia → "7 h"; 2,4 → "2 dias" */
const tempoCurto = (d: number | null) => (d === null ? "–" : d < 1 ? `${Math.max(1, Math.round(d * 24))} h` : `${Math.round(d)} ${Math.round(d) === 1 ? "dia" : "dias"}`);
const num = (x: number) => x.toLocaleString("pt-BR");

// ─── Peças ──────────────────────────────────────────────────────

function Painel({ titulo, subtitulo, children, className }: {
  titulo: string; subtitulo?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={cn("border shadow-sm", className)}>
      <CardHeader className="pb-2 space-y-1">
        <CardTitle className="text-base font-semibold">{titulo}</CardTitle>
        {subtitulo && <p className="text-xs text-muted-foreground leading-snug">{subtitulo}</p>}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function Indicador({ rotulo, valor, detalhe, alerta }: {
  rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; alerta?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className={cn("text-2xl font-bold tabular-nums leading-tight mt-0.5", alerta && "text-destructive")}>{valor}</div>
      {detalhe && <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{detalhe}</div>}
    </div>
  );
}

/** Regra de cobertura: avisa abaixo de 80%, esconde abaixo de 20%. */
function ComCobertura({ cob, oQue, children }: { cob: Cobertura; oQue: string; children: React.ReactNode }) {
  if (cob.total === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Sem demandas no período.</p>;
  if (cob.fracao < COBERTURA_MINIMA) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Só {pct(cob.fracao)} das demandas têm {oQue} ({num(cob.preenchidas)} de {num(cob.total)}).
          Com tão pouco dado o gráfico enganaria, então ele fica oculto até o preenchimento melhorar.
        </span>
      </div>
    );
  }
  return (
    <>
      {cob.fracao < COBERTURA_AVISO && (
        <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
          <Info className="h-3 w-3" />
          Baseado em {pct(cob.fracao)} das demandas ({num(cob.preenchidas)} de {num(cob.total)}), que têm {oQue}.
        </p>
      )}
      {children}
    </>
  );
}

function DicaGrafico({ active, payload, label, unidade = "demandas" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <div className="font-medium mb-1 text-foreground">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span>{p.name}:</span>
          <span className="font-semibold tabular-nums text-foreground">{num(p.value)}</span>
          <span>{unidade}</span>
        </div>
      ))}
    </div>
  );
}

/** Barras horizontais de magnitude (um tom só), com o valor escrito na ponta. */
function BarrasHorizontais({ dados, nomeSerie, altura }: {
  dados: { nome: string; valor: number }[]; nomeSerie: string; altura?: number;
}) {
  if (dados.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">Nada para mostrar.</p>;
  const h = altura ?? Math.max(120, dados.length * 30 + 10);
  return (
    <div style={{ height: h }} role="img" aria-label={`${nomeSerie}: ${dados.map((d) => `${d.nome} ${d.valor}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category" dataKey="nome" width={150} tickLine={false} axisLine={false}
            tick={{ ...EIXO, fill: "hsl(var(--foreground))" }}
            tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 21) + "…" : v)}
          />
          <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} content={<DicaGrafico />} />
          <Bar dataKey="valor" name={nomeSerie} fill={COR.seq} radius={[0, 4, 4, 0]} maxBarSize={18}>
            <LabelList dataKey="valor" position="right" style={{ fontSize: 11, fill: "hsl(var(--foreground))" }} formatter={(v: number) => num(v)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Medidor({ rotulo, cob }: { rotulo: string; cob: Cobertura }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className="font-semibold tabular-nums">{pct(cob.fracao)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden" role="meter" aria-valuenow={Math.round(cob.fracao * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo}>
        <div className="h-full rounded-full" style={{ width: pct(cob.fracao), background: COR.seq }} />
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{num(cob.preenchidas)} de {num(cob.total)}</div>
    </div>
  );
}

// ─── Tela ───────────────────────────────────────────────────────

const PERIODOS: { v: Periodo; rotulo: string }[] = [
  { v: "semana", rotulo: "Semana" },
  { v: "quinzena", rotulo: "Quinzena" },
  { v: "mes", rotulo: "Mês" },
  { v: "3", rotulo: "3 meses" },
  { v: "6", rotulo: "6 meses" },
  { v: "12", rotulo: "12 meses" },
  { v: "tudo", rotulo: "Desde o início" },
];

export default function Analises() {
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    try {
      const v = localStorage.getItem("analises-periodo");
      return periodoValido(v) ? v : "6";
    } catch { return "6"; }
  });
  const escolherPeriodo = (p: Periodo) => {
    setPeriodo(p);
    try { localStorage.setItem("analises-periodo", p); } catch { /* sem storage */ }
  };

  // Área e responsável: valem para a tela toda (lembrados no navegador)
  const [filtros, setFiltros] = useState<FiltrosAnalise>(() => {
    try { const f = JSON.parse(localStorage.getItem("analises-filtros") || "{}"); return { areaId: f.areaId || null, responsavelId: f.responsavelId || null }; } catch { return {}; }
  });
  const mudarFiltros = (f: FiltrosAnalise) => { setFiltros(f); try { localStorage.setItem("analises-filtros", JSON.stringify(f)); } catch { /* sem storage */ } };
  const { pessoas, porId } = usePessoasGabinete();
  const { finalSlugs, getStatusLabel } = useDemandaStatus();
  const livre = lerPeriodoLivre(periodo);

  const { dados, carregando, carregandoBase, carregandoAtividades, erro, erroBase, tentarDeNovo } = useAnalisesData(periodo, filtros);
  const { data: config } = useConfiguracoes();
  /** Os filtros em texto, para o relatório */
  const filtrosTexto = [
    filtros.areaId ? `área ${filtros.areaId === "sem" ? "(sem área)" : dados?.porArea.find((a) => a.id === filtros.areaId)?.nome || "escolhida"}` : "",
    filtros.responsavelId ? `responsável ${filtros.responsavelId === "sem" ? "(sem responsável)" : porId.get(filtros.responsavelId)?.nome || ""}` : "",
  ].filter(Boolean).join(" · ");
  const exportar = () => dados && exportarCsv(dados.listaEntraram, {
    nomeStatus: (s) => getStatusLabel(s || ""),
    ehFinal: (s) => finalSlugs.includes(s || ""),
    nomePessoa: (id) => (id ? porId.get(id)?.nome || "" : ""),
    rotulo: dados.periodo.rotulo,
  });
  const unidadeTempo = dados?.escala === "mes" ? "mês" : dados?.escala === "dia" ? "dia" : "semana";
  // Semana/quinzena/mês: o botão fica marcado mesmo vendo um período anterior
  const tipoCurto = lerPeriodoCurto(periodo)?.tipo;
  const marcado = (v: Periodo) => periodo === v || tipoCurto === v;
  const nav = dados?.periodo.navegacao;
  const andarPeriodo = (n: number) => {
    if (!nav) return;
    const d = Math.min(0, nav.desloc + n);
    escolherPeriodo(d === 0 ? nav.tipo : `${nav.tipo}:${d}`);
  };
  /** "+3 (antes 5)" comparando com o mesmo trecho do período anterior */
  const comparar = (agora: number, antes: number | undefined) => {
    if (antes === undefined || !dados?.comparacao) return null;
    const dif = agora - antes;
    return dif === 0
      ? `igual ${dados.comparacao.rotulo} (${num(antes)})`
      : `${dif > 0 ? "+" : ""}${num(dif)} em relação ${dados.comparacao.rotulo} (${num(antes)})`;
  };
  const anos = dados?.periodo.anosDisponiveis ?? [new Date().getFullYear()];
  const anoEscolhido = periodo.startsWith("ano-") ? periodo : "";

  return (
    <div className="md:container md:mx-auto md:px-4 max-w-[1400px] space-y-4 md:space-y-5">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Análises</h1>
        <p className="text-sm text-muted-foreground">O gabinete em números: entrada, andamento, prazos, áreas, território e equipe.</p>
      </div>

      {/* Controles: período (uma linha) e filtros (outra), juntos acima dos números */}
      <div className="space-y-2.5 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Período</span>
          <div className="inline-flex flex-wrap rounded-lg border bg-muted/30 p-0.5" role="radiogroup" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p.v} type="button" role="radio" aria-checked={marcado(p.v)}
                onClick={() => escolherPeriodo(p.v)}
                className={cn("px-2.5 py-1 text-sm rounded-md transition-colors",
                  p.v === "3" && "sm:ml-1 sm:border-l sm:rounded-l-none sm:pl-3",
                  marcado(p.v) ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                {p.rotulo}
              </button>
            ))}
            <PeriodoPersonalizado ativo={!!livre} de={livre?.de} ate={livre?.ate} onAplicar={(de, ate) => escolherPeriodo(`livre:${de}:${ate}`)} />
          </div>
          <Select value={anoEscolhido} onValueChange={(v) => escolherPeriodo(v)}>
            <SelectTrigger className={cn("h-8 w-[110px] text-sm", anoEscolhido && "font-medium ring-1 ring-primary/40")} aria-label="Balanço de um ano">
              <SelectValue placeholder="Por ano" />
            </SelectTrigger>
            <SelectContent>
              {[...anos].reverse().map((a) => (
                <SelectItem key={a} value={`ano-${a}`}>Ano {a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="border-t pt-2.5">
          <FiltrosAnalises filtros={filtros} onMudar={mudarFiltros} pessoas={pessoas} onExportar={exportar} podeExportar={!!dados && dados.listaEntraram.length > 0}
            acoes={dados && <RelatorioPeriodo dados={dados} gabinete={config?.gabinete?.nome || ""} filtros={filtrosTexto} />} />
        </div>
      </div>

      {erro ? (
        <ErrorState what="as análises" onRetry={tentarDeNovo} />
      ) : carregando || !dados ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          {/* Totais gerais: tudo o que o gabinete já registrou */}
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">
              No total, desde {dados.geral.desde} (todo o período registrado no sistema){dados.filtrado && <strong className="text-foreground"> · com os filtros escolhidos</strong>}
            </p>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
              <div>
                <dt className="text-xs text-muted-foreground">Demandas registradas</dt>
                <dd className="text-xl font-bold tabular-nums">{num(dados.geral.demandas)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Concluídas</dt>
                <dd className="text-xl font-bold tabular-nums">
                  {num(dados.geral.concluidas)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">({pct(dados.geral.pctConcluidas)})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Abertas hoje</dt>
                <dd className="text-xl font-bold tabular-nums">{num(dados.geral.abertas)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Munícipes cadastrados</dt>
                <dd className="text-xl font-bold tabular-nums">{dados.geral.municipes === null ? "…" : num(dados.geral.municipes)}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {nav && (
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => andarPeriodo(-1)} disabled={!nav.podeVoltar}
                aria-label={nav.tipo === "semana" ? "Semana anterior" : nav.tipo === "quinzena" ? "Quinzena anterior" : "Mês anterior"}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <h2 className="text-sm font-semibold text-muted-foreground first-letter:uppercase">{dados.periodo.rotulo}</h2>
            {nav && (
              <>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => andarPeriodo(1)} disabled={!nav.podeAvancar}
                  aria-label={nav.tipo === "semana" ? "Próxima semana" : nav.tipo === "quinzena" ? "Próxima quinzena" : "Próximo mês"}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {nav.desloc < 0 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => escolherPeriodo(nav.tipo)}>Voltar para a atual</Button>}
                {!nav.completo && <span className="text-[11px] text-muted-foreground">em andamento, até hoje</span>}
              </>
            )}
          </div>

          {/* Indicadores do período */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Indicador rotulo="Entraram" valor={num(dados.totais.entraram)}
              detalhe={comparar(dados.totais.entraram, dados.comparacao?.entraram) ?? `demandas novas ${dados.periodo.rotulo}`} />
            <Indicador rotulo="Concluídas" valor={num(dados.totais.concluidas)}
              detalhe={<>
                {comparar(dados.totais.concluidas, dados.comparacao?.concluidas) ?? "pela data de conclusão"}
                {dados.concluidasEstimadas > 0 && <span className="block">{num(dados.concluidasEstimadas)} com data estimada</span>}
              </>} />
            <Indicador
              rotulo="Saldo da fila"
              valor={(dados.totais.saldo > 0 ? "+" : "") + num(dados.totais.saldo)}
              alerta={dados.totais.saldo > 0}
              detalhe={dados.totais.saldo > 0 ? "a fila cresceu no período" : dados.totais.saldo < 0 ? "a fila diminuiu no período" : "fila estável"}
            />
            <Indicador
              rotulo="Tempo até concluir"
              valor={dados.totais.medianaDias === null ? "–" : `${Math.round(dados.totais.medianaDias)} dias`}
              detalhe={dados.concluidasEstimadas > 0 ? "mediana (inclui datas estimadas)" : "mediana"}
            />
            <Indicador
              rotulo="Concluídas no prazo"
              valor={dados.totais.pctNoPrazo === null ? "–" : pct(dados.totais.pctNoPrazo)}
              detalhe={dados.totais.baseNoPrazo ? `de ${num(dados.totais.baseNoPrazo)} concluídas que tinham prazo` : "nenhuma concluída tinha prazo"}
            />
          </div>

          {/* Demandas recebidas no período: funil + resumo + prioridade */}
          <Painel
            titulo="Demandas recebidas no período"
            subtitulo={`As ${num(dados.recebidas.total)} demandas que entraram ${dados.periodo.rotulo}, e em que status cada uma está hoje.`}
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <FunilRecebidas total={dados.recebidas.total} itens={dados.funilRecebidas} />
                <p className="mt-2 text-[11px] text-muted-foreground">✓ = status que conta como concluído. A largura de cada faixa é proporcional à quantidade.</p>
              </div>
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    { r: "Concluídas", v: dados.recebidas.concluidas, d: dados.recebidas.total ? pct(dados.recebidas.concluidas / dados.recebidas.total) : "–" },
                    { r: "Em andamento", v: dados.recebidas.abertas, d: dados.recebidas.total ? pct(dados.recebidas.abertas / dados.recebidas.total) : "–" },
                    { r: "Atrasadas", v: dados.recebidas.atrasadas, d: "já passaram do prazo", alerta: dados.recebidas.atrasadas > 0 },
                    { r: "Sem responsável", v: dados.recebidas.semResponsavel, d: "em aberto", alerta: dados.recebidas.semResponsavel > 0 },
                  ].map((x) => (
                    <div key={x.r} className="rounded-lg border bg-muted/20 px-3 py-2">
                      <dt className="text-[11px] text-muted-foreground">{x.r}</dt>
                      <dd className={cn("text-xl font-bold tabular-nums leading-tight", x.alerta && "text-destructive")}>{num(x.v)}</dd>
                      <dd className="text-[11px] text-muted-foreground">{x.d}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Por prioridade</p>
                  <ListaBarras itens={dados.prioridades} total={dados.recebidas.total} />
                </div>
              </div>
            </div>
          </Painel>

          {/* Por área */}
          <Painel
            titulo="Por área"
            subtitulo={<>Demandas que entraram {dados.periodo.rotulo}, por área, e como estão hoje. Clique numa área para filtrar a tela toda por ela.</>}
          >
            <TabelaAreas linhas={dados.porArea} areaFiltrada={filtros.areaId}
              onEscolher={(id) => mudarFiltros({ ...filtros, areaId: filtros.areaId === id ? null : id })} />
          </Painel>

          {/* Atendimento: primeira resposta e munícipes atendidos */}
          <Painel titulo="Atendimento" subtitulo={`Das demandas que entraram ${dados.periodo.rotulo}: quanto tempo levou o primeiro retorno e quantas pessoas foram atendidas.`}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section aria-label="Primeira resposta">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Primeira resposta</p>
                {carregandoAtividades || !dados.primeiraResposta ? <Skeleton className="h-24" /> : dados.primeiraResposta.base === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma demanda entrou neste período.</p>
                ) : (
                  <>
                    <dl className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        <dt className="text-[11px] text-muted-foreground">Tempo (mediana)</dt>
                        <dd className="text-xl font-bold tabular-nums leading-tight">{tempoCurto(dados.primeiraResposta.medianaDias)}</dd>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        <dt className="text-[11px] text-muted-foreground">Em até 2 dias</dt>
                        <dd className="text-xl font-bold tabular-nums leading-tight">{pct(dados.primeiraResposta.ate2Dias / dados.primeiraResposta.base)}</dd>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        <dt className="text-[11px] text-muted-foreground">Sem resposta</dt>
                        <dd className={cn("text-xl font-bold tabular-nums leading-tight", dados.primeiraResposta.semRespostaAbertas > 0 && "text-destructive")}>{num(dados.primeiraResposta.semRespostaAbertas)}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                      Primeira resposta = primeira atividade registrada na demanda (comentário ou atualização).
                      {" "}{num(dados.primeiraResposta.comResposta)} de {num(dados.primeiraResposta.base)} já tiveram alguma; "sem resposta" conta só as que seguem em aberto.
                    </p>
                  </>
                )}
              </section>
              <section aria-label="Munícipes atendidos" className="lg:border-l lg:pl-6">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Munícipes atendidos</p>
                <dl className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <dt className="text-[11px] text-muted-foreground">Pessoas</dt>
                    <dd className="text-xl font-bold tabular-nums leading-tight">{num(dados.municipesAtendidos.pessoas)}</dd>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <dt className="text-[11px] text-muted-foreground">Primeira vez</dt>
                    <dd className="text-xl font-bold tabular-nums leading-tight">{num(dados.municipesAtendidos.primeiraVez)}</dd>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <dt className="text-[11px] text-muted-foreground">Já atendidas antes</dt>
                    <dd className="text-xl font-bold tabular-nums leading-tight">{num(dados.municipesAtendidos.jaAtendidosAntes)}</dd>
                  </div>
                </dl>
                {dados.municipesAtendidos.top.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] text-muted-foreground">{num(dados.municipesAtendidos.comMaisDeUma)} {dados.municipesAtendidos.comMaisDeUma === 1 ? "pessoa trouxe" : "pessoas trouxeram"} mais de uma demanda no período:</p>
                    <ul className="divide-y text-sm">
                      {dados.municipesAtendidos.top.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 py-1">
                          <span className="truncate">{m.nome}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{m.valor} demandas</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : dados.municipesAtendidos.pessoas > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">Cada pessoa trouxe uma demanda no período.</p>
                )}
              </section>
            </div>
          </Painel>

          {/* Saldo: entrada × conclusão */}
          <Painel
            titulo={`Entrada e conclusão por ${unidadeTempo}`}
            subtitulo={<>Se a linha de entrada fica acima da de conclusão, a fila está crescendo.{dados.concluidasEstimadas > 0 && " As conclusões anteriores a 26/11/2026 usam a data da última alteração (estimada)."}</>}
          >
            {dados.picoInicial && (
              <p className="text-[11px] text-muted-foreground mb-2 flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  {dados.picoInicial.rotulo} tem {num(dados.picoInicial.valor)} entradas porque inclui o cadastro inicial
                  (demandas trazidas de uma vez ao começar a usar o sistema), não um pico de pedidos.
                </span>
              </p>
            )}
            <div className="flex items-center gap-4 text-xs mb-2" aria-hidden>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: COR.serie1 }} /> Entraram</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: COR.serie2 }} /> Concluídas</span>
            </div>
            <div className="h-64" role="img" aria-label={`Entrada e conclusão por ${unidadeTempo}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dados.fluxo} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} stroke={COR.grid} />
                  <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={{ stroke: COR.eixo }} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={EIXO} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  <Tooltip content={<DicaGrafico />} cursor={{ stroke: COR.eixo, strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="entrada" name="Entraram" stroke={COR.serie1} strokeWidth={2} dot={dados.escala === "dia" ? { r: 2.5, strokeWidth: 0, fill: COR.serie1 } : false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                  <Line type="monotone" dataKey="conclusao" name="Concluídas" stroke={COR.serie2} strokeWidth={2} dot={dados.escala === "dia" ? { r: 2.5, strokeWidth: 0, fill: COR.serie2 } : false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Painel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
            <Painel titulo="Por onde as demandas chegam" subtitulo={`Demandas que entraram ${dados.periodo.rotulo}, por canal.`}>
              <ComCobertura cob={dados.coberturaCanal} oQue="o canal de entrada registrado">
                <BarrasHorizontais dados={dados.canais} nomeSerie="Demandas" />
              </ComCobertura>
            </Painel>

            <Painel titulo="Todas as demandas hoje, por status" subtitulo="O gabinete inteiro (não só as do período), na ordem dos status configurados.">
              <BarrasHorizontais
                dados={dados.funil.map((f) => ({ nome: f.final ? `${f.nome} ✓` : f.nome, valor: f.valor }))}
                nomeSerie="Demandas"
              />
              <p className="text-[11px] text-muted-foreground mt-1">✓ = status que conta como concluído.</p>
            </Painel>

            <Painel
              titulo="Atrasos por área"
              subtitulo={`${num(dados.atrasadasAbertas)} demandas abertas já passaram do prazo.`}
            >
              <ComCobertura cob={dados.coberturaPrazo} oQue="prazo definido">
                {dados.atrasadasAbertas > 0 && (
                  <div className="mb-3 grid grid-cols-4 gap-1.5">
                    {dados.faixasAtraso.map((f, i) => (
                      <Link key={f.rotulo} title="Ver estas demandas"
                        to={`/demandas?atraso=${f.filtro}${filtros.areaId && filtros.areaId !== "sem" ? `&area=${filtros.areaId}` : ""}${filtros.responsavelId && filtros.responsavelId !== "sem" ? `&responsavel=${filtros.responsavelId}` : ""}`}
                        className={cn("rounded-md border px-2 py-1.5 text-center transition-colors hover:border-destructive/50",
                          i === 0 ? "bg-amber-50 dark:bg-amber-950/30" : i === 1 ? "bg-orange-50 dark:bg-orange-950/30" : "bg-red-50 dark:bg-red-950/30")}>
                        <span className="block text-base font-bold tabular-nums leading-tight">{num(f.valor)}</span>
                        <span className="block text-[10.5px] text-muted-foreground">{f.rotulo}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <BarrasHorizontais dados={dados.atrasoPorArea} nomeSerie="Atrasadas" />
              </ComCobertura>
            </Painel>

            <Painel
              titulo="Bairros com mais demandas"
              subtitulo={`Demandas que entraram ${dados.periodo.rotulo}. Grafias diferentes do mesmo bairro (acento, maiúsculas, pontuação) são somadas.`}
            >
              <ComCobertura cob={dados.coberturaBairro} oQue="bairro preenchido">
                <BarrasHorizontais dados={dados.bairros} nomeSerie="Demandas" />
              </ComCobertura>
            </Painel>
          </div>

          {/* Equipe */}
          <Painel
            titulo="Equipe"
            subtitulo={<>Carga de demandas abertas por responsável. {dados.semResponsavel > 0 && <strong className="text-foreground">{num(dados.semResponsavel)} abertas estão sem responsável.</strong>}</>}
          >
            {dados.equipe.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma demanda com responsável.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left font-medium py-2 px-2">Pessoa</th>
                      <th className="text-left font-medium py-2 px-2 w-[40%]">Abertas</th>
                      <th className="text-right font-medium py-2 px-2"><span className="sm:hidden">Atraso</span><span className="hidden sm:inline">Atrasadas</span></th>
                      <th className="text-right font-medium py-2 px-2 whitespace-nowrap"><span className="sm:hidden" title={`Concluídas (${dados.periodo.rotuloCurto})`}>Concl.</span><span className="hidden sm:inline">Concluídas ({dados.periodo.rotuloCurto})</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const max = Math.max(...dados.equipe.map((e) => e.abertas), 1);
                      return dados.equipe.map((e) => (
                        <tr key={e.id} className="border-b last:border-0">
                          <td className="py-2 px-2 max-w-[7.5rem] truncate sm:max-w-none sm:whitespace-nowrap" title={e.nome}>{e.nome}</td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 rounded-full" style={{ width: `${(e.abertas / max) * 100}%`, minWidth: e.abertas ? 4 : 0, background: COR.seq }} />
                              <span className="tabular-nums text-xs">{num(e.abertas)}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            {e.atrasadas > 0 ? (
                              <span className="inline-flex items-center gap-1 text-destructive">
                                <AlertTriangle className="h-3 w-3" aria-hidden /> {num(e.atrasadas)}
                              </span>
                            ) : <span className="text-muted-foreground">0</span>}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">{num(e.concluidas)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>

          {/* Base de munícipes */}
          <Painel titulo="Base de munícipes" subtitulo="Cadastros novos e qualidade do cadastro (o que permite contato e análise por território).">
            {erroBase ? (
              <ErrorState what="os dados dos munícipes" onRetry={tentarDeNovo} className="py-6" />
            ) : carregandoBase || !dados.base ? (
              <Skeleton className="h-48" />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    {num(dados.base.novosNoPeriodo)} cadastros novos {dados.periodo.rotulo} · {num(dados.base.total)} no total
                  </p>
                  <div className="h-44" role="img" aria-label={`Cadastros novos por ${unidadeTempo}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dados.base.novosPor} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap={2}>
                        <CartesianGrid vertical={false} stroke={COR.grid} />
                        <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={{ stroke: COR.eixo }} interval="preserveStartEnd" minTickGap={16} />
                        <YAxis tick={EIXO} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                        <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} content={<DicaGrafico unidade="cadastros" />} />
                        <Bar dataKey="valor" name="Cadastros" fill={COR.seq} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-4">
                  <Medidor rotulo="Com telefone válido" cob={dados.base.telefone} />
                  <Medidor rotulo="Com bairro" cob={dados.base.bairro} />
                  <Medidor rotulo="Com data de nascimento" cob={dados.base.nascimento} />
                </div>
              </div>
            )}
          </Painel>

          {/* O que ficou de fora pela regra de cobertura */}
          {dados.coberturaHumor.fracao < COBERTURA_MINIMA && (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              O "humor" do munícipe não aparece aqui: está registrado em só {pct(dados.coberturaHumor.fracao)} das demandas.
            </p>
          )}
        </>
      )}
    </div>
  );
}
