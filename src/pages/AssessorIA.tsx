import { useState, useRef, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BibliotecaDocumentosDialog } from "@/components/forms/BibliotecaDocumentosDialog";
import { MarkdownText } from "@/components/ui/markdown-text";
import { Bot, Plus, Loader2, Send, X, FileText } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  modeId?: string;
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

interface DemandaContext {
  protocolo: string;
  titulo: string;
  municipe?: string;
  area?: string;
}

interface HistoryItem {
  id: string;
  title: string;
  modeIcon: string;
  modeColor: string;
  timestamp: number;
  demandaTag?: string;
}

// ─── Configuração dos modos ───────────────────────────────────────────────────

const MODES = [
  {
    id: "redigir",
    icon: "📝",
    label: "Redigir documento",
    color: "#2d5be3",
    isNew: false,
    systemPrompt: `Você é um Assessor Legislativo Municipal especializado em redação de documentos oficiais. Redija o documento solicitado com linguagem formal e técnica, seguindo rigorosamente os modelos de referência fornecidos. Use EXCLUSIVAMENTE os documentos de referência para estrutura, formato e linguagem. Não invente dados, base legal ou informações que não constem nos documentos.`,
    tooltip: {
      desc: "Cria proposituras legislativas completas com base nos dados da demanda e nos modelos da sua biblioteca.",
      examples: [
        "Redigir uma indicação sobre buracos na Rua das Flores usando o modelo padrão",
        "Elaborar um requerimento de informação sobre o cronograma de obras da Secretaria",
      ],
    },
  },
  {
    id: "entrevista",
    icon: "🎯",
    label: "Modo entrevista",
    color: "#1a8c5e",
    isNew: true,
    systemPrompt: `Você é um Assessor Legislativo que guia o usuário passo a passo para criar um documento oficial. Faça perguntas objetivas uma de cada vez para coletar: tipo de documento, destinatário, objeto da solicitação, justificativa e dados complementares. Ao final, gere o documento completo seguindo os modelos de referência fornecidos.`,
    tooltip: {
      desc: "A IA conduz uma entrevista rápida fazendo perguntas objetivas para montar o documento ideal.",
      examples: [
        "Preciso criar um documento mas não sei qual tipo usar",
        "Me ajuda a redigir algo sobre a iluminação do bairro passo a passo",
      ],
    },
  },
  {
    id: "analise",
    icon: "📊",
    label: "Analisar demandas",
    color: "#6c3bd4",
    isNew: false,
    systemPrompt: `Você é um analista de dados legislativos. Analise os dados fornecidos sobre demandas do gabinete, identifique padrões recorrentes, calcule percentuais e sugira proposituras legislativas coletivas quando houver 3 ou mais demandas similares. Apresente os resultados de forma estruturada com números, percentuais e recomendações concretas de ação legislativa.`,
    tooltip: {
      desc: "Analisa o banco de demandas para identificar padrões, recorrências e sugerir proposituras coletivas.",
      examples: [
        "Quais demandas se repetem no Bairro Centro nos últimos 30 dias?",
        "Existe padrão suficiente para uma indicação coletiva sobre saneamento?",
      ],
    },
  },
  {
    id: "resumo",
    icon: "🗂️",
    label: "Resumo do gabinete",
    color: "#c47a0e",
    isNew: false,
    systemPrompt: `Você é um assessor executivo que produz briefings objetivos e acionáveis. Ao receber dados do gabinete, gere um resumo executivo estruturado com: demandas abertas e fechadas, tarefas pendentes, prazos críticos, aniversariantes e destaques do período. Use linguagem direta, organize por prioridade e destaque o que precisa de ação imediata.`,
    tooltip: {
      desc: "Gera um briefing executivo com o resumo da semana: demandas, tarefas, prazos e destaques.",
      examples: [
        "Me dá um resumo do que aconteceu no gabinete essa semana",
        "Quais são as demandas mais urgentes e os prazos críticos desta semana?",
      ],
    },
  },
  {
    id: "whatsapp",
    icon: "💬",
    label: "Resposta WhatsApp",
    color: "#1a8c5e",
    isNew: false,
    systemPrompt: `Você é um assistente de comunicação política. Redija mensagens de WhatsApp para munícipes com tom profissional mas acolhedor, objetivo e sem jargão técnico excessivo. A mensagem deve ser curta (máximo 3 parágrafos), clara e encerrar com uma sinalização positiva sobre o andamento da demanda. Nunca use linguagem fria ou burocrática.`,
    tooltip: {
      desc: "Redige mensagens de WhatsApp para munícipes no tom certo: acolhedor, objetivo e sem juridiquês.",
      examples: [
        "Redigir resposta para João Silva sobre a demanda #2847 que foi encaminhada à Secretaria",
        "Mensagem informando que o buraco da Rua das Flores está no cronograma de obras",
      ],
    },
  },
  {
    id: "pauta",
    icon: "🏛️",
    label: "Assessor de pauta",
    color: "#d4163c",
    isNew: false,
    systemPrompt: `Você é um assessor parlamentar especializado em preparação para sessões da Câmara. Com base nas demandas e documentos fornecidos, identifique temas relevantes para destaque em plenário, sugira argumentos e dados de apoio, aponte oportunidades de visibilidade política e prepare subsídios objetivos para pronunciamentos.`,
    tooltip: {
      desc: "Prepara o vereador para a sessão: argumentos, temas das demandas, oportunidades de destaque.",
      examples: [
        "Que temas das minhas demandas posso abordar na sessão de amanhã?",
        "Prepare subsídios para pronunciamento sobre infraestrutura urbana",
      ],
    },
  },
  {
    id: "documento",
    icon: "📑",
    label: "Analisar documento",
    color: "#2d5be3",
    isNew: false,
    systemPrompt: `Você é um analista legislativo especializado em documentos oficiais. Ao receber um documento (ofício, resposta, decisão), produza: 1) Resumo executivo em até 3 linhas, 2) Pontos de ação identificados, 3) Prazos ou compromissos assumidos, 4) Sugestão de resposta ou propositura decorrente. Seja objetivo e prático.`,
    tooltip: {
      desc: "Analisa documentos recebidos (ofícios, respostas da prefeitura) e sugere os próximos passos.",
      examples: [
        "Analise esta resposta da Secretaria de Obras e diga o que preciso fazer",
        "Resumir este ofício e identificar se há prazo para resposta",
      ],
    },
  },
];

