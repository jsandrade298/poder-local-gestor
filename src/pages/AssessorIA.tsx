import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Brain, FileText, BarChart2, ListChecks, RefreshCw,
  ChevronDown, ThumbsUp, ThumbsDown, CheckCircle2, AlertCircle,
  X, Database, Search, TrendingUp, Users, Layers, BookOpen,
  Loader2, KanbanSquare, Lightbulb, Clock, MapPin, Paperclip,
  Library, FolderOpen, MessageSquare, Plus, Menu, ChevronLeft,
  Trash2,
} from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface ToolStep {
  ferramenta: string;
  args: Record<string, unknown>;
  resultado_resumo: string;
  iteracao: number;
  duracao_ms?: number;
}

type FeedbackTipo   = "positivo" | "negativo";
type FeedbackMotivo = "informacao_incorreta" | "sugestao_inadequada" | "tom_errado" | "outro";

interface MessageFeedback { tipo: FeedbackTipo; motivo?: FeedbackMotivo; detalhe?: string; }

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolSteps?: ToolStep[];
  memorias_injetadas?: number;
  iteracoes?: number;
  feedback?: MessageFeedback;
}

interface ChatSession {
  id: string;
  title: string;
  modeId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface Modo {
  id: string;
  label: string;
  icon: React.ReactNode;
  modelo: string;
  agente?: boolean;
  description?: string;
}

// ─── Modos ─────────────────────────────────────────────────────────────────────

const MODOS: Modo[] = [
  { id: "analise",   label: "Análise",   icon: <BarChart2  size={15} />, modelo: "sabia-4",      agente: true,  description: "Agente analítico com acesso ao banco de dados" },
  { id: "pauta",     label: "Pauta",     icon: <ListChecks size={15} />, modelo: "sabia-4",      agente: true,  description: "Sugestões de pauta com dados reais" },
  { id: "resumo",    label: "Resumo",    icon: <TrendingUp size={15} />, modelo: "sabia-4",      agente: true,  description: "Resumo executivo baseado em dados" },
  { id: "redigir",   label: "Redigir",   icon: <FileText   size={15} />, modelo: "sabiazinho-4", description: "Redação de documentos oficiais" },
  { id: "consultar", label: "Consultar", icon: <BookOpen   size={15} />, modelo: "sabiazinho-4", description: "Consultas legislativas" },
];

// ─── Meta das ferramentas ───────────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: React.ReactNode; label: string; descricao: (args: Record<string, unknown>) => string }> = {
  buscar_demandas: {
    icon: <Search size={12} />,
    label: "Buscando demandas",
    descricao: (a) => [a.bairro && `em ${a.bairro}`, a.area && `área ${a.area}`, a.status && `status ${a.status}`].filter(Boolean).join(" · ") || "sem filtros",
  },
  buscar_demandas_similares: {
    icon: <Layers size={12} />,
    label: "Busca semântica",
    descricao: (a) => `"${String(a.texto_consulta || "").slice(0, 40)}…"`,
  },
  consultar_sinais: {
    icon: <TrendingUp size={12} />,
    label: "Analisando sinais",
    descricao: (a) => [a.bairro && `${a.bairro}`, a.area && `${a.area}`].filter(Boolean).join(" · ") || "todos os bairros",
  },
  consultar_relatorio: {
    icon: <BarChart2 size={12} />,
    label: "Carregando relatório estratégico",
    descricao: () => "último relatório semanal",
  },
  consultar_clusters: {
    icon: <Layers size={12} />,
    label: "Mapeando clusters temáticos",
    descricao: (a) => `últimos ${a.periodo ?? 30} dias`,
  },
  buscar_municipe: {
    icon: <Users size={12} />,
    label: "Buscando munícipe",
    descricao: (a) => String(a.nome || ""),
  },
  buscar_proposituras: {
    icon: <FileText size={12} />,
    label: "Verificando proposituras",
    descricao: (a) => [a.tipo, a.tema].filter(Boolean).join(" · ") || `últimos ${a.periodo ?? 90} dias`,
  },
  consultar_memorias: {
    icon: <Brain size={12} />,
    label: "Consultando memória do gabinete",
    descricao: (a) => `"${String(a.texto_consulta || "").slice(0, 40)}"`,
  },
  estatisticas_gerais: {
    icon: <Database size={12} />,
    label: "Calculando estatísticas",
    descricao: (a) => `últimos ${a.periodo ?? 30} dias`,
  },
  consultar_tarefas_kanban: {
    icon: <KanbanSquare size={12} />,
    label: "Consultando kanban",
    descricao: (a) => [a.kanban_type, a.posicao].filter(Boolean).join(" · ") || "todos os quadros",
  },
  consultar_dados_eleitorais: {
    icon: <MapPin size={12} />,
    label: "Consultando dados eleitorais",
    descricao: (a) => [a.regiao, a.eleicao, a.cargo].filter(Boolean).join(" · ") || "todas as regiões",
  },
};

