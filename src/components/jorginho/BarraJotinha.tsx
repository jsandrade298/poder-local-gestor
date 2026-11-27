import { useState } from "react";
import { Keyboard, Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  alternarMudo, alternarVoz, encerrarAssistente, iniciarAssistente, minimizarLigacao, responderAssistente, tocarMicrofone, useAssistente,
} from "./assistente";
import { Chamada } from "./Chamada";
import { useFormularioAtual } from "./formulario";
import { ConviteJotinha, FaixaLigacao } from "./ui";
import { podeOuvir } from "./voz";

/**
 * Barra do Jotinha no topo de um formulário: antes, um convite para
 * "preencher conversando"; durante, a ligação (estilo telefone, sem
 * transcrição) — ou a conversa escrita, se o navegador não tiver voz.
 */
export function BarraJotinha({ className }: { className?: string }) {
  const form = useFormularioAtual();
  const a = useAssistente();
  const [texto, setTexto] = useState("");
  const temVoz = podeOuvir();
  if (!form) return null;

  // A ligação desta tela é a do formulário (na conversa, a ligação aparece no painel)
  if (!a.ativo || a.modo !== "formulario") {
    const comecar = () => {
      // Formulário de uma página: passa para o do Jotinha, que continua vivo se você minimizar ou trocar de tela
      if (!form.global && form.transferir) { form.transferir(temVoz); return; }
      iniciarAssistente({ voz: temVoz });
    };
    return (
      <ConviteJotinha className={className}
        titulo="Preencha conversando com o Jotinha"
        texto={temVoz ? "Você fala, ele pergunta e vai preenchendo os campos." : "Você responde, ele pergunta e vai preenchendo os campos."}
        acao={
          <Button type="button" size="sm" className="shrink-0 gap-1.5 rounded-full" onClick={comecar}>
            {temVoz ? <Mic className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />} Começar
          </Button>
        } />
    );
  }

  // Com voz: é uma ligação de verdade (sem texto na tela); sem voz: conversa escrita
  if (a.voz) {
    return (
      <Chamada variante="compacta" className={className} fase={a.fase} mudo={a.mudo} erro={a.erro} fala={a.legenda}
        inicio={a.inicio} noAparelho={a.noAparelho}
        onTocar={tocarMicrofone} onMudo={alternarMudo} onDesligar={encerrarAssistente} onDigitar={responderAssistente}
        onMinimizar={form.global ? minimizarLigacao : undefined} />
    );
  }
  const enviar = () => { if (!texto.trim()) return; responderAssistente(texto); setTexto(""); };
  return (
    <FaixaLigacao className={className} fase={a.fase} legenda={a.legenda || "…"} ouvido={a.ouvido} erro={a.erro}
      voz={a.voz} temVoz={temVoz} onMic={tocarMicrofone} onAlternarVoz={alternarVoz} onDesligar={encerrarAssistente}>
      <div className="flex items-center gap-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); enviar(); } }}
          placeholder="Digite a resposta para o Jotinha…" aria-label="Resposta para o Jotinha"
          className="h-8 min-w-0 flex-1 rounded-full border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <Button type="button" size="icon" className="h-8 w-8 rounded-full" onClick={enviar} disabled={!texto.trim() || a.fase === "pensando"} aria-label="Enviar resposta">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </FaixaLigacao>
  );
}
