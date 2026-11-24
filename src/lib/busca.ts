/**
 * Busca normalizada (munícipes e demandas).
 *
 * O banco mantém, por trigger:
 *  - `busca`: todos os campos pesquisáveis juntos, em minúsculas, sem acento
 *    e com telefone/CPF só em dígitos (migração 20261124005702_busca_normalizada)
 *  - `busca_campos`: os mesmos campos separados, num jsonb
 *    (migração busca_por_campo), para buscar só onde o usuário escolher.
 *
 * Aqui normalizamos o que o usuário digitou do mesmo jeito e aplicamos uma
 * condição por palavra, então a ordem não importa: "silva joao" acha
 * "João da Silva".
 */

/** Minúsculas e sem acento — espelha public.normalizar_busca no banco. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Palavra que parece telefone, CPF ou número de protocolo. */
const PARECE_NUMERO = /^[\d().+\-/]+$/;

/**
 * Quebra o termo em palavras normalizadas. Pedaços que parecem telefone
 * ou CPF ("(11)", "99999-1111", "123.456.789-00") viram só dígitos.
 * Remove os curingas do LIKE (% e _) e caracteres que quebrariam o filtro.
 */
export function palavrasDaBusca(termo: string): string[] {
  return normalizarBusca(termo)
    .replace(/[%_\\",]/g, " ")
    .split(/\s+/)
    .map((p) => (PARECE_NUMERO.test(p) ? p.replace(/\D/g, "") : p))
    .filter((p) => p.length > 0);
}

// ─── Campos pesquisáveis ────────────────────────────────────────────

export interface CampoBusca {
  value: string;
  label: string;
}

/** Valor especial: busca em todos os campos (coluna `busca`). */
export const TODOS_OS_CAMPOS = "todos";

export const CAMPOS_BUSCA_MUNICIPE: CampoBusca[] = [
  { value: "nome", label: "Nome" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "cpf", label: "CPF" },
  { value: "bairro", label: "Bairro" },
  { value: "endereco", label: "Endereço / CEP" },
  { value: "cidade", label: "Cidade" },
];

export const CAMPOS_BUSCA_DEMANDA: CampoBusca[] = [
  { value: "titulo", label: "Título" },
  { value: "protocolo", label: "Protocolo" },
  { value: "municipe", label: "Munícipe" },
  { value: "descricao", label: "Descrição" },
  { value: "bairro", label: "Bairro" },
  { value: "endereco", label: "Endereço / CEP" },
  { value: "cidade", label: "Cidade" },
];

/** Padrões: o que a pessoa normalmente quer achar ao digitar um texto. */
export const CAMPOS_PADRAO_MUNICIPE = ["nome"];
export const CAMPOS_PADRAO_DEMANDA = ["titulo", "protocolo", "municipe"];

/**
 * Campos onde um termo numérico também é procurado, mesmo que não estejam
 * marcados. Assim, com só "Nome" marcado, digitar um telefone ainda acha a
 * pessoa — ninguém tem dígitos no nome.
 */
export const CAMPOS_NUMERICOS_MUNICIPE = ["telefone", "cpf"];
export const CAMPOS_NUMERICOS_DEMANDA = ["protocolo"];

interface OpcoesBusca {
  /** Campos de `busca_campos` a usar. Vazio, ausente ou com "todos" → todos os campos. */
  campos?: string[];
  /** Campos extras para palavras numéricas (telefone, CPF, protocolo). */
  camposNumericos?: string[];
}

type QueryComBusca<Q> = {
  ilike: (coluna: string, padrao: string) => Q;
  or: (filtros: string) => Q;
};

/**
 * Aplica a busca numa query do Supabase. Cada palavra precisa bater em pelo
 * menos um dos campos escolhidos. Sem termo, devolve a query intacta.
 */
export function aplicarBusca<Q extends QueryComBusca<Q>>(
  query: Q,
  termo: string | null | undefined,
  opcoes: OpcoesBusca = {}
): Q {
  if (!termo) return query;
  const palavras = palavrasDaBusca(termo);
  if (palavras.length === 0) return query;

  const campos = opcoes.campos ?? [];
  const usarTodos = campos.length === 0 || campos.includes(TODOS_OS_CAMPOS);

  if (usarTodos) {
    let q = query;
    for (const palavra of palavras) q = q.ilike("busca", `%${palavra}%`);
    return q;
  }

  // Para cada palavra: OR entre os campos escolhidos
  const porPalavra = palavras.map((palavra) => {
    const ehNumero = /^\d+$/.test(palavra);
    const alvo = ehNumero
      ? Array.from(new Set([...campos, ...(opcoes.camposNumericos ?? [])]))
      : campos;
    return alvo.map((c) => `busca_campos->>${c}.ilike."%${palavra}%"`).join(",");
  });

  // Entre palavras: AND — numa única expressão, and(or(...),or(...)),
  // para não depender de como parâmetros `or` repetidos são combinados.
  return porPalavra.length === 1
    ? query.or(porPalavra[0])
    : query.or(`and(${porPalavra.map((p) => `or(${p})`).join(",")})`);
}

// ─── Preferência salva por tela ─────────────────────────────────────

/** Lê os campos escolhidos da última vez (por navegador). */
export function lerCamposSalvos(chave: string, padrao: string[], validos: CampoBusca[]): string[] {
  try {
    const bruto = localStorage.getItem(`busca-campos:${chave}`);
    if (!bruto) return padrao;
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return padrao;
    const permitidos = new Set([TODOS_OS_CAMPOS, ...validos.map((c) => c.value)]);
    const filtrada = lista.filter((v) => typeof v === "string" && permitidos.has(v));
    return filtrada.length > 0 ? filtrada : padrao;
  } catch {
    return padrao;
  }
}

export function salvarCampos(chave: string, campos: string[]) {
  try {
    localStorage.setItem(`busca-campos:${chave}`, JSON.stringify(campos));
  } catch {
    /* navegador sem armazenamento: só não lembra a escolha */
  }
}
