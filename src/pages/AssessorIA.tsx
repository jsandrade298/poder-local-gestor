import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BibliotecaDocumentosDialog } from "@/components/forms/BibliotecaDocumentosDialog";
import { MarkdownText } from "@/components/ui/markdown-text";
import {
  Bot, Plus, Loader2, Send, X, FileText, ChevronDown, Trash2,
  Search, Paperclip, PanelLeft, ThumbsUp, ThumbsDown, Brain,
  RefreshCw, AlertCircle, CheckCircle2, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  modeId?: string;
  model?: string;
  feedback?: "positivo" | "negativo" | null;
}

interface DocumentoModelo {
  id: string;
  nome: string;
  categoria: string;
  tipo_arquivo: string;
  tamanho_arquivo: number;
  url_arquivo: string;
  conteudo_extraido: string;
  created_at: string;
}

interface AnexoChat {
  nome: string;
  conteudo: string;
  tamanho: number;
}

interface DemandaContext {
  id: string;
  protocolo: string;
  titulo: string;
  municipe?: string;
  area?: string;
  bairro?: string;
  status?: string;
}

interface HistoryItem {
  id: string;
  title: string;
  modeId: string;
  modeIcon: string;
  modeColor: string;
  timestamp: number;
  demandaTag?: string;
}

interface MemoriaIA {
  id: string;
  categoria: "fato_gabinete" | "padrao_descoberto" | "preferencia_comunicacao" | "correcao";
  conteudo: string;
  confianca: number;
  vezes_usado: number;
  ativo: boolean;
  created_at: string;
}

// ─── Modos ────────────────────────────────────────────────────────────────────

const MODES = [
  {
    id: "redigir", icon: "📝", label: "Redigir documento", color: "#2d5be3", model: "sabiazinho-4", isNew: false,
    systemPrompt: `Você é um Assessor Legislativo Municipal especializado em redação de documentos oficiais. Redija o documento solicitado com linguagem formal e técnica, seguindo rigorosamente os modelos de referência fornecidos. Use EXCLUSIVAMENTE os documentos de referência para estrutura, formato e linguagem. Não invente dados, base legal ou informações que não constem nos documentos.`,
    tooltip: { desc: "Cria proposituras legislativas completas com base nos dados da demanda e nos modelos da sua biblioteca.", examples: ["Redigir uma indicação sobre buracos na Rua das Flores usando o modelo padrão", "Elaborar um requerimento de informação sobre o cronograma de obras da Secretaria"] },
  },
  {
    id: "entrevista", icon: "🎯", label: "Modo entrevista", color: "#1a8c5e", model: "sabiazinho-4", isNew: true,
    systemPrompt: `Você é um Assessor Legislativo que guia o usuário passo a passo para criar um documento oficial. Faça perguntas objetivas uma de cada vez para coletar: tipo de documento, destinatário, objeto da solicitação, justificativa e dados complementares. Ao final, gere o documento completo seguindo os modelos de referência fornecidos.`,
    tooltip: { desc: "A IA conduz uma entrevista rápida fazendo perguntas objetivas para montar o documento ideal.", examples: ["Preciso criar um documento mas não sei qual tipo usar", "Me ajuda a redigir algo sobre a iluminação do bairro passo a passo"] },
  },
  {
    id: "analise", icon: "📊", label: "Analisar demandas", color: "#6c3bd4", model: "sabia-4", isNew: false,
    systemPrompt: `Você é um analista de dados legislativos. Analise os dados fornecidos sobre demandas do gabinete, identifique padrões recorrentes, calcule percentuais e sugira proposituras legislativas coletivas quando houver 3 ou mais demandas similares. Apresente os resultados de forma estruturada com números, percentuais e recomendações concretas de ação legislativa.`,
    tooltip: { desc: "Analisa o banco de demandas para identificar padrões, recorrências e sugerir proposituras coletivas.", examples: ["Quais demandas se repetem no Bairro Centro nos últimos 30 dias?", "Existe padrão suficiente para uma indicação coletiva sobre saneamento?"] },
  },
  {
    id: "resumo", icon: "🗂️", label: "Resumo do gabinete", color: "#c47a0e", model: "sabiazinho-4", isNew: false,
    systemPrompt: `Você é um assessor executivo que produz briefings objetivos e acionáveis. Ao receber dados do gabinete, gere um resumo executivo estruturado com: demandas abertas e fechadas, tarefas pendentes, prazos críticos, aniversariantes e destaques do período. Use linguagem direta, organize por prioridade e destaque o que precisa de ação imediata.`,
    tooltip: { desc: "Gera um briefing executivo com o resumo da semana: demandas, tarefas, prazos e destaques.", examples: ["Me dá um resumo do que aconteceu no gabinete essa semana", "Quais são as demandas mais urgentes e os prazos críticos desta semana?"] },
  },
  {
    id: "whatsapp", icon: "💬", label: "Resposta WhatsApp", color: "#1a8c5e", model: "sabiazinho-4", isNew: false,
    systemPrompt: `Você é um assistente de comunicação política. Redija mensagens de WhatsApp para munícipes com tom profissional mas acolhedor, objetivo e sem jargão técnico excessivo. A mensagem deve ser curta (máximo 3 parágrafos), clara e encerrar com uma sinalização positiva sobre o andamento da demanda. Nunca use linguagem fria ou burocrática.`,
    tooltip: { desc: "Redige mensagens de WhatsApp para munícipes no tom certo: acolhedor, objetivo e sem juridiquês.", examples: ["Redigir resposta para João Silva sobre a demanda #2847 que foi encaminhada à Secretaria", "Mensagem informando que o buraco da Rua das Flores está no cronograma de obras"] },
  },
  {
    id: "pauta", icon: "🏛️", label: "Assessor de pauta", color: "#d4163c", model: "sabia-4", isNew: false,
    systemPrompt: `Você é um assessor parlamentar especializado em preparação para sessões da Câmara. Com base nas demandas e documentos fornecidos, identifique temas relevantes para destaque em plenário, sugira argumentos e dados de apoio, aponte oportunidades de visibilidade política e prepare subsídios objetivos para pronunciamentos.`,
    tooltip: { desc: "Prepara o vereador para a sessão: argumentos, temas das demandas, oportunidades de destaque.", examples: ["Que temas das minhas demandas posso abordar na sessão de amanhã?", "Prepare subsídios para pronunciamento sobre infraestrutura urbana"] },
  },
  {
    id: "documento", icon: "📑", label: "Analisar documento", color: "#2d5be3", model: "sabiazinho-4", isNew: false,
    systemPrompt: `Você é um analista legislativo especializado em documentos oficiais. Ao receber um documento (ofício, resposta, decisão), produza: 1) Resumo executivo em até 3 linhas, 2) Pontos de ação identificados, 3) Prazos ou compromissos assumidos, 4) Sugestão de resposta ou propositura decorrente. Seja objetivo e prático.`,
    tooltip: { desc: "Analisa documentos recebidos (ofícios, respostas da prefeitura) e sugere os próximos passos.", examples: ["Analise esta resposta da Secretaria de Obras e diga o que preciso fazer", "Resumir este ofício e identificar se há prazo para resposta"] },
  },
];

