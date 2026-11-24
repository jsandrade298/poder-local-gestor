import { useSyncExternalStore } from "react";

/**
 * Tema do Jorgeus (Manual de Identidade Visual):
 *  - Perfil do gabinete ("brasil" | "tech"): definido pelo Super Admin
 *    (tenants.perfil_visual). Fica no <html data-perfil="...">.
 *  - Modo ("claro" | "escuro"): escolha de cada pessoa. Classe .dark no <html>.
 *    Padrão: sempre claro (decisão do gabinete, 24/11/2026).
 * Os dois ficam guardados no navegador para o app abrir já com o visual
 * certo (o index.html aplica antes da primeira pintura).
 */

export type Perfil = "brasil" | "tech";
export type Modo = "claro" | "escuro";

const CHAVE_MODO = "jorgeus-modo";
const CHAVE_PERFIL = "jorgeus-perfil";
const EVENTO = "jorgeus-tema";

const COR_BARRA: Record<Perfil, Record<Modo, string>> = {
  brasil: { claro: "#FFFFFF", escuro: "#08182B" },
  tech: { claro: "#FFFFFF", escuro: "#100B28" },
};

function lerModo(): Modo {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "escuro" : "claro";
}
function lerPerfil(): Perfil {
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-perfil") === "tech" ? "tech" : "brasil";
}

function avisar() {
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", COR_BARRA[lerPerfil()][lerModo()]);
  window.dispatchEvent(new Event(EVENTO));
}

export function aplicarModo(modo: Modo) {
  document.documentElement.classList.toggle("dark", modo === "escuro");
  try { localStorage.setItem(CHAVE_MODO, modo); } catch { /* sem storage */ }
  avisar();
}

export function aplicarPerfil(perfil: Perfil) {
  if (lerPerfil() === perfil) return;
  document.documentElement.setAttribute("data-perfil", perfil);
  try { localStorage.setItem(CHAVE_PERFIL, perfil); } catch { /* sem storage */ }
  avisar();
}

function assinar(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  return () => window.removeEventListener(EVENTO, cb);
}

/** Perfil e modo atuais (re-renderiza quando mudam). */
export function useTema() {
  const modo = useSyncExternalStore(assinar, lerModo, () => "claro" as Modo);
  const perfil = useSyncExternalStore(assinar, lerPerfil, () => "brasil" as Perfil);
  return {
    modo,
    perfil,
    setModo: aplicarModo,
    alternarModo: () => aplicarModo(modo === "escuro" ? "claro" : "escuro"),
  };
}
