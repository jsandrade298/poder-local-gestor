import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, LabelList,
} from "recharts";
import { AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useAnalisesData, Periodo, Cobertura, COBERTURA_MINIMA, COBERTURA_AVISO,
} from "@/hooks/useAnalisesData";
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
  { v: 3, rotulo: "3 meses" },
  { v: 6, rotulo: "6 meses" },
  { v: 12, rotulo: "12 meses" },
];

export default function Analises() {
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    try {
      const v = Number(localStorage.getItem("analises-periodo"));
      return v === 3 || v === 6 || v === 12 ? v : 6;
    } catch { return 6; }
  });
  const escolherPeriodo = (p: Periodo) => {
    setPeriodo(p);
    try { localStorage.setItem("analises-periodo", String(p)); } catch { /* sem storage */ }
  };

  const { dados, carregando, carregandoBase, erro, erroBase, tentarDeNovo } = useAnalisesData(periodo);
  const unidadeTempo = dados?.mensal ? "mês" : "semana";

  return (
    <div className="md:container md:mx-auto md:px-4 max-w-[1400px] space-y-4 md:space-y-5">
      {/* Cabeçalho + filtro (uma linha, acima dos gráficos) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Análises</h1>
          <p className="text-sm text-muted-foreground">O gabinete em números: entrada, saldo, andamento, prazos, território e equipe.</p>
        </div>
        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5 self-start" role="radiogroup" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.v} type="button" role="radio" aria-checked={periodo === p.v}
              onClick={() => escolherPeriodo(p.v)}
              className={cn("px-3 py-1.5 text-sm rounded-md transition-colors",
                periodo === p.v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {p.rotulo}
            </button>
          ))}
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
          {/* Indicadores */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Indicador rotulo="Entraram" valor={num(dados.totais.entraram)} detalhe={`demandas novas em ${periodo} meses`} />
            <Indicador rotulo="Concluídas" valor={num(dados.totais.concluidas)} detalhe="estimado pela última alteração" />
            <Indicador
              rotulo="Saldo da fila"
              valor={(dados.totais.saldo > 0 ? "+" : "") + num(dados.totais.saldo)}
              alerta={dados.totais.saldo > 0}
              detalhe={dados.totais.saldo > 0 ? "a fila cresceu no período" : dados.totais.saldo < 0 ? "a fila diminuiu no período" : "fila estável"}
            />
            <Indicador
              rotulo="Tempo até concluir"
              valor={dados.totais.medianaDias === null ? "–" : `${Math.round(dados.totais.medianaDias)} dias`}
              detalhe="mediana, estimada"
            />
            <Indicador
              rotulo="Concluídas no prazo"
              valor={dados.totais.pctNoPrazo === null ? "–" : pct(dados.totais.pctNoPrazo)}
              detalhe={dados.totais.baseNoPrazo ? `de ${num(dados.totais.baseNoPrazo)} concluídas que tinham prazo` : "nenhuma concluída tinha prazo"}
            />
          </div>

          {/* Saldo: entrada × conclusão */}
          <Painel
            titulo={`Entrada e conclusão por ${unidadeTempo}`}
            subtitulo={<>Se a linha de entrada fica acima da de conclusão, a fila está crescendo. Conclusão estimada pela última alteração das demandas em status final.</>}
          >
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
                  <Line type="monotone" dataKey="entrada" name="Entraram" stroke={COR.serie1} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                  <Line type="monotone" dataKey="conclusao" name="Concluídas" stroke={COR.serie2} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Painel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
            <Painel titulo="Por onde as demandas chegam" subtitulo={`Demandas que entraram nos últimos ${periodo} meses, por canal.`}>
              <ComCobertura cob={dados.coberturaCanal} oQue="o canal de entrada registrado">
                <BarrasHorizontais dados={dados.canais} nomeSerie="Demandas" />
              </ComCobertura>
            </Painel>

            <Painel titulo="Andamento por status" subtitulo="Todas as demandas do gabinete hoje, na ordem dos status configurados.">
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
                <BarrasHorizontais dados={dados.atrasoPorArea} nomeSerie="Atrasadas" />
              </ComCobertura>
            </Painel>

            <Painel
              titulo="Bairros com mais demandas"
              subtitulo={`Últimos ${periodo} meses. Grafias diferentes do mesmo bairro (acento, maiúsculas, pontuação) são somadas.`}
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
                      <th className="text-right font-medium py-2 px-2">Atrasadas</th>
                      <th className="text-right font-medium py-2 px-2 whitespace-nowrap">Concluídas ({periodo}m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const max = Math.max(...dados.equipe.map((e) => e.abertas), 1);
                      return dados.equipe.map((e) => (
                        <tr key={e.id} className="border-b last:border-0">
                          <td className="py-2 px-2 whitespace-nowrap">{e.nome}</td>
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
                    {num(dados.base.novosNoPeriodo)} cadastros novos em {periodo} meses · {num(dados.base.total)} no total
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
