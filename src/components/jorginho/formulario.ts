import { useSyncExternalStore } from "react";

/**
 * Ponte entre um formulário aberto na tela e o Jotinha. O formulário se
 * registra enquanto está aberto, diz quais campos tem e sabe se preencher
 * (com a animação de "digitando") e salvar com as próprias regras.
 * Nada é salvo sem a pessoa confirmar — o Jotinha só chama enviar() quando
 * ela diz que pode.
 */

export interface CampoFormulario {
  campo: string;
  rotulo: string;
  tipo: "texto" | "texto_longo" | "opcao" | "data" | "municipe" | "cep";
  obrigatorio?: boolean;
  /** Nomes das opções (para campos de escolha) */
  opcoes?: string[];
}

export interface ResultadoPreencher { aplicados: string[]; avisos: string[] }

export interface FormularioJotinha {
  id: string;
  titulo: string;
  campos(): CampoFormulario[];
  /** Valores atuais, legíveis (nomes em vez de ids) */
  valores(): Record<string, string>;
  preencher(valores: Record<string, string>): Promise<ResultadoPreencher>;
  /** Tenta salvar. Devolve o que falta (lista vazia = enviado). */
  enviar(): string[];
  /** É o formulário aberto pelo Jotinha (continua vivo ao minimizar e trocar de tela) */
  global?: boolean;
  /** Formulário de uma página: passa o que já foi preenchido para o do Jotinha */
  transferir?: (voz: boolean) => void;
}

let atual: FormularioJotinha | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export function registrarFormulario(f: FormularioJotinha) {
  atual = f;
  avisar();
  return () => { if (atual === f) { atual = null; avisar(); } };
}

export const formularioAtual = () => atual;

export function ouvirFormulario(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; }

export function useFormularioAtual() {
  return useSyncExternalStore(ouvirFormulario, () => atual, () => null);
}

/** O formulário avisa que salvou (o Jotinha comemora e encerra). */
export function avisarSalvo(info: { protocolo?: string; titulo?: string }) {
  window.dispatchEvent(new CustomEvent("jotinha:formulario-salvo", { detail: info }));
}

/** O formulário avisa que não conseguiu salvar (o Jotinha explica e continua). */
export function avisarFalhaSalvar(mensagem: string) {
  window.dispatchEvent(new CustomEvent("jotinha:formulario-erro", { detail: { mensagem } }));
}

/** Pede para abrir um formulário com o Jotinha ajudando (de qualquer lugar do app). */
export function abrirFormularioComJotinha(formulario: "nova_demanda", opcoes: { valores?: Record<string, string>; voz?: boolean; relato?: string } = {}) {
  window.dispatchEvent(new CustomEvent("jotinha:abrir-formulario", { detail: { formulario, ...opcoes } }));
}
