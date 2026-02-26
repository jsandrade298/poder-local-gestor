import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingUp, AlertTriangle, Sparkles, Loader2,
  RefreshCw, ChevronDown, ChevronUp, Gavel, Eye, Clock,
  MapPin, Repeat2, BarChart2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface TemaItem {
  nome: string;
  relevancia: "alta" | "media" | "baixa";
  quantidade: number;
  descricao: string;
  bairros_afetados: string[];
  sinal: "anomalia" | "aceleracao" | "cronica" | "reincidencia" | "semantico";
}
interface AlertaItem {
  tipo: "surto" | "cronicidade" | "reincidencia" | "baixa_resolucao";
  descricao: string;
  urgencia: "alta" | "media";
  area_bairro: string;
}
interface SugestaoItem {
  tipo: string;
  titulo: string;
  justificativa: string;
  prioridade: "alta" | "media";
  base_dados: string;
}
interface OportunidadeItem { descricao: string; contexto: string; }
interface Relatorio {
  titulo: string;
  resumo_executivo: string;
  temas_prioritarios: TemaItem[];
  alertas: AlertaItem[];
  sugestoes_legislativas: SugestaoItem[];
  oportunidades_politicas: OportunidadeItem[];
  observacoes?: string;
}
interface RelatorioRow {
  relatorio: Relatorio;
  gerado_em: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_demandas_analisadas: number;
  total_sinais_usados: number;
}

