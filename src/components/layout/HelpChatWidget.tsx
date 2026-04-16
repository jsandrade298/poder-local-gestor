import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircleQuestion, Send, X, Loader2, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ─── Configuração ────────────────────────────────────────────

const ASSISTANT_NAME = "Navi";
const ASSISTANT_SUBTITLE = "Sua guia no Poder Local";

// ─── Tipos ───────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Componente ──────────────────────────────────────────────

export function HelpChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll ao receber mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Foco no input ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setHasUnread(false);
    }
  }, [isOpen]);

  // Mensagem de boas-vindas
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Olá! 👋 Eu sou a **${ASSISTANT_NAME}**, sua guia no Poder Local.\n\nPosso te ajudar com:\n• Como usar cada funcionalidade\n• Onde encontrar coisas no sistema\n• Dicas e fluxos de trabalho\n\nÉ só perguntar!`,
        },
      ]);
    }
  }, [isOpen]);

  // ──────────────────────────────────────────────
  // Enviar mensagem
  // ──────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      // Histórico para API (sem mensagem de boas-vindas)
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("chat-ajuda", {
        body: {
          message: text,
          conversationHistory: history,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message || "Desculpe, não consegui processar. Tente novamente.",
      };

      setMessages((prev) => [...prev, aiMsg]);

      if (!isOpen) setHasUnread(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error && err.message.includes("Maritaca")
          ? "Estou com dificuldades técnicas no momento. Por favor, tente novamente mais tarde."
          : "Ops, tive um problema ao processar. Tente novamente em alguns segundos.";

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Conversa limpa! 🧹 Como posso te ajudar?",
      },
    ]);
  };

  // ──────────────────────────────────────────────
  // Render: formatação básica de markdown
  // ──────────────────────────────────────────────
  const renderBold = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const formatContent = (text: string) => {
    return text.split("\n").map((line, lineIdx) => {
      // Bullet points
      if (line.startsWith("• ") || line.startsWith("- ")) {
        const content = line.slice(2);
        return (
          <div key={lineIdx} className="flex gap-1.5 ml-1">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>{renderBold(content)}</span>
          </div>
        );
      }
      // Numbered items
      const numMatch = line.match(/^(\d+)\.\s(.+)/);
      if (numMatch) {
        return (
          <div key={lineIdx} className="flex gap-1.5 ml-1">
            <span className="text-primary font-semibold min-w-[18px] shrink-0">{numMatch[1]}.</span>
            <span>{renderBold(numMatch[2])}</span>
          </div>
        );
      }
      // Empty line = spacer
      if (line.trim() === "") {
        return <div key={lineIdx} className="h-1.5" />;
      }
      // Normal line
      return <div key={lineIdx}>{renderBold(line)}</div>;
    });
  };

  // ──────────────────────────────────────────────
  // Auto-resize textarea
  // ──────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
  };

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <>
      {/* ── Overlay escuro ao abrir (mobile) ─── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9970] bg-black/30 md:bg-transparent"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Painel lateral direito ──────────────── */}
      <div
        className={cn(
          "fixed z-[9980] top-0 right-0 h-full bg-background border-l shadow-2xl",
          "flex flex-col",
          "transition-transform duration-300 ease-in-out",
          // Largura
          "w-full sm:w-[380px]",
          // Slide in/out
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* ── Header ───────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center text-lg">
              💬
            </div>
            <div>
              <h3 className="text-sm font-bold leading-none">{ASSISTANT_NAME}</h3>
              <p className="text-[10px] opacity-80 mt-0.5">{ASSISTANT_SUBTITLE}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={clearChat}
              title="Limpar conversa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Messages ─────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain min-h-0">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                {formatContent(msg.content)}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ───────────────────────── */}
        <div className="shrink-0 border-t bg-background p-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua dúvida..."
              rows={1}
              className={cn(
                "flex-1 resize-none rounded-xl border bg-muted/50 px-3.5 py-2.5 text-sm",
                "placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30",
                "max-h-24"
              )}
              style={{ fontSize: "16px", minHeight: "40px" }}
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="h-10 w-10 rounded-xl shrink-0"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Aba lateral fixa (botão de abrir) ───── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed z-[9970] right-0 top-1/2 -translate-y-1/2",
            "flex items-center gap-1",
            "bg-primary text-primary-foreground",
            "px-1.5 py-3 rounded-l-lg shadow-lg",
            "hover:px-2.5 hover:shadow-xl",
            "transition-all duration-200",
            "writing-mode-vertical"
          )}
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          title="Precisa de ajuda?"
        >
          <MessageCircleQuestion className="h-4 w-4 rotate-90 mb-1" />
          <span className="text-xs font-medium tracking-wide">Ajuda</span>

          {/* Badge de não lida */}
          {hasUnread && (
            <span className="absolute -top-1 -left-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center animate-pulse">
              <span className="text-[9px] font-bold text-destructive-foreground">!</span>
            </span>
          )}
        </button>
      )}
    </>
  );
}
