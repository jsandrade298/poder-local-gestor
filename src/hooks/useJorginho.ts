import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReceitaWidget } from "@/components/jorginho/widgets/receita";

/** Chamadas à função `jorginho` (o servidor fala com a IA e com o banco). */

export type AcaoJorginho =
  | { tipo: "criar_tarefa"; titulo: string; prazo?: string | null; descricao?: string | null; boardId?: string | null; quadroNome?: string | null; demandaId?: string | null; protocolo?: string | null; responsavelId?: string | null; responsavelNome?: string | null }
  | { tipo: "alterar_demanda"; demandas: { id: string; protocolo: string; titulo: string }[]; status?: { slug: string; nome: string }; prioridade?: string; area?: { id: string; nome: string } }
  | { tipo: "registrar_prontuario"; municipeId: string; municipeNome: string; atividade: string; titulo: string; texto: string }
  | { tipo: "criar_municipe"; nome: string; bairro?: string | null }
  | { tipo: "criar_compromisso"; titulo: string; inicio: string; fim: string; local?: string | null; agenda: "pessoal" | "mandato"; demandaId?: string | null; protocolo?: string | null }
  /** Abre uma tela (não muda nada: executa na hora) */
  | { tipo: "navegar"; link: string; rotulo: string }
  | { tipo: "mudar_responsavel"; demandas: { id: string; protocolo: string; titulo: string }[]; pessoaId: string; pessoaNome: string }
  | { tipo: "mudar_prazo"; demandaId: string; protocolo: string; titulo: string; prazo: string }
  | { tipo: "comentar"; demandaId: string; protocolo: string; titulo: string; texto: string; atividade?: string }
  /** Abre o formulário na tela e o Jotinha preenche junto (não salva nada sozinho) */
  | { tipo: "abrir_formulario"; formulario: "nova_demanda"; valores?: Record<string, string> };

export interface RespostaConversa { resposta: string; acoes: AcaoJorginho[]; uso?: { hoje: number; limite: number }; modelo?: string }

export class ErroJorginho extends Error {
  constructor(message: string, public codigo?: string) { super(message); }
}

async function chamar<T>(acao: string, corpo: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("jorginho", { body: { acao, ...corpo } });
  if (error) {
    let msg = "O Jotinha não respondeu. Tente de novo.", codigo: string | undefined;
    try { const c = await (error as any)?.context?.json(); msg = c?.error || msg; codigo = c?.codigo; } catch { /* sem corpo */ }
    throw new ErroJorginho(msg, codigo);
  }
  if (data?.success === false) throw new ErroJorginho(data.error || "Não deu certo.", data.codigo);
  return data as T;
}

export const conversarComJorginho = (mensagens: { role: "user" | "assistant"; content: string }[], contexto: Record<string, unknown>) =>
  chamar<RespostaConversa>("conversar", { mensagens, contexto });

export const pedirWidget = (pedido: string, atual?: ReceitaWidget | null) =>
  chamar<{ receita: ReceitaWidget; uso?: { hoje: number; limite: number } }>("oficina", { pedido, atual: atual ?? undefined });

/** Piadinha para o Jotinha puxar assunto sozinho. */
export const pedirPiada = (momento: string) => chamar<{ piada: string }>("piada", { momento });

/** Uma rodada do preenchimento conversado: a IA diz o que falar e o que preencher. */
export const pedirPreenchimento = (
  mensagens: { role: "user" | "assistant"; content: string }[],
  formulario: { id: string; titulo: string; campos: unknown[]; valores: Record<string, string>; pulados?: string[] },
) => chamar<{
  fala: string;
  /** O que ele anotou (dito enquanto os campos se preenchem) */
  confirmacao?: string;
  /** A próxima pergunta, escolhida pelo sistema (o primeiro campo ainda vazio) */
  pergunta?: string;
  preencher: Record<string, string>; pulados?: string[]; enviar: boolean; encerrar: boolean;
}>("preencher", { mensagens, formulario });

export function useStatusJorginho(habilitado = true) {
  return useQuery({
    queryKey: ["jorginho-status"],
    enabled: habilitado,
    queryFn: () => chamar<{ ia: boolean; usadasHoje: number; limiteDia: number; modelo: string }>("status"),
    staleTime: 60_000,
    retry: false,
  });
}
