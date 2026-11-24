/**
 * Busca todas as linhas de uma consulta, página por página.
 *
 * O Supabase (PostgREST) devolve no máximo 1.000 linhas por requisição.
 * Sem paginar, totais e gráficos ficam silenciosamente errados quando o
 * gabinete passa desse número.
 *
 * `buildQuery(from, to)` deve montar a consulta já com `.range(from, to)`
 * e com uma ordenação estável (ex.: `.order("id")`), senão páginas podem
 * repetir ou pular linhas.
 */
export async function fetchAll<T = any>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}
