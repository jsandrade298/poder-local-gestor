import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Sparkles, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase as sb } from "@/integrations/supabase/client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TemaDaSemana {
  tema_nome: string;
  tema_resumo: string | null;
  quantidade: number;
  quantidade_periodo_anterior: number | null;
  tendencia: "subindo" | "caindo" | "estavel" | "novo";
  variacao_pct: number | null;
  bairros: string[];
  areas: string[];
  sugestao_tipo: string | null;
  sugestao_descricao: string | null;
  demanda_ids: string[];
  gerado_em: string;
  periodo_inicio: string;
  periodo_fim: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TendenciaIcon({ tendencia, variacao }: { tendencia: TemaDaSemana["tendencia"]; variacao: number | null }) {
  if (tendencia === "subindo")
    return (
      <span className="flex items-center gap-0.5 text-[11px] font-semibold text-red-500">
        <TrendingUp className="w-3 h-3" />
        {variacao !== null ? `+${variacao}%` : "↑"}
      </span>
    );
  if (tendencia === "caindo")
    return (
      <span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600">
        <TrendingDown className="w-3 h-3" />
        {variacao !== null ? `${variacao}%` : "↓"}
      </span>
    );
  if (tendencia === "novo")
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-400">NOVO</span>;
  return <Minus className="w-3 h-3 text-muted-foreground/50" />;
}

function corTendencia(t: TemaDaSemana["tendencia"]): string {
  if (t === "subindo") return "border-l-red-400";
  if (t === "caindo")  return "border-l-emerald-400";
  if (t === "novo")    return "border-l-violet-400";
  return "border-l-border";
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function TemasDaSemana() {
  const navigate = useNavigate();
  const [gerandoClusters, setGerandoClusters] = useState(false);

  const { data: temas = [], isLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["temas-semana"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumo_temas_por_tenant")
        .select("*")
        .order("quantidade", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as TemaDaSemana[];
    },
    staleTime: 1000 * 60 * 15, // revalida a cada 15min
  });

  // Acionar clustering manual
  const acionarClustering = async () => {
    setGerandoClusters(true);
    try {
      // Buscar o tenant_id do usuário atual
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const { error } = await supabase.functions.invoke("clusterizar-temas", {
        body: { tenant_id: profile.tenant_id, periodo_dias: 30, min_cluster_size: 3 },
      });

      if (error) throw error;
      await refetch();
    } catch (err) {
      console.error("Erro ao gerar clustering:", err);
    } finally {
      setGerandoClusters(false);
    }
  };

  const ultimaAtualizacao = temas[0]?.gerado_em
    ? new Date(temas[0].gerado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <TooltipProvider>
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              Temas da Semana
            </CardTitle>
            {ultimaAtualizacao && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Atualizado em {ultimaAtualizacao} · últimos 30 dias
              </p>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={acionarClustering}
                disabled={gerandoClusters}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              >
                {gerandoClusters
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-[11px]">
              {gerandoClusters ? "Gerando análise…" : "Reanalisar temas agora"}
            </TooltipContent>
          </Tooltip>
        </CardHeader>

        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando temas…
            </div>
          ) : temas.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Nenhuma análise ainda</p>
                <p className="text-[12px] text-muted-foreground mt-1 max-w-[260px] mx-auto">
                  A análise roda automaticamente toda segunda-feira. Clique em{" "}
                  <button onClick={acionarClustering} className="text-primary hover:underline">gerar agora</button>
                  {" "}para ver os temas das suas demandas.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {temas.map((tema, i) => (
                <Tooltip key={`${tema.tema_nome}-${i}`}>
                  <TooltipTrigger asChild>
                    <div
                      className={`group flex items-start gap-3 p-3 rounded-lg border-l-[3px] bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer ${corTendencia(tema.tendencia)}`}
                      onClick={() => {
                        if (tema.demanda_ids?.length) {
                          navigate(`/demandas?ids=${tema.demanda_ids.join(",")}`);
                        }
                      }}
                    >
                      {/* Número */}
                      <span className="text-[13px] font-bold text-muted-foreground/40 flex-shrink-0 w-4 text-right mt-0.5">
                        {i + 1}
                      </span>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[13px] font-semibold text-foreground truncate">{tema.tema_nome}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <TendenciaIcon tendencia={tema.tendencia} variacao={tema.variacao_pct} />
                            <span className="text-[12px] font-bold text-foreground">{tema.quantidade}</span>
                          </div>
                        </div>

                        {/* Resumo */}
                        {tema.tema_resumo && (
                          <p className="text-[11.5px] text-muted-foreground leading-snug line-clamp-1">{tema.tema_resumo}</p>
                        )}

                        {/* Tags: bairros + áreas */}
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {tema.bairros?.slice(0, 2).map((b) => (
                            <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">{b}</span>
                          ))}
                          {tema.bairros?.length > 2 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+{tema.bairros.length - 2}</span>
                          )}
                          {tema.areas?.slice(0, 1).map((a) => (
                            <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary font-medium">{a}</span>
                          ))}
                        </div>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </TooltipTrigger>

                  {/* Tooltip: sugestão legislativa */}
                  {tema.sugestao_descricao && (
                    <TooltipContent side="right" className="max-w-[240px] p-3 space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sugestão legislativa</div>
                      <p className="text-[12px] leading-snug">
                        <span className="font-medium capitalize">{tema.sugestao_tipo}</span>:{" "}
                        {tema.sugestao_descricao}
                      </p>
                      <div className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border">
                        {tema.demanda_ids?.length} demandas · clique para ver
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}

              {/* Link para Assessor IA */}
              <button
                onClick={() => navigate("/assessor-ia")}
                className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Analisar padrões no Assessor IA
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