// ─── localStorage ─────────────────────────────────────────────────────────────

const HISTORY_KEY = "assessorIA_history";
const MSGS_PREFIX = "assessorIA_msgs_";
const MAX_HISTORY = 20;

function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}
function saveMessages(convId: string, msgs: Message[]) {
  try { localStorage.setItem(MSGS_PREFIX + convId, JSON.stringify(msgs)); } catch { /* quota */ }
}
function loadMessages(convId: string): Message[] {
  try {
    const raw = localStorage.getItem(MSGS_PREFIX + convId);
    if (!raw) return [];
    return (JSON.parse(raw) as Message[]).map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch { return []; }
}
function deleteConvStorage(convId: string) {
  localStorage.removeItem(MSGS_PREFIX + convId);
}
function formatTimeLabel(ts: number): string {
  const d    = new Date(ts);
  const diff = Math.floor((Date.now() - ts) / 86400000);
  if (diff === 0) return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function truncateTitle(text: string, max = 42): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// ─── Categorias de memória ────────────────────────────────────────────────────

const CATEGORIA_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  fato_gabinete:            { emoji: "🏛️", label: "Fato do Gabinete",     color: "#1e40af", bg: "#eff6ff" },
  padrao_descoberto:        { emoji: "📊", label: "Padrão Descoberto",    color: "#6b21a8", bg: "#faf5ff" },
  preferencia_comunicacao:  { emoji: "💬", label: "Preferência de Tom",   color: "#065f46", bg: "#ecfdf5" },
  correcao:                 { emoji: "⚠️", label: "Correção Aprendida",   color: "#92400e", bg: "#fffbeb" },
};

// ─── Modal de feedback negativo ───────────────────────────────────────────────

function FeedbackModal({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (motivo: string, detalhe: string) => void;
}) {
  const [motivo, setMotivo]   = useState("");
  const [detalhe, setDetalhe] = useState("");

  const motivos = [
    { value: "informacao_incorreta", label: "Informação incorreta ou desatualizada" },
    { value: "sugestao_inadequada",  label: "Sugestão inadequada para este gabinete" },
    { value: "tom_errado",           label: "Tom ou estilo de escrita errado" },
    { value: "outro",                label: "Outro motivo" },
  ];

  const handleSubmit = () => {
    onSubmit(motivo, detalhe);
    setMotivo("");
    setDetalhe("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsDown className="w-4 h-4 text-destructive" />
            O que estava errado?
          </DialogTitle>
          <DialogDescription>
            Seu feedback ajuda o Assessor IA a aprender com este gabinete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-2">
            {motivos.map((m) => (
              <button
                key={m.value}
                onClick={() => setMotivo(m.value)}
                className={`text-left px-3 py-2.5 rounded-lg text-[13px] border transition-all ${
                  motivo === m.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:bg-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
              Detalhe (opcional)
            </label>
            <textarea
              value={detalhe}
              onChange={(e) => setDetalhe(e.target.value)}
              placeholder="Ex: o gabinete prefere indicações a moções, tom mais direto…"
              rows={3}
              className="w-full text-[13px] px-3 py-2 rounded-lg border border-border bg-background resize-none outline-none focus:border-primary"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={!motivo}
              onClick={handleSubmit}
            >
              Enviar feedback
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Painel de memórias ───────────────────────────────────────────────────────

function PainelMemorias({
  tenantId,
  onClose,
}: {
  tenantId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const { data: memorias = [], isLoading, refetch } = useQuery({
    queryKey: ["memorias-ia", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_memoria_ia")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("confianca", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as MemoriaIA[];
    },
    enabled: !!tenantId,
  });

  const desativarMemoria = async (id: string) => {
    const { error } = await supabase
      .from("tenant_memoria_ia")
      .update({ ativo: false })
      .eq("id", id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["memorias-ia"] });
      toast({ title: "Memória removida" });
    }
  };

  const grupoPorCategoria: Record<string, MemoriaIA[]> = {};
  memorias.forEach((m) => {
    if (!grupoPorCategoria[m.categoria]) grupoPorCategoria[m.categoria] = [];
    grupoPorCategoria[m.categoria].push(m);
  });

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-[360px] h-full bg-card border-l border-border flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-[14px] font-bold">Memória do Gabinete</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              title="Atualizar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Descrição */}
        <div className="px-4 py-2.5 bg-primary/5 border-b flex-shrink-0">
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Fatos e padrões aprendidos automaticamente nas conversas. São injetados no contexto dos modos
            <span className="font-medium text-foreground"> Analisar</span>,
            <span className="font-medium text-foreground"> Assessor de Pauta</span> e
            <span className="font-medium text-foreground"> Resumo</span>.
          </p>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando memórias…
            </div>
          ) : memorias.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Brain className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-[13px] font-medium text-muted-foreground">Nenhuma memória ainda</p>
              <p className="text-[11.5px] text-muted-foreground/70 mt-1 max-w-[220px] leading-relaxed">
                Use o Assessor IA nos modos Analisar ou Assessor de Pauta para começar a construir a memória do gabinete.
              </p>
            </div>
          ) : (
            Object.entries(grupoPorCategoria).map(([categoria, items]) => {
              const cfg = CATEGORIA_CONFIG[categoria] || { emoji: "•", label: categoria, color: "#6b7280", bg: "#f9fafb" };
              return (
                <div key={categoria}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[12px]">{cfg.emoji}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cfg.label}</span>
                    <span className="text-[9px] font-mono text-muted-foreground/50 ml-auto">{items.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((mem) => (
                      <div
                        key={mem.id}
                        className="group relative flex items-start gap-2 p-2.5 rounded-lg text-[12px] leading-relaxed"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.color}20` }}
                      >
                        <span className="flex-1" style={{ color: cfg.color }}>{mem.conteudo}</span>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {/* Barra de confiança */}
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1 rounded-full bg-black/10 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${mem.confianca * 100}%`,
                                  background: mem.confianca >= 0.8 ? "#16a34a" : mem.confianca >= 0.6 ? "#ca8a04" : "#dc2626",
                                }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-muted-foreground/60">
                              {Math.round(mem.confianca * 100)}%
                            </span>
                          </div>
                          {/* Botão remover */}
                          <button
                            onClick={() => desativarMemoria(mem.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground/40 hover:text-destructive transition-all"
                            title="Remover memória"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer — total */}
        {memorias.length > 0 && (
          <div className="px-4 py-2.5 border-t flex-shrink-0">
            <p className="text-[11px] text-muted-foreground text-center">
              {memorias.length} memória{memorias.length !== 1 ? "s" : ""} ativas
              {" · "}decaem automaticamente se não forem usadas em 60 dias
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal de vincular demanda ────────────────────────────────────────────────

function VincularDemandaModal({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (d: DemandaContext) => void;
}) {
  const [search, setSearch] = useState("");

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ["demandas-assessor-search"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select("id, protocolo, titulo, status, bairro, areas(nome), municipes(nome)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const filtered = demandas.filter((d: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.protocolo?.toLowerCase().includes(q) ||
      d.titulo?.toLowerCase().includes(q) ||
      d.municipes?.nome?.toLowerCase().includes(q) ||
      d.bairro?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Vincular demanda ao chat</DialogTitle>
          <DialogDescription>Selecione uma demanda para usar como contexto nesta conversa.</DialogDescription>
        </DialogHeader>
        <div className="relative mb-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar por protocolo, título, munícipe ou bairro…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex-1 overflow-y-auto border rounded-lg divide-y divide-border">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando demandas…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">Nenhuma demanda encontrada.</div>
          ) : (
            filtered.slice(0, 100).map((d: any) => (
              <button
                key={d.id}
                onClick={() => {
                  onSelect({
                    id: d.id,
                    protocolo: d.protocolo,
                    titulo: d.titulo,
                    area: d.areas?.nome,
                    municipe: d.municipes?.nome,
                    bairro: d.bairro,
                    status: d.status,
                  });
                  onOpenChange(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-muted-foreground flex-shrink-0">#{d.protocolo}</span>
                  <span className="text-[13px] font-medium flex-1 truncate">{d.titulo}</span>
                  <StatusBadge status={d.status} size="sm" />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {d.municipes?.nome && <span className="text-[11px] text-muted-foreground">{d.municipes.nome}</span>}
                  {d.bairro && <span className="text-[11px] text-muted-foreground">· {d.bairro}</span>}
                  {d.areas?.nome && <span className="text-[11px] text-muted-foreground">· {d.areas.nome}</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const AssessorIA = () => {
  const [messages, setMessages]                       = useState<Message[]>([]);
  const [inputMessage, setInputMessage]               = useState("");
  const [isLoading, setIsLoading]                     = useState(false);
  const [documentosContexto, setDocumentosContexto]   = useState<DocumentoModelo[]>([]);
  const [showSidebar, setShowSidebar]                 = useState(false);
  const [anexosChat, setAnexosChat]                   = useState<AnexoChat[]>([]);
  const [activeMode, setActiveMode]                   = useState("redigir");
  const [demandaContext, setDemandaContext]            = useState<DemandaContext | null>(null);
  const [history, setHistory]                         = useState<HistoryItem[]>(loadHistory);
  const [currentConvId, setCurrentConvId]             = useState<string>(Date.now().toString());
  const [vincularOpen, setVincularOpen]               = useState(false);
  const [showMemoriaPanel, setShowMemoriaPanel]       = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen]     = useState(false);
  const [feedbackPendingMsg, setFeedbackPendingMsg]   = useState<Message | null>(null);
  const [tenantId, setTenantId]                       = useState<string | null>(null);

  const { toast }       = useToast();
  const location        = useLocation();
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);

  const currentMode  = MODES.find((m) => m.id === activeMode) ?? MODES[0];
  const realMessages = messages.filter((m) => m.id !== "welcome");
  const showEmpty    = realMessages.length === 0 && !isLoading;

  // ─── Buscar tenant_id do usuário logado ────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setTenantId(data?.tenant_id || null));
    });
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputMessage]);

  // ─── Processar sessionStorage ─────────────────────────────────────────────
  const processarSessionStorage = useCallback(() => {
    const stored = sessionStorage.getItem("assessorIA_promptData");
    if (!stored) return;
    sessionStorage.removeItem("assessorIA_promptData");
    let data: any;
    try { data = JSON.parse(stored); } catch { return; }
    if (data.modeId) setActiveMode(data.modeId);
    if (data.directPrompt) {
      setMessages([]);
      setDemandaContext(null);
      setDocumentosContexto([]);
      setAnexosChat([]);
      setCurrentConvId(Date.now().toString());
      setTimeout(() => setInputMessage(data.directPrompt), 50);
      return;
    }
    if (data.protocolo || data.titulo) {
      setDemandaContext({ id: data.id || "", protocolo: data.protocolo || "", titulo: data.titulo || "", municipe: data.municipe, area: data.area });
    }
    const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return s; } };
    let prompt = `Com base na demanda a seguir, elabore o documento solicitado:\n\n📋 DADOS DA DEMANDA\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (data.protocolo)   prompt += `• Protocolo: ${data.protocolo}\n`;
    if (data.titulo)      prompt += `• Título: ${data.titulo}\n`;
    if (data.descricao)   prompt += `• Descrição: ${data.descricao}\n`;
    if (data.area)        prompt += `• Área: ${data.area}\n`;
    if (data.municipe)    prompt += `• Munícipe: ${data.municipe}\n`;
    if (data.endereco)    prompt += `• Endereço: ${data.endereco}\n`;
    if (data.observacoes) prompt += `• Observações: ${data.observacoes}\n`;
    if (data.atividades?.length > 0) {
      prompt += `\n📅 HISTÓRICO DE ATIVIDADES\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      data.atividades.forEach((a: any, i: number) => {
        prompt += `\nAtividade ${i + 1}: ${a.titulo}\n  • Tipo: ${a.tipo}\n`;
        if (a.data)     prompt += `  • Data: ${fmtDate(a.data)}\n`;
        if (a.autor)    prompt += `  • Autor: ${a.autor}\n`;
        if (a.descricao) prompt += `  • Descrição: ${a.descricao}\n`;
      });
    }
    prompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSelecione um modelo na Biblioteca de Documentos, indique o tipo de propositura desejado e envie.`;
    setTimeout(() => setInputMessage(prompt), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { processarSessionStorage(); }, [location.key]);

  // ─── Persistir histórico ──────────────────────────────────────────────────
  const persistHistory = (msgs: Message[], modeId: string) => {
    const userMsgs = msgs.filter((m) => m.role === "user");
    if (!userMsgs.length) return;
    const mode = MODES.find((m) => m.id === modeId) ?? MODES[0];
    const item: HistoryItem = {
      id: currentConvId,
      title: truncateTitle(userMsgs[0].content),
      modeId: mode.id,
      modeIcon: mode.icon,
      modeColor: mode.color,
      timestamp: Date.now(),
      demandaTag: demandaContext?.protocolo,
    };
    const updated = [item, ...history.filter((h) => h.id !== currentConvId)];
    setHistory(updated);
    saveHistory(updated);
    saveMessages(currentConvId, msgs);
  };

  // ─── Extrair memórias ao encerrar conversa nos modos certos ───────────────
  const MODOS_COM_EXTRACAO = ["analise", "pauta", "resumo"];

  const triggerExtrairMemorias = useCallback(async (msgs: Message[], modeId: string) => {
    if (!MODOS_COM_EXTRACAO.includes(modeId)) return;
    const trocas = msgs.filter((m) => m.role === "assistant").length;
    if (trocas < 2) return;

    // Fire and forget — não bloquear a UI
    const historico = msgs
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      await supabase.functions.invoke("extrair-memorias", {
        body: { historico, modoId },
      });
    } catch {
      // silencioso — não interrompe o fluxo
    }
  }, []);

  // ─── Nova conversa ────────────────────────────────────────────────────────
  const newConversation = () => {
    if (messages.filter((m) => m.role === "user").length > 0) {
      persistHistory(messages, activeMode);
      triggerExtrairMemorias(messages, activeMode);
    }
    setMessages([]);
    setInputMessage("");
    setDocumentosContexto([]);
    setAnexosChat([]);
    setDemandaContext(null);
    setCurrentConvId(Date.now().toString());
  };

  // ─── Retomar conversa ────────────────────────────────────────────────────
  const loadConversation = (item: HistoryItem) => {
    if (item.id === currentConvId) return;
    if (messages.filter((m) => m.role === "user").length > 0) {
      persistHistory(messages, activeMode);
      triggerExtrairMemorias(messages, activeMode);
    }
    setMessages(loadMessages(item.id));
    setActiveMode(item.modeId);
    setCurrentConvId(item.id);
    setInputMessage("");
    setDocumentosContexto([]);
    setAnexosChat([]);
    setDemandaContext(null);
  };

  // ─── Excluir conversa ────────────────────────────────────────────────────
  const deleteConversation = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    const updated = history.filter((h) => h.id !== itemId);
    setHistory(updated);
    saveHistory(updated);
    deleteConvStorage(itemId);
    if (currentConvId === itemId) {
      setMessages([]);
      setInputMessage("");
      setCurrentConvId(Date.now().toString());
    }
  };

  // ─── Feedback de mensagem ─────────────────────────────────────────────────
  const handleFeedbackPositivo = async (msg: Message) => {
    // Atualizar estado local imediatamente
    setMessages((prev) =>
      prev.map((m) => m.id === msg.id ? { ...m, feedback: "positivo" } : m)
    );

    try {
      await supabase.functions.invoke("registrar-feedback", {
        body: {
          conversa_id:      currentConvId,
          mensagem_usuario: messages.find(
            (m, i) => messages[i + 1]?.id === msg.id && m.role === "user"
          )?.content || "",
          resposta_ia:  msg.content,
          modo:         msg.modeId || activeMode,
          modelo:       msg.model || currentMode.model,
          tipo:         "positivo",
        },
      });
    } catch {
      // silencioso
    }

    toast({
      title: "👍 Obrigado pelo feedback!",
      description: "Isso ajuda o Assessor IA a melhorar suas respostas.",
    });
  };

  const handleFeedbackNegativo = (msg: Message) => {
    setFeedbackPendingMsg(msg);
    setFeedbackModalOpen(true);
    // Atualizar estado local imediatamente
    setMessages((prev) =>
      prev.map((m) => m.id === msg.id ? { ...m, feedback: "negativo" } : m)
    );
  };

  const submitFeedbackNegativo = async (motivo: string, detalhe: string) => {
    if (!feedbackPendingMsg) return;

    try {
      await supabase.functions.invoke("registrar-feedback", {
        body: {
          conversa_id:      currentConvId,
          mensagem_usuario: messages.find(
            (m, i) => messages[i + 1]?.id === feedbackPendingMsg.id && m.role === "user"
          )?.content || "",
          resposta_ia:  feedbackPendingMsg.content,
          modo:         feedbackPendingMsg.modeId || activeMode,
          modelo:       feedbackPendingMsg.model || currentMode.model,
          tipo:         "negativo",
          motivo,
          detalhe,
        },
      });
    } catch {
      // silencioso
    }

    toast({
      title: "Feedback registrado",
      description: "O Assessor IA vai aprender com isso.",
    });

    setFeedbackPendingMsg(null);
  };

  // ─── Anexar documento ────────────────────────────────────────────────────
  const handleAnexarDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande", description: "Máximo permitido: 5MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const conteudo = ev.target?.result as string || "";
      if (file.type === "application/pdf") {
        const texto = conteudo.replace(/[^\x20-\x7E\n\r\tÀ-ú]/g, " ").replace(/\s+/g, " ").trim();
        setAnexosChat((prev) => [...prev, { nome: file.name, conteudo: texto.slice(0, 20000), tamanho: file.size }]);
      } else {
        setAnexosChat((prev) => [...prev, { nome: file.name, conteudo: conteudo.slice(0, 20000), tamanho: file.size }]);
      }
      setActiveMode("documento");
      toast({ title: "Documento anexado", description: `"${file.name}" pronto para análise.` });
    };
    reader.readAsText(file);
  };

  // ─── Enviar mensagem ──────────────────────────────────────────────────────
  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id:        Date.now().toString(),
      role:      "user",
      content:   text,
      timestamp: new Date(),
      modeId:    activeMode,
    };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    if (!overrideText) setInputMessage("");
    setIsLoading(true);

    try {
      const historyForApi = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const truncar = (t: string, max = 10000) =>
        t && t.length > max ? t.slice(0, max) + "\n[... truncado ...]" : t;

      const { data, error } = await supabase.functions.invoke("chat-ia", {
        body: {
          message:             text,
          conversationHistory: historyForApi,
          modeId:              activeMode,
          model:               currentMode.model,
          modeSystemPrompt:    currentMode.systemPrompt,
          demandaProtocolo:    demandaContext?.protocolo || undefined,
          documentosContexto:  documentosContexto.map((d) => ({
            nome:      d.nome,
            categoria: d.categoria,
            conteudo:  truncar(d.conteudo_extraido || ""),
          })),
          anexosContexto: anexosChat.map((a) => ({
            nome:     a.nome,
            conteudo: truncar(a.conteudo),
          })),
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const aiMsg: Message = {
        id:        (Date.now() + 1).toString(),
        role:      "assistant",
        content:   data.message,
        timestamp: new Date(),
        modeId:    activeMode,
        model:     currentMode.model,
        feedback:  null,
      };
      const final = [...nextMsgs, aiMsg];
      setMessages(final);
      persistHistory(final, activeMode);

      // Memórias injetadas (informativo)
      if (data.memorias_injetadas > 0) {
        console.log(`🧠 ${data.memorias_injetadas} memórias usadas nesta resposta`);
      }

    } catch (err) {
      toast({
        title:       "Erro",
        description: err instanceof Error ? err.message : "Erro ao comunicar com a IA",
        variant:     "destructive",
      });
      setMessages((prev) => [
        ...prev,
        {
          id:        (Date.now() + 1).toString(),
          role:      "assistant",
          content:   "Ocorreu um erro ao processar sua mensagem. Tente novamente.",
          timestamp: new Date(),
          modeId:    activeMode,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const gerarProposituradaAnalise = (analysisContent: string) => {
    setActiveMode("redigir");
    setInputMessage(
      `Com base na análise de demandas abaixo, redigir uma indicação legislativa coletiva:\n\n` +
      `${analysisContent.slice(0, 600)}${analysisContent.length > 600 ? "…" : ""}\n\n` +
      `Usar os modelos da Biblioteca de Documentos como referência.`
    );
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleDocumentosSelect = (docs: DocumentoModelo[]) => setDocumentosContexto(docs);
  const removerDoc    = (id: string) => setDocumentosContexto((p) => p.filter((d) => d.id !== id));
  const removerAnexo  = (nome: string) => setAnexosChat((p) => p.filter((a) => a.nome !== nome));

  // ─── Sugestões ────────────────────────────────────────────────────────────
  const getSugestoes = () => {
    if (demandaContext) return [
      {
        emoji: "📝", text: "Redigir indicação legislativa", desc: `Modelo da biblioteca para #${demandaContext.protocolo}`,
        action: () => { setActiveMode("redigir"); setInputMessage(`Redigir uma indicação legislativa com base na demanda #${demandaContext.protocolo}: "${demandaContext.titulo}". Usar os modelos da Biblioteca de Documentos como referência.`); textareaRef.current?.focus(); },
      },
      {
        emoji: "💬", text: "Rascunho WhatsApp", desc: `Para ${demandaContext.municipe || "o munícipe"} sobre o andamento`,
        action: () => { setActiveMode("whatsapp"); setInputMessage(`Redigir mensagem de WhatsApp para ${demandaContext.municipe || "o munícipe"} sobre o andamento da demanda #${demandaContext.protocolo}: "${demandaContext.titulo}".`); textareaRef.current?.focus(); },
      },
      {
        emoji: "🔍", text: "Demandas similares", desc: "Padrões no mesmo bairro ou área",
        action: () => { setActiveMode("analise"); setInputMessage(`Buscar demandas similares à demanda #${demandaContext.protocolo} (${demandaContext.titulo}). Identificar padrões recorrentes na mesma área ou bairro nos últimos 30 dias.`); textareaRef.current?.focus(); },
      },
      {
        emoji: "🎯", text: "Entrevista guiada", desc: "IA faz perguntas e monta o documento",
        action: () => { setActiveMode("entrevista"); sendMessage(`Iniciar modo entrevista. Tenho a demanda #${demandaContext.protocolo}: "${demandaContext.titulo}". Me ajuda a definir qual documento criar.`); },
      },
    ];
    return [
      {
        emoji: "📊", text: "Resumo da semana", desc: "Briefing de demandas, tarefas e prazos",
        action: () => { setActiveMode("resumo"); sendMessage("Me dá um resumo executivo do gabinete desta semana: demandas abertas e fechadas, tarefas pendentes, prazos críticos e destaques."); },
      },
      {
        emoji: "🔍", text: "Padrões nas demandas", desc: "Identificar recorrências para proposituras",
        action: () => { setActiveMode("analise"); setInputMessage("Analisar as demandas dos últimos 30 dias. Identificar padrões recorrentes por bairro e área, e sugerir proposituras coletivas onde houver 3 ou mais demandas similares."); textareaRef.current?.focus(); },
      },
      {
        emoji: "📝", text: "Novo documento", desc: "Indicação, requerimento, PL ou ofício",
        action: () => { setActiveMode("redigir"); textareaRef.current?.focus(); },
      },
      {
        emoji: "📑", text: "Analisar documento", desc: "Anexe um ofício ou resposta da prefeitura",
        action: () => { setActiveMode("documento"); fileInputRef.current?.click(); },
      },
    ];
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="flex overflow-hidden relative -m-3 md:-m-6" style={{ height: "calc(100vh - 56px)" }}>

        {/* ══════════ Mobile sidebar overlay ══════════════════════════ */}
        {showSidebar && (
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* ══════════ SIDEBAR ══════════════════════════════════════════ */}
        <aside className={`flex flex-col overflow-hidden flex-shrink-0 bg-card border-r border-border transition-transform duration-200 z-50
          fixed md:relative inset-y-0 left-0 w-[280px] md:w-[252px]
          ${showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>

          {/* Brand + Nova conversa */}
          <div className="px-4 pt-[18px] pb-[14px] border-b border-border">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div
                className="w-8 h-8 rounded-[9px] flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#3068f0,#6c3bd4)", boxShadow: "0 2px 12px rgba(48,104,240,0.25)" }}
              >
                <Bot className="w-[18px] h-[18px] text-white" />
              </div>
              <div>
                <div className="text-[15px] font-bold tracking-tight text-foreground">Assessor IA</div>
                <div className="text-[11px] text-muted-foreground">Poder Local Gestor</div>
              </div>
            </div>
            <button
              onClick={newConversation}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-muted-foreground text-[13px] font-medium hover:bg-muted hover:text-foreground transition-all"
            >
              <Plus className="w-3.5 h-3.5 opacity-50" />
              Nova conversa
            </button>
          </div>

          {/* Botão memória */}
          <div className="px-3 pt-3 flex-shrink-0">
            <button
              onClick={() => setShowMemoriaPanel(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-medium border transition-all hover:border-primary/40 hover:text-primary group"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
            >
              <Brain className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
              <span>Memória do Gabinete</span>
              <Sparkles className="w-3 h-3 ml-auto opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all" />
            </button>
          </div>

          {/* Histórico */}
          <div className="flex-1 flex flex-col overflow-hidden px-2.5 py-3">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 px-2 mb-1.5">
              Conversas
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-0.5">
              {history.length === 0 && (
                <p className="text-[12px] text-muted-foreground px-2 py-2">Nenhuma conversa ainda.</p>
              )}
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`group flex items-start gap-1 rounded-md transition-all cursor-pointer px-2 py-[7px]
                    ${currentConvId === item.id ? "bg-primary/10" : "hover:bg-muted"}`}
                  onClick={() => { loadConversation(item); setShowSidebar(false); }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[12px] flex-shrink-0">{item.modeIcon}</span>
                      <span className={`text-[12.5px] font-medium truncate ${currentConvId === item.id ? "text-primary" : "text-muted-foreground"}`}>
                        {item.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pl-[20px]">
                      <span className="text-[10.5px] font-mono text-muted-foreground/60">{formatTimeLabel(item.timestamp)}</span>
                      {item.demandaTag && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono">#{item.demandaTag}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(e, item.id)}
                    className="flex-shrink-0 mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground/40 transition-all"
                    title="Excluir conversa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ══════════ MAIN ════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden">

          {/* Topbar */}
          <div className="h-[50px] border-b flex items-center gap-2 md:gap-2.5 px-3 md:px-5 bg-card flex-shrink-0 overflow-x-auto overflow-y-hidden scrollbar-hide">

            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="md:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground flex-shrink-0"
            >
              <PanelLeft className="w-5 h-5" />
            </button>

            {/* Dropdown de modo */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold flex-shrink-0 transition-colors hover:opacity-90"
                      style={{
                        background: "hsl(var(--primary)/0.08)",
                        border:     "1px solid hsl(var(--primary)/0.2)",
                        color:      "hsl(var(--primary))",
                      }}
                    >
                      <span>{currentMode.icon}</span>
                      <span>{currentMode.label}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] p-2.5">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{currentMode.tooltip.desc}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Clique para trocar de modo</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-[240px] p-1.5">
                {MODES.map((mode) => (
                  <Tooltip key={mode.id} delayDuration={300}>
                    <TooltipTrigger asChild>
                      <DropdownMenuItem
                        onClick={() => setActiveMode(mode.id)}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer text-[13px] ${activeMode === mode.id ? "bg-primary/10 text-primary font-semibold" : ""}`}
                      >
                        <span className="w-6 h-6 rounded flex items-center justify-center bg-muted text-[12px] flex-shrink-0">{mode.icon}</span>
                        <span className="flex-1">{mode.label}</span>
                        {mode.model === "sabia-4" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-400">PRO</span>}
                        {mode.isNew && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">NOVO</span>}
                      </DropdownMenuItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[210px] p-3 space-y-2">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{mode.tooltip.desc}</p>
                      {mode.tooltip.examples.map((ex, i) => (
                        <div key={i} className="text-[11px] text-muted-foreground pl-2 border-l-2 border-muted leading-snug">"{ex}"</div>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-5 bg-border flex-shrink-0" />

            {/* Chip demanda */}
            {demandaContext && (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium max-w-[260px] flex-shrink-0"
                style={{ background: "#fdf6e8", border: "1px solid #f0d88c", color: "#92540a" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="truncate">#{demandaContext.protocolo} — {demandaContext.titulo}</span>
                <button onClick={() => setDemandaContext(null)} className="flex-shrink-0 hover:text-red-500 ml-0.5" style={{ color: "#c47a0e" }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Chips de anexos */}
            {anexosChat.map((a) => (
              <div key={a.nome} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium max-w-[150px] flex-shrink-0"
                style={{ background: "#f0f4ff", border: "1px solid #c7d7fc", color: "#1e3fa0" }}>
                <Paperclip className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{a.nome.length > 14 ? a.nome.slice(0, 14) + "…" : a.nome}</span>
                <button onClick={() => removerAnexo(a.nome)} className="flex-shrink-0 hover:text-red-500 ml-0.5"><X className="w-3 h-3" /></button>
              </div>
            ))}

            {/* Chips de documentos da biblioteca */}
            {documentosContexto.map((doc) => (
              <div key={doc.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium max-w-[150px] flex-shrink-0"
                style={{ background: "#eefbf4", border: "1px solid #b0eacc", color: "#166534" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 flex-shrink-0" />
                <span className="truncate">{doc.nome.length > 14 ? doc.nome.slice(0, 14) + "…" : doc.nome}</span>
                <button onClick={() => removerDoc(doc.id)} className="flex-shrink-0 hover:text-red-500 ml-0.5" style={{ color: "#1a8c5e" }}><X className="w-3 h-3" /></button>
              </div>
            ))}

            {/* Modelo ativo + badge de memória nos modos com injeção */}
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              {MODOS_COM_EXTRACAO.includes(activeMode) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowMemoriaPanel(true)}
                      className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all"
                    >
                      <Brain className="w-3 h-3" />
                      Memória ativa
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[11px]">
                    Este modo injeta o conhecimento acumulado do gabinete no contexto
                  </TooltipContent>
                </Tooltip>
              )}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono text-muted-foreground bg-muted border border-border">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
                {currentMode.model}
              </div>
            </div>
          </div>

          {/* Área de conversa */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Estado vazio */}
            {showEmpty && (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center overflow-y-auto">
                <div
                  className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center mb-5 flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#3068f0,#6c3bd4)", boxShadow: "0 6px 24px rgba(48,104,240,0.25)" }}
                >
                  <Bot className="w-[26px] h-[26px] text-white" />
                </div>
                {demandaContext ? (
                  <>
                    <h2 className="text-[22px] font-bold tracking-tight mb-1.5">Contexto carregado</h2>
                    <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[420px] mb-7">Já tenho os dados da demanda vinculada. Escolha uma ação rápida ou descreva o que precisa.</p>
                    <div className="max-w-[520px] w-full rounded-xl p-4 flex gap-3 items-start mb-7 text-left flex-shrink-0"
                      style={{ border: "1px solid #f0d88c", background: "#fdf6e8" }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: "rgba(196,122,14,0.1)" }}>📋</div>
                      <div>
                        <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: "#c47a0e" }}>Demanda vinculada</div>
                        <div className="text-[14px] font-semibold mb-0.5">{demandaContext.titulo}</div>
                        <div className="text-[12px] text-muted-foreground">{[demandaContext.municipe, demandaContext.area, `Protocolo #${demandaContext.protocolo}`].filter(Boolean).join(" · ")}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-[22px] font-bold tracking-tight mb-1.5">Olá! Como posso ajudar?</h2>
                    <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[420px] mb-7">Escolha um modo no menu ou comece com uma das sugestões abaixo.</p>
                  </>
                )}
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2.5 w-full max-w-[520px] text-left">
                  {demandaContext ? "Ações sugeridas" : "Por onde começar"}
                </div>
                <div className="grid grid-cols-2 gap-2.5 max-w-[520px] w-full">
                  {getSugestoes().map((sug, i) => (
                    <button key={i} onClick={sug.action} className="bg-card border border-border rounded-lg p-4 text-left transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-px">
                      <span className="block text-[20px] mb-2.5">{sug.emoji}</span>
                      <div className="text-[13px] font-semibold leading-snug mb-1">{sug.text}</div>
                      <div className="text-[11.5px] text-muted-foreground leading-snug">{sug.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mensagens */}
            {!showEmpty && (
              <div className="flex-1 overflow-y-auto p-7 space-y-5">
                {realMessages.map((msg, idx) => (
                  <div
                    key={msg.id}
                    className="flex gap-3 max-w-[700px]"
                    style={{
                      flexDirection: msg.role === "user" ? "row-reverse" : "row",
                      marginLeft:    msg.role === "user" ? "auto" : "0",
                      animationName: "fadeUp",
                      animationDuration: "0.3s",
                    }}
                  >
                    <div
                      className="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-[13px]"
                      style={msg.role === "assistant"
                        ? { background: "linear-gradient(135deg,#3068f0,#6c3bd4)", boxShadow: "0 2px 8px rgba(48,104,240,0.25)" }
                        : { background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
                    >
                      {msg.role === "assistant" ? <Bot className="w-4 h-4 text-white" /> : "👤"}
                    </div>

                    <div
                      className="flex flex-col gap-1 min-w-0"
                      style={{ alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}
                    >
                      <div
                        className="px-4 py-3 text-[13.5px] leading-[1.7]"
                        style={msg.role === "assistant"
                          ? { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "2px 10px 10px 10px" }
                          : { background: "hsl(var(--primary))", borderRadius: "10px 2px 10px 10px", color: "#fff" }}
                      >
                        <MarkdownText className="text-sm">{msg.content}</MarkdownText>
                      </div>

                      {/* Botões de ação para respostas da IA */}
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5">

                          {/* Transformar em propositura (analise/pauta) */}
                          {(msg.modeId === "analise" || msg.modeId === "pauta") && (
                            <button
                              onClick={() => gerarProposituradaAnalise(msg.content)}
                              className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all hover:shadow-sm"
                              style={{
                                background: "hsl(var(--primary)/0.08)",
                                border:     "1px solid hsl(var(--primary)/0.2)",
                                color:      "hsl(var(--primary))",
                              }}
                            >
                              📝 Transformar em propositura
                            </button>
                          )}

                          {/* Feedback 👍 */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => msg.feedback !== "positivo" && handleFeedbackPositivo(msg)}
                                className={`p-1.5 rounded-md transition-all ${
                                  msg.feedback === "positivo"
                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                                    : "text-muted-foreground/40 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                }`}
                              >
                                {msg.feedback === "positivo"
                                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                                  : <ThumbsUp className="w-3.5 h-3.5" />
                                }
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[11px]">Boa resposta</TooltipContent>
                          </Tooltip>

                          {/* Feedback 👎 */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => msg.feedback !== "negativo" && handleFeedbackNegativo(msg)}
                                className={`p-1.5 rounded-md transition-all ${
                                  msg.feedback === "negativo"
                                    ? "bg-red-100 dark:bg-red-900/30 text-red-500"
                                    : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                }`}
                              >
                                {msg.feedback === "negativo"
                                  ? <AlertCircle className="w-3.5 h-3.5" />
                                  : <ThumbsDown className="w-3.5 h-3.5" />
                                }
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[11px]">Resposta ruim</TooltipContent>
                          </Tooltip>
                        </div>
                      )}

                      <div className="text-[10.5px] font-mono text-muted-foreground">
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {msg.role === "assistant" && ` · ${msg.model || currentMode.model}`}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div
                      className="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "linear-gradient(135deg,#3068f0,#6c3bd4)", boxShadow: "0 2px 8px rgba(48,104,240,0.25)" }}
                    >
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div
                        className="flex items-center gap-1.5 px-4 py-3"
                        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "2px 10px 10px 10px" }}
                      >
                        {[0, 200, 400].map((delay) => (
                          <span key={delay} className="w-2 h-2 rounded-full bg-muted-foreground/40"
                            style={{ animation: `bounce 1.4s ease-in-out ${delay}ms infinite` }} />
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Loader2 className="w-2.5 h-2.5 text-muted-foreground animate-spin" />
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {activeMode === "analise"  ? "Consultando demandas e memórias do gabinete…"
                           : activeMode === "resumo"  ? "Compilando dados da semana…"
                           : activeMode === "pauta"   ? "Preparando subsídios para a sessão…"
                           : activeMode === "documento" ? "Analisando documento…"
                           : "Redigindo…"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-5 pt-3 pb-5 border-t bg-background flex-shrink-0">
            <div
              className="rounded-xl overflow-hidden bg-card"
              style={{ border: "1.5px solid hsl(var(--border))", transition: "border-color 0.15s, box-shadow 0.15s" }}
              onFocusCapture={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--primary))";
                (e.currentTarget as HTMLElement).style.boxShadow   = "0 0 0 3px hsl(var(--primary)/0.08)";
              }}
              onBlurCapture={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
                (e.currentTarget as HTMLElement).style.boxShadow   = "none";
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeMode === "documento" && anexosChat.length === 0
                    ? "Anexe um documento e faça sua pergunta…"
                    : `Mensagem para o Assessor IA (${currentMode.label})…`
                }
                disabled={isLoading}
                rows={2}
                className="w-full border-none outline-none resize-none bg-transparent text-[14px] leading-[1.6] min-h-[48px] max-h-[150px] px-4 pt-3 pb-2 text-foreground placeholder:text-muted-foreground/60"
              />
              <div className="flex items-center gap-1 px-2.5 pb-2.5 overflow-x-auto scrollbar-hide">

                {/* Biblioteca de modelos */}
                <div className="[&>button]:h-auto [&>button]:px-2.5 [&>button]:py-1.5 [&>button]:text-xs [&>button]:rounded-lg [&>button]:font-medium">
                  <BibliotecaDocumentosDialog onDocumentosSelect={handleDocumentosSelect} />
                </div>

                <div className="w-px h-4 bg-border mx-0.5" />

                {/* Anexar documento */}
                <input ref={fileInputRef} type="file" accept=".txt,.pdf,.doc,.docx,.odt,.rtf" className="hidden" onChange={handleAnexarDocumento} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-all
                        ${activeMode === "documento"
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "text-muted-foreground border-transparent hover:bg-muted hover:border-border"}`}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      Anexar documento
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px]">
                    Anexe um ofício, resposta ou decisão para análise (txt, pdf, doc)
                  </TooltipContent>
                </Tooltip>

                <div className="w-px h-4 bg-border mx-0.5" />

                {/* Vincular demanda */}
                {!demandaContext ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setVincularOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-muted-foreground border border-transparent hover:bg-muted hover:border-border transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Vincular demanda
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[11px]">
                      Selecione uma demanda para usar como contexto nesta conversa
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={() => setVincularOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-all bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:opacity-80"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Trocar demanda
                  </button>
                )}

                {/* Enviar */}
                <button
                  onClick={() => sendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="ml-auto flex items-center gap-1.5 h-[34px] px-4 rounded-lg text-[13px] font-semibold transition-colors disabled:cursor-not-allowed"
                  style={{
                    background: !inputMessage.trim() || isLoading ? "hsl(var(--muted))" : "hsl(var(--primary))",
                    color:      !inputMessage.trim() || isLoading ? "hsl(var(--muted-foreground))" : "#fff",
                  }}
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Enviar
                </button>
              </div>
            </div>
            <p className="text-[10.5px] font-mono text-muted-foreground text-center mt-2">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </div>
      </div>

      {/* ══ Modais e painéis ══ */}
      <VincularDemandaModal
        open={vincularOpen}
        onOpenChange={setVincularOpen}
        onSelect={(d) => setDemandaContext(d)}
      />

      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        onSubmit={submitFeedbackNegativo}
      />

      {showMemoriaPanel && (
        <PainelMemorias
          tenantId={tenantId}
          onClose={() => setShowMemoriaPanel(false)}
        />
      )}

      <style>{`
        @keyframes bounce { 0%, 80%, 100% { transform: scale(1); opacity: 0.4; } 40% { transform: scale(1.2); opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </TooltipProvider>
  );
};

export default AssessorIA;
