import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

/**
 * Estado guardado no endereço da página (?status=…&bairro=…&pagina=2).
 *
 * Assim os filtros não se perdem ao trocar de tela e voltar, e dá para
 * mandar o link de uma lista já filtrada.
 *
 * Detalhe importante: no React Router v6, várias chamadas a setSearchParams
 * no mesmo clique (ex.: "Limpar filtros") se sobrescrevem. Aqui as mudanças
 * se acumulam num rascunho e são gravadas de uma vez só, no fim do clique.
 */

let rascunho: URLSearchParams | null = null;
let agendado = false;
let gravar: ((busca: string) => void) | null = null;

function editarRascunho(editar: (p: URLSearchParams) => void, navegar: (busca: string) => void) {
  if (!rascunho) rascunho = new URLSearchParams(window.location.search);
  editar(rascunho);
  gravar = navegar;
  if (agendado) return;
  agendado = true;
  queueMicrotask(() => {
    agendado = false;
    const p = rascunho;
    rascunho = null;
    if (p && gravar) gravar(p.toString());
  });
}

function useNavegarBusca() {
  const navigate = useNavigate();
  return useCallback(
    (busca: string) => navigate({ search: busca ? `?${busca}` : "" }, { replace: true }),
    [navigate]
  );
}

type Atualizador<T> = T | ((anterior: T) => T);

/** Texto simples. Some do endereço quando igual ao padrão. */
export function useParamTexto(chave: string, padrao = "") {
  const [url] = useSearchParams();
  const navegar = useNavegarBusca();
  const valor = url.get(chave) ?? padrao;

  const definir = useCallback((novo: Atualizador<string>) => {
    editarRascunho((p) => {
      const anterior = p.get(chave) ?? padrao;
      const v = typeof novo === "function" ? (novo as (a: string) => string)(anterior) : novo;
      if (!v || v === padrao) p.delete(chave); else p.set(chave, v);
    }, navegar);
  }, [chave, padrao, navegar]);

  return [valor, definir] as const;
}

/** Número inteiro (página, itens por página). */
export function useParamNumero(chave: string, padrao: number) {
  const [url] = useSearchParams();
  const navegar = useNavegarBusca();
  const bruto = Number(url.get(chave));
  const valor = Number.isFinite(bruto) && url.has(chave) ? bruto : padrao;

  const definir = useCallback((novo: Atualizador<number>) => {
    editarRascunho((p) => {
      const b = Number(p.get(chave));
      const anterior = Number.isFinite(b) && p.has(chave) ? b : padrao;
      const v = typeof novo === "function" ? (novo as (a: number) => number)(anterior) : novo;
      if (v === padrao) p.delete(chave); else p.set(chave, String(v));
    }, navegar);
  }, [chave, padrao, navegar]);

  return [valor, definir] as const;
}

/** Lista de valores (filtros de seleção múltipla): ?bairro=A&bairro=B */
export function useParamLista(chave: string) {
  const [url] = useSearchParams();
  const navegar = useNavegarBusca();
  const juntos = url.getAll(chave).join("\u0001");
  const valor = useMemo(() => (juntos ? juntos.split("\u0001") : []), [juntos]);

  const definir = useCallback((novo: Atualizador<string[]>) => {
    editarRascunho((p) => {
      const anterior = p.getAll(chave);
      const v = typeof novo === "function" ? (novo as (a: string[]) => string[])(anterior) : novo;
      p.delete(chave);
      v.forEach((item) => p.append(chave, item));
    }, navegar);
  }, [chave, navegar]);

  return [valor, definir] as const;
}

/** Altera várias chaves de uma vez (null apaga). Não mexe nas outras. */
export function useDefinirParams() {
  const navegar = useNavegarBusca();
  return useCallback((mudancas: Record<string, string | null>) => {
    editarRascunho((p) => {
      for (const [k, v] of Object.entries(mudancas)) {
        if (v === null) p.delete(k); else p.set(k, v);
      }
    }, navegar);
  }, [navegar]);
}

/**
 * Lembra os filtros da tela nesta aba do navegador. Ao voltar pelo menu
 * (que leva ao endereço sem filtros), restaura os últimos usados.
 * Parâmetros que só abrem um item (ex.: ?id=, ?protocolo=) não são lembrados.
 */
export function useLembrarFiltros(chave: string, ignorar: string[] = []) {
  const location = useLocation();
  const navigate = useNavigate();
  const restaurou = useRef(false);
  const chaveStorage = `filtros:${chave}`;

  // Ao abrir sem filtros no endereço, restaura os últimos (antes de pintar a tela)
  useLayoutEffect(() => {
    if (restaurou.current) return;
    restaurou.current = true;
    if (location.search) return;
    try {
      const salvo = sessionStorage.getItem(chaveStorage);
      if (salvo) navigate({ search: `?${salvo}` }, { replace: true });
    } catch { /* sem storage: só não restaura */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guarda os filtros atuais sempre que mudarem
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    ignorar.forEach((k) => p.delete(k));
    try {
      const s = p.toString();
      if (s) sessionStorage.setItem(chaveStorage, s);
      else sessionStorage.removeItem(chaveStorage);
    } catch { /* sem storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
}