// ─── Tooltip ───────────────────────────────────────────────────────────────────

function Tooltip({ children, text, side = "right" }: {
  children: React.ReactNode;
  text: string;
  side?: "right" | "top" | "bottom";
}) {
  const [show, setShow] = useState(false);
  const posClass =
    side === "right"  ? "left-full ml-2 top-1/2 -translate-y-1/2" :
    side === "top"    ? "bottom-full mb-2 left-1/2 -translate-x-1/2" :
                        "top-full mt-2 left-1/2 -translate-x-1/2";

  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className={`absolute z-50 ${posClass} pointer-events-none whitespace-nowrap bg-gray-900 text-white text-[11px] px-2 py-1 rounded-md shadow-lg`}>
          {text}
        </span>
      )}
    </span>
  );
}

// ─── ThinkingIndicator ─────────────────────────────────────────────────────────

function ThinkingIndicator({ steps, isLoading }: { steps: ToolStep[]; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasSteps = steps.length > 0;

  useEffect(() => { if (isLoading) setExpanded(true); }, [isLoading]);

  if (!isLoading && !hasSteps) return null;

  const ultimaFerramenta = steps[steps.length - 1]?.ferramenta;
  const metaUltima       = ultimaFerramenta ? TOOL_META[ultimaFerramenta] : null;

  return (
    <div className="my-2 rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/80 to-white overflow-hidden text-xs shadow-sm">
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left">
        {isLoading ? (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 shrink-0">
            <Loader2 size={11} className="animate-spin text-indigo-600" />
          </span>
        ) : (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 shrink-0">
            <Lightbulb size={11} className="text-indigo-600" />
          </span>
        )}
        <span className="flex-1 text-indigo-700 font-medium">
          {isLoading
            ? metaUltima ? metaUltima.label + "…" : "Pensando…"
            : `${steps.length} consulta${steps.length !== 1 ? "s" : ""} realizadas`}
        </span>
        {hasSteps && (
          <span className="flex items-center gap-1.5 text-indigo-400">
            <span className="font-mono text-[11px]">{steps.length} passo{steps.length !== 1 ? "s" : ""}</span>
            <ChevronDown size={13} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </span>
        )}
      </button>

      {isLoading && (
        <div className="h-0.5 bg-indigo-100 mx-3.5 mb-1 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: steps.length === 0 ? "8%" : `${Math.min(15 + steps.length * 12, 88)}%` }}
          />
        </div>
      )}

      {expanded && hasSteps && (
        <div className="border-t border-indigo-100 divide-y divide-indigo-50">
          {steps.map((step, i) => {
            const meta        = TOOL_META[step.ferramenta];
            const isLast      = i === steps.length - 1;
            const emAndamento = isLoading && isLast;
            return (
              <div key={i} className={`flex items-start gap-2.5 px-3.5 py-2 ${emAndamento ? "bg-indigo-50/60" : ""}`}>
                <span className="mt-0.5 shrink-0 w-4 flex justify-center">
                  {emAndamento
                    ? <Loader2 size={12} className="animate-spin text-indigo-500" />
                    : <CheckCircle2 size={12} className="text-emerald-500" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-indigo-800 font-medium">
                    <span className="text-indigo-400">{meta?.icon}</span>
                    <span>{meta?.label ?? step.ferramenta}</span>
                    {meta && (
                      <span className="text-indigo-400 font-normal truncate">
                        · {meta.descricao(step.args)}
                      </span>
                    )}
                  </div>
                  {!emAndamento && (
                    <div className="text-indigo-400 mt-0.5 truncate">{step.resultado_resumo}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-indigo-300 mt-0.5">
                  {step.duracao_ms !== undefined && (
                    <span className="flex items-center gap-0.5">
                      <Clock size={10} />
                      {step.duracao_ms < 1000 ? `${step.duracao_ms}ms` : `${(step.duracao_ms / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-400 px-1 py-0 h-4">
                    #{step.iteracao}
                  </Badge>
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex items-center gap-2.5 px-3.5 py-2 bg-indigo-50/40">
              <span className="w-4 flex justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
              </span>
              <span className="text-indigo-400 italic">aguardando próxima etapa…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MarkdownContent ───────────────────────────────────────────────────────────
// Renderiza markdown com tabelas, negrito, emojis, etc.

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-gray-800
      prose-headings:font-semibold prose-headings:text-gray-900
      prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
      prose-strong:text-gray-900
      prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
      prose-table:text-xs prose-table:w-full
      prose-th:bg-indigo-50 prose-th:text-indigo-700 prose-th:font-semibold prose-th:px-2 prose-th:py-1.5
      prose-td:px-2 prose-td:py-1.5 prose-td:border-gray-200
      prose-tr:border-gray-100
      prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
      prose-p:my-1.5 prose-p:leading-relaxed
      prose-code:bg-indigo-50 prose-code:text-indigo-700 prose-code:px-1 prose-code:rounded prose-code:text-xs
      prose-blockquote:border-indigo-300 prose-blockquote:text-gray-600
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── FeedbackModal ─────────────────────────────────────────────────────────────

function FeedbackModal({ messageId, onClose, onSaved, tenantId, modeId }: {
  messageId: string; onClose: () => void;
  onSaved: (m: FeedbackMotivo, d?: string) => void;
  tenantId: string; modeId: string;
}) {
  const [motivo, setMotivo] = useState<FeedbackMotivo>("informacao_incorreta");
  const [detalhe, setDetalhe] = useState("");
  const [saving, setSaving]   = useState(false);

  const MOTIVOS: { value: FeedbackMotivo; label: string }[] = [
    { value: "informacao_incorreta",  label: "Informação incorreta" },
    { value: "sugestao_inadequada",   label: "Sugestão inadequada para o gabinete" },
    { value: "tom_errado",            label: "Tom ou linguagem inapropriados" },
    { value: "outro",                 label: "Outro" },
  ];

  async function handleSalvar() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/registrar-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ message_id: messageId, tipo: "negativo", motivo, detalhe: detalhe.trim() || undefined, modo_id: modeId, tenant_id: tenantId }),
      });
      onSaved(motivo, detalhe.trim() || undefined);
      onClose();
    } catch { toast.error("Erro ao registrar feedback"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">O que houve de errado?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-2 mb-4">
          {MOTIVOS.map((m) => (
            <label key={m.value} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${motivo === m.value ? "border-red-400 bg-red-50 text-red-800" : "border-gray-200 hover:bg-gray-50"}`}>
              <input type="radio" name="motivo" value={m.value} checked={motivo === m.value} onChange={() => setMotivo(m.value)} className="accent-red-500" />
              {m.label}
            </label>
          ))}
        </div>
        <Textarea placeholder="Detalhes adicionais (opcional)" value={detalhe} onChange={(e) => setDetalhe(e.target.value.slice(0, 500))} className="mb-4 text-sm resize-none" rows={2} />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant="destructive" onClick={handleSalvar} disabled={saving}>
            {saving && <Loader2 size={13} className="animate-spin mr-1" />}Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── PainelMemorias ─────────────────────────────────────────────────────────────

function PainelMemorias({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: memorias = [], isLoading } = useQuery({
    queryKey: ["memorias-ia", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenant_memoria_ia")
        .select("id, categoria, conteudo, confianca, vezes_usado, atualizado_em")
        .eq("tenant_id", tenantId).eq("ativo", true)
        .order("confianca", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const CAT: Record<string, { emoji: string; label: string; color: string }> = {
    fato_gabinete:           { emoji: "🏛️", label: "Fatos do gabinete",           color: "text-indigo-700" },
    padrao_descoberto:       { emoji: "📊", label: "Padrões descobertos",          color: "text-emerald-700" },
    preferencia_comunicacao: { emoji: "💬", label: "Preferências de comunicação",  color: "text-amber-700" },
    correcao:                { emoji: "⚠️", label: "Correções",                    color: "text-red-700" },
  };

  const byCategory = memorias.reduce((acc: Record<string, typeof memorias>, m) => {
    acc[m.categoria] = acc[m.categoria] || []; acc[m.categoria].push(m); return acc;
  }, {});

  async function remover(id: string) {
    await supabase.from("tenant_memoria_ia").update({ ativo: false }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["memorias-ia", tenantId] });
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-white shadow-2xl flex flex-col border-l border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-indigo-600" />
          <span className="font-semibold text-sm text-gray-800">Memória do Gabinete</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={17} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {isLoading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>}
        {!isLoading && !memorias.length && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Brain size={32} className="mx-auto mb-2 opacity-30" />
            Nenhuma memória ainda.
          </div>
        )}
        {Object.entries(CAT).map(([cat, meta]) => {
          const lista = byCategory[cat] || [];
          if (!lista.length) return null;
          return (
            <div key={cat}>
              <div className={`text-xs font-semibold mb-1.5 ${meta.color}`}>{meta.emoji} {meta.label}</div>
              <div className="space-y-1.5">
                {lista.map((m) => (
                  <div key={m.id} className="group relative bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <p className="text-xs text-gray-700 pr-5">{m.conteudo}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
                        <div className={`h-full rounded-full ${m.confianca >= 0.8 ? "bg-green-400" : m.confianca >= 0.6 ? "bg-yellow-400" : "bg-red-400"}`}
                          style={{ width: `${Math.round(m.confianca * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400">{Math.round(m.confianca * 100)}%</span>
                      <span className="text-[10px] text-gray-400">{m.vezes_usado}×</span>
                    </div>
                    <button onClick={() => remover(m.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
        {memorias.length} memória{memorias.length !== 1 ? "s" : ""} ativa{memorias.length !== 1 ? "s" : ""} · Decaimento: 60 dias sem uso
      </div>
    </div>
  );
}

// ─── MessageBubble ──────────────────────────────────────────────────────────────

function MessageBubble({ message, tenantId, modeId, isLoadingTools, onFeedback }: {
  message: Message; tenantId: string; modeId: string;
  isLoadingTools?: boolean;
  onFeedback: (id: string, fb: MessageFeedback) => void;
}) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  async function handlePositive() {
    if (message.feedback) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/registrar-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ message_id: message.id, tipo: "positivo", modo_id: modeId, tenant_id: tenantId }),
      });
      onFeedback(message.id, { tipo: "positivo" });
      toast.success("Feedback registrado!");
    } catch { toast.error("Erro ao registrar feedback"); }
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 max-w-[92%]">
      {((message.toolSteps && message.toolSteps.length > 0) || isLoadingTools) && (
        <ThinkingIndicator steps={message.toolSteps || []} isLoading={!!isLoadingTools} />
      )}

      {/* Resposta com markdown */}
      {message.content && (
        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 border border-gray-100 shadow-sm">
          <MarkdownContent content={message.content} />

          {(message.memorias_injetadas || message.iteracoes) ? (
            <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-gray-100">
              {!!message.memorias_injetadas && (
                <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                  <Brain size={11} /> {message.memorias_injetadas} memórias
                </span>
              )}
              {!!message.iteracoes && (
                <span className="text-[11px] text-blue-400 flex items-center gap-1">
                  <RefreshCw size={11} /> {message.iteracoes} iterações
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Feedback */}
      {message.content && (
        <div className="flex items-center gap-1 mt-0.5 ml-1">
          <Tooltip text="Resposta útil" side="top">
            <button onClick={handlePositive} disabled={!!message.feedback}
              className={`p-1 rounded transition-colors ${message.feedback?.tipo === "positivo" ? "text-green-500" : "text-gray-300 hover:text-green-500"}`}>
              {message.feedback?.tipo === "positivo" ? <CheckCircle2 size={14} /> : <ThumbsUp size={14} />}
            </button>
          </Tooltip>
          <Tooltip text="Reportar problema" side="top">
            <button onClick={() => !message.feedback && setShowFeedbackModal(true)} disabled={!!message.feedback}
              className={`p-1 rounded transition-colors ${message.feedback?.tipo === "negativo" ? "text-red-500" : "text-gray-300 hover:text-red-500"}`}>
              {message.feedback?.tipo === "negativo" ? <AlertCircle size={14} /> : <ThumbsDown size={14} />}
            </button>
          </Tooltip>
        </div>
      )}

      {showFeedbackModal && (
        <FeedbackModal
          messageId={message.id} tenantId={tenantId} modeId={modeId}
          onClose={() => setShowFeedbackModal(false)}
          onSaved={(motivo, detalhe) => onFeedback(message.id, { tipo: "negativo", motivo, detalhe })}
        />
      )}
    </div>
  );
}

// ─── Helpers de sessão ─────────────────────────────────────────────────────────

function gerarTitulo(msgs: Message[]): string {
  const primeiro = msgs.find((m) => m.role === "user");
  if (!primeiro) return "Nova conversa";
  return primeiro.content.slice(0, 42) + (primeiro.content.length > 42 ? "…" : "");
}

function carregarSessoes(): ChatSession[] {
  try { return JSON.parse(localStorage.getItem("assessor_ia_sessoes") || "[]"); } catch { return []; }
}

function salvarSessoes(s: ChatSession[]) {
  localStorage.setItem("assessor_ia_sessoes", JSON.stringify(s.slice(0, 30))); // máx 30 sessões
}

// ─── AssessorIA ─────────────────────────────────────────────────────────────────

export default function AssessorIA() {
  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState("");
  const [modeId, setModeId]             = useState("analise");
  const [tenantId, setTenantId]         = useState<string | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [showMemorias, setShowMemorias] = useState(false);
  const [loadingMsgId, setLoadingMsgId] = useState<string | null>(null);
  const [sessoes, setSessoes]           = useState<ChatSession[]>(carregarSessoes);
  const [sessaoAtualId, setSessaoAtualId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false); // mobile
  const bottomRef                        = useRef<HTMLDivElement>(null);
  const fileInputRef                     = useRef<HTMLInputElement>(null);
  const modoAtual                        = MODOS.find((m) => m.id === modeId) ?? MODOS[0];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("tenant_id").eq("id", user.id).single()
        .then(({ data }) => setTenantId(data?.tenant_id || null));
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Salva sessão atual no localStorage sempre que messages mudar
  useEffect(() => {
    if (messages.length === 0) return;
    setSessoes((prev) => {
      const titulo = gerarTitulo(messages);
      const agora  = Date.now();
      if (sessaoAtualId) {
        const nova = prev.map((s) =>
          s.id === sessaoAtualId ? { ...s, title: titulo, messages, modeId, updatedAt: agora } : s
        );
        salvarSessoes(nova);
        return nova;
      } else {
        const novoId = crypto.randomUUID();
        setSessaoAtualId(novoId);
        const nova = [{ id: novoId, title: titulo, modeId, messages, createdAt: agora, updatedAt: agora }, ...prev];
        salvarSessoes(nova);
        return nova;
      }
    });
  }, [messages]);

  const triggerExtrairMemorias = useCallback(async (historico: Message[]) => {
    if (!tenantId || !["analise", "pauta", "resumo"].includes(modeId)) return;
    if (historico.filter((m) => m.role === "assistant").length < 2) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extrair-memorias`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ historico: historico.map((m) => ({ role: m.role, content: m.content })), modoId: modeId }),
      });
    } catch { /* fire and forget */ }
  }, [tenantId, modeId]);

  function handleModoChange(novoModoId: string) {
    if (novoModoId === modeId) return;
    if (messages.length > 0) triggerExtrairMemorias(messages);
    setModeId(novoModoId);
    setMessages([]);
    setSessaoAtualId(null);
  }

  function novaConversa() {
    if (messages.length > 0) triggerExtrairMemorias(messages);
    setMessages([]);
    setSessaoAtualId(null);
    setSidebarOpen(false);
  }

  function abrirSessao(sessao: ChatSession) {
    if (messages.length > 0) triggerExtrairMemorias(messages);
    setMessages(sessao.messages);
    setModeId(sessao.modeId);
    setSessaoAtualId(sessao.id);
    setSidebarOpen(false);
  }

  function removerSessao(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSessoes((prev) => {
      const nova = prev.filter((s) => s.id !== id);
      salvarSessoes(nova);
      return nova;
    });
    if (sessaoAtualId === id) {
      setMessages([]);
      setSessaoAtualId(null);
    }
  }

  async function handleSend() {
    if (!input.trim() || isLoading) return;

    const userMsg: Message   = { id: crypto.randomUUID(), role: "user", content: input.trim() };
    const assistantMsgId     = crypto.randomUUID();
    const placeholder: Message = { id: assistantMsgId, role: "assistant", content: "", toolSteps: [] };

    setMessages((prev) => [...prev, userMsg, placeholder]);
    setInput("");
    setIsLoading(true);
    setLoadingMsgId(assistantMsgId);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Tenta streaming via SSE; fallback para JSON normal
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          message: userMsg.content,
          conversationHistory: messages.filter((m) => m.content).map((m) => ({ role: m.role, content: m.content })),
          modeId,
          model: modoAtual.modelo,
          stream: true,  // sinaliza ao backend que queremos tool_steps em tempo real
        }),
      });

      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || `HTTP ${resp.status}`); }

      const contentType = resp.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        // ── Streaming SSE: cada evento pode ser um tool_step ou a resposta final ──
        const reader  = resp.body!.getReader();
        const decoder = new TextDecoder();
        let   buffer  = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") break;
            try {
              const evt = JSON.parse(raw);
              if (evt.type === "tool_step") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, toolSteps: [...(m.toolSteps ?? []), evt.step] }
                      : m
                  )
                );
              } else if (evt.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: evt.message || "", toolSteps: evt.tool_steps || m.toolSteps, memorias_injetadas: evt.memorias_injetadas || 0, iteracoes: evt.iteracoes || 0 }
                      : m
                  )
                );
              }
            } catch { /* ignora linha malformada */ }
          }
        }
      } else {
        // ── Resposta JSON normal (fallback) ──────────────────────────────────────
        const data = await resp.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: data.message || "", toolSteps: data.tool_steps || [], memorias_injetadas: data.memorias_injetadas || 0, iteracoes: data.iteracoes || 0 }
              : m
          )
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro: ${msg}`);
      setMessages((prev) => prev.map((m) => m.id === assistantMsgId ? { ...m, content: `Não foi possível processar: ${msg}` } : m));
    } finally {
      setIsLoading(false);
      setLoadingMsgId(null);
    }
  }

  function handleFeedback(msgId: string, fb: MessageFeedback) {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, feedback: fb } : m)));
  }

  function handleAnexar() {
    fileInputRef.current?.click();
  }

  function handleArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.info(`Arquivo "${file.name}" selecionado — funcionalidade em desenvolvimento.`);
    e.target.value = "";
  }

  const SUGESTOES = [
    "Quais bairros têm mais demandas abertas este mês?",
    "Há anomalias estatísticas nos últimos 30 dias?",
    "Qual área está com pior taxa de resolução?",
    "Quais temas emergentes aparecem nos clusters?",
  ];

  // ── Sidebar de histórico de chats ─────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Brain size={17} className="text-indigo-600" />
            <span className="font-bold text-gray-900 text-sm">Assessor IA</span>
          </div>
          <span className="text-[11px] text-gray-400 pl-6">Fase 2 · Agente</span>
        </div>
        {/* Fechar no mobile */}
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600">
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Modos */}
      <div className="px-2 mt-2">
        <p className="text-[10px] uppercase font-semibold text-gray-400 px-2 mb-1.5 tracking-wide">Modo</p>
        {MODOS.map((m) => (
          <Tooltip key={m.id} text={m.description ?? m.label} side="right">
            <button onClick={() => handleModoChange(m.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors text-left ${modeId === m.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
              <span className={modeId === m.id ? "text-indigo-600" : "text-gray-400"}>{m.icon}</span>
              <span className="flex-1">{m.label}</span>
              {m.agente && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${modeId === m.id ? "bg-indigo-400" : "bg-gray-200"}`} title="Modo agente" />}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Histórico */}
      <div className="px-2 mt-3 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-2 mb-1.5">
          <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wide">Conversas</p>
          <Tooltip text="Nova conversa" side="top">
            <button onClick={novaConversa} className="text-gray-400 hover:text-indigo-600 transition-colors">
              <Plus size={13} />
            </button>
          </Tooltip>
        </div>
        {sessoes.length === 0 && (
          <p className="text-[11px] text-gray-300 px-2 py-1">Nenhuma conversa salva</p>
        )}
        {sessoes.map((s) => (
          <div key={s.id}
            onClick={() => abrirSessao(s)}
            className={`group relative flex items-start gap-2 px-2.5 py-2 rounded-lg mb-0.5 cursor-pointer transition-colors text-left ${sessaoAtualId === s.id ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <MessageSquare size={13} className="mt-0.5 shrink-0 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{s.title}</p>
              <p className="text-[10px] text-gray-400">
                {MODOS.find((m) => m.id === s.modeId)?.label} · {s.messages.length} msgs
              </p>
            </div>
            <button
              onClick={(e) => removerSessao(s.id, e)}
              className="shrink-0 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div className="px-2 pb-4 mt-2 space-y-0.5 border-t border-gray-100 pt-2">
        {tenantId && (
          <Tooltip text="Ver memórias do gabinete" side="right">
            <button onClick={() => setShowMemorias(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Brain size={15} className="text-indigo-500" /> Memória
            </button>
          </Tooltip>
        )}
        <Tooltip text="Iniciar nova conversa" side="right">
          <button onClick={novaConversa}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={15} className="text-gray-400" /> Nova conversa
          </button>
        </Tooltip>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">

      {/* ── Overlay mobile ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Sidebar mobile (drawer) ── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 md:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <SidebarContent />
      </aside>

      {/* ── Chat ── */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Hamburguer mobile */}
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 hover:text-gray-700 mr-1">
              <Menu size={18} />
            </button>
            <span className="font-semibold text-gray-800 text-sm">{modoAtual.label}</span>
            {modoAtual.agente && (
              <Tooltip text="Modo agente com acesso a ferramentas do gabinete" side="bottom">
                <Badge variant="secondary" className="text-[11px] bg-indigo-50 text-indigo-600 border-indigo-200 font-normal cursor-default">
                  agente · 11 ferramentas
                </Badge>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-2">
            {modoAtual.agente && tenantId && (
              <Tooltip text="Ver memórias do gabinete" side="bottom">
                <button onClick={() => setShowMemorias(true)}
                  className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                  <Brain size={13} />
                  <span className="hidden sm:inline">Memória ativa</span>
                </button>
              </Tooltip>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
              <Brain size={36} className="opacity-10 text-indigo-600" />
              <p className="text-sm text-gray-400 max-w-xs">
                {modoAtual.agente
                  ? "Faça uma pergunta. O agente consultará os dados do gabinete automaticamente."
                  : "Como posso ajudar?"}
              </p>
              {modoAtual.agente && (
                <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
                  {SUGESTOES.map((s) => (
                    <button key={s} onClick={() => setInput(s)}
                      className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors shadow-sm text-left">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              tenantId={tenantId || ""}
              modeId={modeId}
              isLoadingTools={m.id === loadingMsgId && isLoading}
              onFeedback={handleFeedback}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input toolbar */}
        <div className="bg-white border-t border-gray-200 px-3 md:px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Botões de ação */}
            <div className="flex items-center gap-1 mb-2">
              <Tooltip text="Anexar arquivo" side="top">
                <button onClick={handleAnexar}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors border border-gray-200">
                  <Paperclip size={13} /> <span className="hidden sm:inline">Anexar</span>
                </button>
              </Tooltip>
              <Tooltip text="Abrir biblioteca de documentos" side="top">
                <button onClick={() => toast.info("Biblioteca — em desenvolvimento.")}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors border border-gray-200">
                  <Library size={13} /> <span className="hidden sm:inline">Biblioteca</span>
                </button>
              </Tooltip>
              <Tooltip text="Abrir painel de demandas" side="top">
                <button onClick={() => toast.info("Demandas — em desenvolvimento.")}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors border border-gray-200">
                  <FolderOpen size={13} /> <span className="hidden sm:inline">Demandas</span>
                </button>
              </Tooltip>
            </div>

            {/* Área de texto + enviar */}
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={modoAtual.agente ? "Pergunte sobre demandas, bairros, tendências…" : "Digite sua mensagem…"}
                className="flex-1 resize-none text-sm min-h-[42px] max-h-32"
                rows={1}
                disabled={isLoading}
              />
              <Tooltip text="Enviar (Enter)" side="top">
                <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="sm"
                  className="h-[42px] px-4 bg-indigo-600 hover:bg-indigo-700 shrink-0">
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
              </Tooltip>
            </div>
            <p className="text-center text-[10px] text-gray-300 mt-1.5">
              {modoAtual.agente ? "Sabiá-4 · agente · Enter para enviar" : "Sabiazinho-4 · Enter para enviar"}
            </p>
          </div>
        </div>
      </main>

      {/* Input de arquivo oculto */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleArquivoSelecionado}
        accept=".pdf,.doc,.docx,.txt,.csv,.xlsx" />

      {/* Painel memórias */}
      {showMemorias && tenantId && (
        <>
          <div className="fixed inset-0 z-30 bg-black/10" onClick={() => setShowMemorias(false)} />
          <PainelMemorias tenantId={tenantId} onClose={() => setShowMemorias(false)} />
        </>
      )}
    </div>
  );
}