// ─── Utilitários de histórico (localStorage) ─────────────────────────────────

const HISTORY_KEY = "assessorIA_history";
const MAX_HISTORY = 20;

function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

function formatTimeLabel(ts: number): string {
  const d = new Date(ts);
  const diffDays = Math.floor((Date.now() - ts) / 86400000);
  if (diffDays === 0) return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function truncateTitle(text: string, max = 42): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// ─── Componente principal ─────────────────────────────────────────────────────

const AssessorIA = () => {
  const [messages, setMessages]                 = useState<Message[]>([]);
  const [inputMessage, setInputMessage]         = useState("");
  const [isLoading, setIsLoading]               = useState(false);
  const [documentosContexto, setDocumentosContexto] = useState<DocumentoModelo[]>([]);
  const [activeMode, setActiveMode]             = useState("redigir");
  const [demandaContext, setDemandaContext]      = useState<DemandaContext | null>(null);
  const [history, setHistory]                   = useState<HistoryItem[]>(loadHistory);
  const [currentConvId, setCurrentConvId]       = useState<string>(Date.now().toString());

  const { toast }       = useToast();
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);

  const currentMode  = MODES.find((m) => m.id === activeMode) ?? MODES[0];
  const realMessages = messages.filter((m) => m.id !== "welcome");
  const showEmpty    = realMessages.length === 0 && !isLoading;

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputMessage]);

  // Ler contexto da demanda via sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("assessorIA_promptData");
    if (!stored) return;
    sessionStorage.removeItem("assessorIA_promptData");

    let data: any;
    try { data = JSON.parse(stored); } catch { return; }

    if (data.protocolo || data.titulo) {
      setDemandaContext({ protocolo: data.protocolo || "", titulo: data.titulo || "", municipe: data.municipe, area: data.area });
    }

    const fmtDate = (s: string) => {
      try { return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
      catch { return s; }
    };

    let prompt = `Com base na demanda a seguir, elabore o documento solicitado:\n\n`;
    prompt += `📋 DADOS DA DEMANDA\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
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
        if (a.data)               prompt += `  • Data: ${fmtDate(a.data)}\n`;
        if (a.autor)              prompt += `  • Autor: ${a.autor}\n`;
        if (a.descricao)          prompt += `  • Descrição: ${a.descricao}\n`;
        if (a.propositura)        prompt += `  • Propositura: ${a.propositura}\n`;
        if (a.status_propositura) prompt += `  • Status: ${a.status_propositura}\n`;
        if (a.link_propositura)   prompt += `  • Link: ${a.link_propositura}\n`;
      });
    }

    prompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSelecione um modelo na Biblioteca de Documentos, indique o tipo de propositura desejado e envie.`;
    setTimeout(() => setInputMessage(prompt), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Histórico ────────────────────────────────────────────────────────────
  const persistHistory = (msgs: Message[], modeId: string) => {
    const userMsgs = msgs.filter((m) => m.role === "user");
    if (!userMsgs.length) return;
    const mode = MODES.find((m) => m.id === modeId) ?? MODES[0];
    const item: HistoryItem = {
      id: currentConvId,
      title: truncateTitle(userMsgs[0].content),
      modeIcon: mode.icon,
      modeColor: mode.color,
      timestamp: Date.now(),
      demandaTag: demandaContext?.protocolo,
    };
    const updated = [item, ...history.filter((h) => h.id !== currentConvId)];
    setHistory(updated);
    saveHistory(updated);
  };

  // ─── Nova conversa ────────────────────────────────────────────────────────
  const newConversation = () => {
    if (messages.filter((m) => m.role === "user").length > 0) persistHistory(messages, activeMode);
    setMessages([]);
    setInputMessage("");
    setDocumentosContexto([]);
    setDemandaContext(null);
    setCurrentConvId(Date.now().toString());
  };

  // ─── Enviar mensagem ──────────────────────────────────────────────────────
  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date(), modeId: activeMode };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    if (!overrideText) setInputMessage("");
    setIsLoading(true);

    try {
      const history = messages.filter((m) => m.id !== "welcome").map((m) => ({ role: m.role, content: m.content }));
      const truncar = (t: string, max = 10000) => t && t.length > max ? t.slice(0, max) + "\n[... truncado ...]" : t;

      const { data, error } = await supabase.functions.invoke("chat-ia", {
        body: {
          message: text,
          conversationHistory: history,
          model: "pleno",
          modeSystemPrompt: currentMode.systemPrompt,
          documentosContexto: documentosContexto.map((d) => ({ nome: d.nome, categoria: d.categoria, conteudo: truncar(d.conteudo_extraido || "") })),
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: data.message, timestamp: new Date(), modeId: activeMode };
      const final = [...nextMsgs, aiMsg];
      setMessages(final);
      persistHistory(final, activeMode);
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao comunicar com a IA", variant: "destructive" });
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "Ocorreu um erro ao processar sua mensagem. Tente novamente.", timestamp: new Date(), modeId: activeMode }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ─── Gerar propositura a partir de análise ────────────────────────────────
  const gerarProposituradaAnalise = (analysisContent: string) => {
    setActiveMode("redigir");
    setInputMessage(`Com base na análise de demandas abaixo, redigir uma indicação legislativa coletiva:\n\n${analysisContent.slice(0, 600)}${analysisContent.length > 600 ? "…" : ""}\n\nUsar os modelos da Biblioteca de Documentos como referência.`);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleDocumentosSelect = (docs: DocumentoModelo[]) => setDocumentosContexto(docs);
  const removerDoc = (id: string) => setDocumentosContexto((p) => p.filter((d) => d.id !== id));

  // ─── Sugestões do estado inicial ──────────────────────────────────────────
  const getSugestoes = () => {
    if (demandaContext) return [
      { emoji: "📝", text: "Redigir indicação legislativa", desc: `Usar modelo da biblioteca para #${demandaContext.protocolo}`, action: () => { setActiveMode("redigir"); setInputMessage(`Redigir uma indicação legislativa com base na demanda #${demandaContext.protocolo}: "${demandaContext.titulo}". Usar os modelos da Biblioteca de Documentos como referência.`); textareaRef.current?.focus(); } },
      { emoji: "💬", text: "Rascunho WhatsApp", desc: `Para ${demandaContext.municipe || "o munícipe"} sobre o andamento`, action: () => { setActiveMode("whatsapp"); setInputMessage(`Redigir mensagem de WhatsApp para ${demandaContext.municipe || "o munícipe"} sobre o andamento da demanda #${demandaContext.protocolo}: "${demandaContext.titulo}".`); textareaRef.current?.focus(); } },
      { emoji: "🔍", text: "Demandas similares", desc: "Padrões no mesmo bairro ou área", action: () => { setActiveMode("analise"); setInputMessage(`Buscar demandas similares à demanda #${demandaContext.protocolo} (${demandaContext.titulo}). Identificar padrões recorrentes na mesma área ou bairro nos últimos 30 dias.`); textareaRef.current?.focus(); } },
      { emoji: "🎯", text: "Entrevista guiada", desc: "IA faz perguntas e monta o documento", action: () => { setActiveMode("entrevista"); sendMessage(`Iniciar modo entrevista. Tenho a demanda #${demandaContext.protocolo}: "${demandaContext.titulo}". Me ajuda a definir qual documento criar.`); } },
    ];

    return [
      { emoji: "📊", text: "Resumo da semana", desc: "Briefing de demandas, tarefas e prazos", action: () => { setActiveMode("resumo"); sendMessage("Me dá um resumo executivo do gabinete desta semana: demandas abertas e fechadas, tarefas pendentes, prazos críticos e destaques."); } },
      { emoji: "🔍", text: "Padrões nas demandas", desc: "Identificar recorrências para proposituras", action: () => { setActiveMode("analise"); setInputMessage("Analisar as demandas dos últimos 30 dias. Identificar padrões recorrentes por bairro e área, e sugerir proposituras coletivas onde houver 3 ou mais demandas similares."); textareaRef.current?.focus(); } },
      { emoji: "📝", text: "Novo documento", desc: "Indicação, requerimento, PL ou ofício", action: () => { setActiveMode("redigir"); textareaRef.current?.focus(); } },
      { emoji: "🎯", text: "Modo entrevista", desc: "IA conduz e monta o documento", action: () => { setActiveMode("entrevista"); sendMessage("Iniciar modo entrevista. Quero criar um documento legislativo e preciso de orientação sobre qual tipo usar."); } },
    ];
  };

  // ─── Estilos de sidebar inline (evita conflito com Tailwind dark mode) ────
  const sb = {
    root:    { width: 260, background: "#0c1222", borderRight: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", flexDirection: "column" as const, overflow: "hidden" },
    section: { borderBottom: "1px solid rgba(255,255,255,0.06)" },
    label:   { fontSize: 9.5, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "#5a6a85", padding: "0 8px", marginBottom: 6 },
    linkBase: (on: boolean): React.CSSProperties => ({ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 6, cursor: "pointer", border: "none", background: on ? "rgba(48,104,240,0.12)" : "transparent", color: on ? "#93b4ff" : "#8b99b3", fontSize: 13, fontWeight: 500, textAlign: "left" as const, position: "relative", transition: "all 0.1s" }),
    ico:     (on: boolean): React.CSSProperties => ({ width: 26, height: 26, borderRadius: 6, background: on ? "rgba(48,104,240,0.18)" : "#141d32", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }),
    hist:    (on: boolean): React.CSSProperties => ({ padding: "7px 8px", borderRadius: 6, cursor: "pointer", background: on ? "rgba(48,104,240,0.1)" : "transparent", transition: "background 0.1s" }),
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 56px)", margin: "-1.5rem" }}>

        {/* ══════════ SIDEBAR ══════════════════════════════════════════════ */}
        <aside style={sb.root}>

          {/* Brand */}
          <div style={{ padding: "18px 16px 14px", ...sb.section }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#3068f0,#6c3bd4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(48,104,240,0.4)", flexShrink: 0 }}>
                <Bot style={{ width: 18, height: 18, color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e1e7f0", letterSpacing: "-0.02em" }}>Assessor IA</div>
                <div style={{ fontSize: 11, color: "#5a6a85" }}>Poder Local Gestor</div>
              </div>
            </div>
            <button
              onClick={newConversation}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid #1c2844", background: "#141d32", color: "#8b99b3", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#1c2844"; (e.currentTarget as HTMLElement).style.color = "#e1e7f0"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#141d32"; (e.currentTarget as HTMLElement).style.color = "#8b99b3"; }}
            >
              <Plus style={{ width: 14, height: 14, opacity: 0.5 }} />
              Nova conversa
            </button>
          </div>

          {/* Modos */}
          <div style={{ padding: "12px 10px", ...sb.section }}>
            <div style={sb.label}>Modos</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {MODES.map((mode) => (
                <Tooltip key={mode.id} delayDuration={500}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setActiveMode(mode.id)}
                      style={sb.linkBase(activeMode === mode.id)}
                      onMouseEnter={(e) => { if (activeMode !== mode.id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#e1e7f0"; }}
                      onMouseLeave={(e) => { if (activeMode !== mode.id) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#8b99b3"; } }}
                    >
                      {activeMode === mode.id && (
                        <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 16, borderRadius: "0 2px 2px 0", background: "#2d5be3" }} />
                      )}
                      <span style={sb.ico(activeMode === mode.id)}>{mode.icon}</span>
                      {mode.label}
                      {mode.isNew && (
                        <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(26,140,94,0.15)", color: "#4ade80" }}>NOVO</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[230px] p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <span>{mode.icon}</span>
                      <span className="font-semibold text-[12px]">{mode.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{mode.tooltip.desc}</p>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Exemplos de uso</div>
                      {mode.tooltip.examples.map((ex, i) => (
                        <div key={i} className="text-[11px] text-muted-foreground pl-2 border-l-2 border-muted leading-snug mb-1">"{ex}"</div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Histórico */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 10px 8px" }}>
            <div style={sb.label}>Recentes</div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1, paddingRight: 2, scrollbarWidth: "thin", scrollbarColor: "#1c2844 transparent" }}>
              {history.length === 0 && (
                <p style={{ fontSize: 12, color: "#5a6a85", padding: "8px 8px" }}>Nenhuma conversa ainda.</p>
              )}
              {history.map((item) => (
                <div
                  key={item.id}
                  style={sb.hist(currentConvId === item.id)}
                  onMouseEnter={(e) => { if (currentConvId !== item.id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={(e) => { if (currentConvId !== item.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: item.modeColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: currentConvId === item.id ? "#93b4ff" : "#8b99b3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 11 }}>
                    <span style={{ fontSize: 10.5, color: "#5a6a85", fontFamily: "monospace" }}>{formatTimeLabel(item.timestamp)}</span>
                    {item.demandaTag && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "rgba(196,122,14,0.15)", color: "#fbbf24", fontFamily: "monospace" }}>#{item.demandaTag}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </aside>

        {/* ══════════ MAIN ════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden">

          {/* Topbar */}
          <div className="h-[50px] border-b flex items-center gap-2.5 px-5 bg-card flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold flex-shrink-0" style={{ background: "#eff6ff", border: "1px solid #c7d7fc", color: "#1e3fa0" }}>
              <span>{currentMode.icon}</span> {currentMode.label}
            </div>

            <div className="w-px h-5 bg-border flex-shrink-0" />

            {/* Chip demanda */}
            {demandaContext && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium max-w-[280px] flex-shrink-0" style={{ background: "#fdf6e8", border: "1px solid #f0d88c", color: "#92540a" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="truncate">Demanda #{demandaContext.protocolo} — {demandaContext.titulo}</span>
                <button onClick={() => setDemandaContext(null)} className="flex-shrink-0 hover:text-red-500 transition-colors ml-0.5" style={{ color: "#c47a0e" }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Chips documentos */}
            {documentosContexto.map((doc) => (
              <div key={doc.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium max-w-[160px] flex-shrink-0" style={{ background: "#eefbf4", border: "1px solid #b0eacc", color: "#166534" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 flex-shrink-0" />
                <span className="truncate">{doc.nome.length > 16 ? doc.nome.slice(0, 16) + "…" : doc.nome}</span>
                <button onClick={() => removerDoc(doc.id)} className="flex-shrink-0 hover:text-red-500 transition-colors ml-0.5" style={{ color: "#1a8c5e" }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Modelo (estático) */}
            <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono text-muted-foreground bg-muted border border-border flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
              sabiazinho-4
            </div>
          </div>

          {/* Área de conversa */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Estado vazio */}
            {showEmpty && (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center overflow-y-auto">
                <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center mb-5 flex-shrink-0" style={{ background: "linear-gradient(135deg,#3068f0,#6c3bd4)", boxShadow: "0 6px 24px rgba(48,104,240,0.3)" }}>
                  <Bot className="w-[26px] h-[26px] text-white" />
                </div>

                {demandaContext ? (
                  <>
                    <h2 className="text-[22px] font-bold tracking-tight mb-1.5">Contexto carregado</h2>
                    <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[420px] mb-7">
                      Já tenho os dados da demanda vinculada. Escolha uma ação rápida ou descreva o que precisa.
                    </p>
                    <div className="max-w-[520px] w-full rounded-xl p-4 flex gap-3 items-start mb-7 text-left flex-shrink-0" style={{ border: "1px solid #f0d88c", background: "#fdf6e8" }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: "rgba(196,122,14,0.1)" }}>📋</div>
                      <div>
                        <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: "#c47a0e" }}>Demanda vinculada</div>
                        <div className="text-[14px] font-semibold mb-0.5">{demandaContext.titulo}</div>
                        <div className="text-[12px] text-muted-foreground">
                          {[demandaContext.municipe, demandaContext.area, `Protocolo #${demandaContext.protocolo}`].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-[22px] font-bold tracking-tight mb-1.5">Olá! Como posso ajudar?</h2>
                    <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[420px] mb-7">
                      Escolha um modo na barra lateral ou comece com uma das sugestões abaixo.
                    </p>
                  </>
                )}

                <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2.5 w-full max-w-[520px] text-left">
                  {demandaContext ? "Ações sugeridas" : "Por onde começar"}
                </div>
                <div className="grid grid-cols-2 gap-2.5 max-w-[520px] w-full">
                  {getSugestoes().map((sug, i) => (
                    <button
                      key={i}
                      onClick={sug.action}
                      className="bg-card border border-border rounded-lg p-4 text-left transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-px"
                    >
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
                {realMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex gap-3 max-w-[700px]"
                    style={{ flexDirection: msg.role === "user" ? "row-reverse" : "row", marginLeft: msg.role === "user" ? "auto" : "0", animationName: "fadeUp", animationDuration: "0.3s" }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-[13px]"
                      style={msg.role === "assistant"
                        ? { background: "linear-gradient(135deg,#3068f0,#6c3bd4)", boxShadow: "0 2px 8px rgba(48,104,240,0.25)" }
                        : { background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }
                      }
                    >
                      {msg.role === "assistant" ? <Bot className="w-4 h-4 text-white" /> : "👤"}
                    </div>

                    {/* Body */}
                    <div className="flex flex-col gap-1 min-w-0" style={{ alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div
                        className="px-4 py-3 text-[13.5px] leading-[1.7]"
                        style={msg.role === "assistant"
                          ? { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "2px 10px 10px 10px" }
                          : { background: "hsl(var(--primary))", borderRadius: "10px 2px 10px 10px", color: "#fff" }
                        }
                      >
                        <MarkdownText className="text-sm">{msg.content}</MarkdownText>
                      </div>

                      {/* Botão "Transformar em propositura" para respostas de análise */}
                      {msg.role === "assistant" && msg.modeId === "analise" && (
                        <button
                          onClick={() => gerarProposituradaAnalise(msg.content)}
                          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all hover:shadow-sm"
                          style={{ background: "#eff6ff", border: "1px solid #c7d7fc", color: "#1e3fa0" }}
                        >
                          📝 Transformar em propositura
                        </button>
                      )}

                      <div className="text-[10.5px] font-mono text-muted-foreground">
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {msg.role === "assistant" && " · sabiazinho-4"}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Indicador de carregamento */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#3068f0,#6c3bd4)", boxShadow: "0 2px 8px rgba(48,104,240,0.25)" }}>
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "2px 10px 10px 10px" }}>
                        {[0, 200, 400].map((delay) => (
                          <span key={delay} className="w-2 h-2 rounded-full bg-muted-foreground/40" style={{ animation: `bounce 1.4s ease-in-out ${delay}ms infinite` }} />
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Loader2 className="w-2.5 h-2.5 text-muted-foreground animate-spin" />
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {activeMode === "analise" ? "Consultando demandas…" : activeMode === "resumo" ? "Compilando dados do gabinete…" : "Redigindo…"}
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
            <div className="rounded-xl overflow-hidden bg-card" style={{ border: "1.5px solid hsl(var(--border))", transition: "border-color 0.15s, box-shadow 0.15s" }}
              onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--primary))"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px hsl(var(--primary)/0.08)"; }}
              onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Mensagem para o Assessor IA (modo: ${currentMode.label})…`}
                disabled={isLoading}
                rows={2}
                className="w-full border-none outline-none resize-none bg-transparent text-[14px] leading-[1.6] min-h-[48px] max-h-[150px] px-4 pt-3 pb-2 text-foreground placeholder:text-muted-foreground/60"
              />
              <div className="flex items-center gap-1 px-2.5 pb-2.5">
                {/* Biblioteca de documentos */}
                <div className="[&>button]:h-auto [&>button]:px-2.5 [&>button]:py-1.5 [&>button]:text-xs [&>button]:rounded-lg [&>button]:font-medium">
                  <BibliotecaDocumentosDialog onDocumentosSelect={handleDocumentosSelect} />
                </div>

                {/* Vincular demanda */}
                {!demandaContext && (
                  <>
                    <div className="w-px h-4 bg-border mx-0.5" />
                    <button
                      onClick={() => toast({ title: "Como vincular uma demanda", description: "Abra uma demanda em Demandas > clique no ícone de menu > Assessor IA. Os dados serão carregados automaticamente." })}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-muted-foreground border border-transparent hover:bg-muted hover:border-border transition-all"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Vincular demanda
                    </button>
                  </>
                )}

                <div className="w-px h-4 bg-border mx-0.5" />
                <span className="text-[11px] font-mono text-muted-foreground">/modo para trocar</span>

                {/* Enviar */}
                <button
                  onClick={() => sendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="ml-auto flex items-center gap-1.5 h-[34px] px-4 rounded-lg text-[13px] font-semibold transition-colors disabled:cursor-not-allowed"
                  style={{ background: !inputMessage.trim() || isLoading ? "hsl(var(--muted))" : "hsl(var(--primary))", color: !inputMessage.trim() || isLoading ? "hsl(var(--muted-foreground))" : "#fff" }}
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

      {/* Keyframes para animações */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(1); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </TooltipProvider>
  );
};

export default AssessorIA;