const SINAL_CONFIG = {
  anomalia:    { icon: BarChart2,  label: "Anomalia",    color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950/20"      },
  aceleracao:  { icon: TrendingUp, label: "Aceleração",  color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/20"},
  cronica:     { icon: Clock,      label: "Crônica",     color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/20"  },
  reincidencia:{ icon: Repeat2,    label: "Reincidência",color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/20"},
  semantico:   { icon: Sparkles,   label: "Semântico",   color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/20"    },
};
const ALERTA_BORDER = {
  surto: "border-l-red-400", cronicidade: "border-l-amber-400",
  reincidencia: "border-l-violet-400", baixa_resolucao: "border-l-orange-400",
};

function SinalBadge({ sinal }: { sinal: TemaItem["sinal"] }) {
  const cfg = SINAL_CONFIG[sinal] ?? SINAL_CONFIG.semantico;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />{cfg.label}
    </span>
  );
}

function RelevanciaBar({ r }: { r: TemaItem["relevancia"] }) {
  const w = r === "alta" ? "w-full" : r === "media" ? "w-2/3" : "w-1/3";
  const c = r === "alta" ? "bg-red-400" : r === "media" ? "bg-amber-400" : "bg-muted-foreground/30";
  return (
    <div className="w-[6px] self-stretch rounded bg-muted overflow-hidden flex-shrink-0">
      <div className={`w-full ${w === "w-full" ? "h-full" : w === "w-2/3" ? "h-2/3" : "h-1/3"} ${c} rounded`} />
    </div>
  );
}

type SectionId = "temas" | "alertas" | "sugestoes" | "oportunidades" | null;

export function TemasDaSemana() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [gerando, setGerando] = useState(false);
  const [expandido, setExpandido] = useState<SectionId>("temas");
  const [sugestaoAberta, setSugestaoAberta] = useState<number | null>(null);

  const { data: row, isLoading, refetch } = useQuery<RelatorioRow | null>({
    queryKey: ["relatorio-semanal", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return null;
      const { data, error } = await supabase
        .from("relatorio_semanal")
        .select("relatorio,gerado_em,periodo_inicio,periodo_fim,total_demandas_analisadas,total_sinais_usados")
        .eq("tenant_id", profile.tenant_id)
        .order("gerado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as RelatorioRow | null;
    },
    enabled: !!profile?.tenant_id,
    staleTime: 1000 * 60 * 15,
  });

  // ── Navegar para Assessor IA com modo e prompt pré-definidos ─────────────
  const navegarAssessor = (modeId: string, prompt: string) => {
    sessionStorage.setItem("assessorIA_promptData", JSON.stringify({ modeId, directPrompt: prompt }));
    navigate("/assessor-ia");
  };

  const gerarRelatorio = async (forcar = false) => {
    if (!profile?.tenant_id) {
      toast({ title: "Erro", description: "Tenant não identificado.", variant: "destructive" });
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-relatorio", {
        body: { tenant_id: profile.tenant_id, periodo_dias: 30, forcar },
      });
      if (error) throw error;
      if (data?.cached) {
        toast({ title: "Relatório recente", description: "Gerado há menos de 6h. Clique em 🔄 para forçar regeneração." });
      } else {
        toast({ title: "✅ Análise concluída!", description: `${data?.total_demandas ?? 0} demandas analisadas com ${data?.sinais_usados ?? 0} sinais.` });
      }
      await refetch();
    } catch (err) {
      toast({ title: "Erro na análise", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  const rel = row?.relatorio;
  const geradoEm = row?.gerado_em
    ? new Date(row.gerado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  const Section = ({ id, label, count, icon: Icon, children }: {
    id: SectionId; label: string; count: number; icon: React.ElementType; children: React.ReactNode;
  }) => (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpandido(expandido === id ? null : id)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors"
      >
        <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-[12.5px] font-semibold text-foreground text-left">{label}</span>
        <span className="text-[11px] font-bold text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">{count}</span>
        {expandido === id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {expandido === id && <div className="divide-y divide-border">{children}</div>}
    </div>
  );

  return (
    <TooltipProvider>
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              Análise Estratégica da Semana
            </CardTitle>
            {geradoEm && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Atualizado em {geradoEm}{row?.total_demandas_analisadas ? ` · ${row.total_demandas_analisadas} demandas` : ""}
              </p>
            )}
          </div>
          {rel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => gerarRelatorio(true)} disabled={gerando}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40">
                  <RefreshCw className={`w-3.5 h-3.5 ${gerando ? "animate-spin" : ""}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-[11px]">Regenerar análise</TooltipContent>
            </Tooltip>
          )}
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando análise…
            </div>
          ) : !rel ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Análise ainda não gerada</p>
                <p className="text-[12px] text-muted-foreground mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Combina análise estatística (anomalias, cronicidade, reincidências) com clustering semântico para identificar padrões e oportunidades legislativas.
                </p>
              </div>
              <button onClick={() => gerarRelatorio()} disabled={gerando}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {gerando ? "Analisando…" : "Gerar análise agora"}
              </button>
            </div>
          ) : (
            <>
              {/* Resumo executivo */}
              <div className="px-3.5 py-3 rounded-lg bg-primary/5 border border-primary/15">
                <p className="text-[12.5px] text-foreground leading-relaxed">{rel.resumo_executivo}</p>
              </div>

              {/* Temas prioritários */}
              {(rel.temas_prioritarios?.length ?? 0) > 0 && (
                <Section id="temas" label="Temas Prioritários" count={rel.temas_prioritarios.length} icon={BarChart2}>
                  {rel.temas_prioritarios.map((t, i) => (
                    <div key={i} className="px-3.5 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                      <RelevanciaBar r={t.relevancia} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[13px] font-semibold">{t.nome}</span>
                          <SinalBadge sinal={t.sinal} />
                          <span className="ml-auto text-[13px] font-bold flex-shrink-0">{t.quantidade}</span>
                        </div>
                        <p className="text-[11.5px] text-muted-foreground leading-snug mb-1.5">{t.descricao}</p>
                        {t.bairros_afetados?.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <MapPin className="w-2.5 h-2.5 text-muted-foreground/50 flex-shrink-0" />
                            {t.bairros_afetados.slice(0, 3).map((b) => (
                              <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">{b}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {/* Alertas */}
              {(rel.alertas?.length ?? 0) > 0 && (
                <Section id="alertas" label="Alertas" count={rel.alertas.length} icon={AlertTriangle}>
                  {rel.alertas.map((a, i) => (
                    <div key={i} className={`mx-3.5 my-2 pl-3 border-l-[3px] rounded-r-lg bg-muted/20 py-2.5 pr-3 ${ALERTA_BORDER[a.tipo] ?? "border-l-border"}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {a.tipo.replace(/_/g, " ")}
                        </span>
                        {a.urgencia === "alta" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400">URGENTE</span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-foreground leading-snug">{a.descricao}</p>
                      {a.area_bairro && <p className="text-[11px] text-muted-foreground mt-0.5">{a.area_bairro}</p>}
                    </div>
                  ))}
                </Section>
              )}

              {/* Sugestões legislativas */}
              {(rel.sugestoes_legislativas?.length ?? 0) > 0 && (
                <Section id="sugestoes" label="Sugestões Legislativas" count={rel.sugestoes_legislativas.length} icon={Gavel}>
                  {rel.sugestoes_legislativas.map((s, i) => (
                    <div key={i} className="px-3.5 py-3">
                      <button onClick={() => setSugestaoAberta(sugestaoAberta === i ? null : i)}
                        className="w-full flex items-start gap-2.5 text-left">
                        <span className={`flex-shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          s.prioridade === "alta" ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        }`}>{s.tipo}</span>
                        <p className="flex-1 text-[13px] font-semibold leading-snug">{s.titulo}</p>
                        {sugestaoAberta === i ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />}
                      </button>
                      {sugestaoAberta === i && (
                        <div className="mt-2 ml-14 space-y-1.5">
                          <p className="text-[12px] text-muted-foreground leading-relaxed">{s.justificativa}</p>
                          <p className="text-[11px] text-muted-foreground/60 italic">{s.base_dados}</p>
                          <button onClick={() => navegarAssessor("redigir",
                            `Preciso redigir uma ${s.tipo} com base na seguinte análise do gabinete:\n\n` +
                            `📋 PROPOSITURA SUGERIDA: ${s.titulo}\n` +
                            `📊 JUSTIFICATIVA: ${s.justificativa}\n` +
                            `🔍 BASE DE DADOS: ${s.base_dados}\n\n` +
                            `Selecione um modelo na Biblioteca de Documentos e redija a propositura completa, incorporando os dados acima como fundamento.`
                          )}
                            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline mt-0.5">
                            <Gavel className="w-3 h-3" /> Redigir no Assessor IA
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {/* Oportunidades políticas */}
              {(rel.oportunidades_politicas?.length ?? 0) > 0 && (
                <Section id="oportunidades" label="Oportunidades de Plenário" count={rel.oportunidades_politicas.length} icon={Eye}>
                  {rel.oportunidades_politicas.map((o, i) => (
                    <div key={i} className="px-3.5 py-3">
                      <p className="text-[13px] font-medium leading-snug mb-0.5">{o.descricao}</p>
                      <p className="text-[11.5px] text-muted-foreground leading-snug">{o.contexto}</p>
                    </div>
                  ))}
                </Section>
              )}

              {/* Rodapé */}
              <div className="flex items-center justify-between pt-1 gap-2">
                {rel.observacoes && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-[11px] text-muted-foreground/60 italic truncate cursor-help">ℹ {rel.observacoes}</p>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] text-[11px]">{rel.observacoes}</TooltipContent>
                  </Tooltip>
                )}
                <button onClick={() => {
                  const temas = rel.temas_prioritarios?.slice(0, 3).map((t: any) =>
                    `• ${t.nome} (${t.quantidade} dem.) — ${t.descricao}`).join("\n") ?? "";
                  const sugestoes = rel.sugestoes_legislativas?.slice(0, 2).map((s: any) =>
                    `• ${s.tipo}: ${s.titulo}`).join("\n") ?? "";
                  navegarAssessor("analise",
                    `Com base no relatório estratégico da semana, faça uma análise aprofundada:\n\n` +
                    `📊 RESUMO: ${rel.resumo_executivo}\n\n` +
                    `🎯 TEMAS PRIORITÁRIOS:\n${temas}\n\n` +
                    `📋 SUGESTÕES PENDENTES:\n${sugestoes}\n\n` +
                    `Aprofunde a análise identificando padrões adicionais, cruzamentos entre temas e quais ações são mais urgentes para o gabinete esta semana.`
                  );
                }}
                  className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  <Sparkles className="w-3 h-3" /> Aprofundar no Assessor IA
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
