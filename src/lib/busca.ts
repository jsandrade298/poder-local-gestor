/**
 * Busca normalizada (munícipes e demandas).
 *
 * O banco mantém uma coluna `busca` com o texto pesquisável já em
 * minúsculas, sem acento e com telefone/CPF só em dígitos (migração
 * 20261124005702_busca_normalizada). Aqui normalizamos o que o usuário
 * digitou do mesmo jeito e aplicamos uma condição por palavra, então a
 * ordem das palavras não importa: "silva joao" acha "João da Silva".
 */

/** Minúsculas e sem acento — espelha public.normalizar_busca no banco. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Quebra o termo em palavras normalizadas. Pedaços que parecem telefone
 * ou CPF ("(11)", "99999-1111", "123.456.789-00") viram só dígitos.
 * Remove os curingas do LIKE (% e _) para não virarem "qualquer coisa".
 */
export function palavrasDaBusca(termo: string): string[] {
  return normalizarBusca(termo)
    .replace(/[%_\\]/g, " ")
    .split(/\s+/)
    .map((p) => (/^[\d().+\-/]+$/.test(p) ? p.replace(/\D/g, "") : p))
    .filter((p) => p.length > 0);
}

/**
 * Aplica a busca numa query do Supabase: uma condição `busca ILIKE`
 * por palavra (todas precisam bater). Sem termo, devolve a query intacta.
 */
export function aplicarBusca<Q extends { ilike: (coluna: string, padrao: string) => Q }>(
  query: Q,
  termo: string | null | undefined
): Q {
  if (!termo) return query;
  let q = query;
  for (const palavra of palavrasDaBusca(termo)) {
    q = q.ilike("busca", `%${palavra}%`);
  }
  return q;
}
