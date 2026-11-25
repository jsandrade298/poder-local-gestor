import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra de rolagem lateral do quadro, logo acima das colunas.
 * A barra nativa fica lá embaixo, depois da coluna mais comprida (e some no
 * celular); esta fica sempre à vista: arraste o marcador, toque na trilha
 * ou use as setas para passar pelas etapas.
 */
export function BarraRolagem({ alvo, className }: { alvo: RefObject<HTMLElement>; className?: string }) {
  const trilha = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ visivel: false, largura: 1, inicio: 0, noComeco: true, noFim: false });

  const medir = useCallback(() => {
    const el = alvo.current;
    if (!el) return;
    const total = el.scrollWidth, vista = el.clientWidth;
    const max = Math.max(1, total - vista);
    const novo = {
      visivel: total > vista + 4,
      largura: Math.min(1, vista / total),
      inicio: (el.scrollLeft / max) * (1 - vista / total),
      noComeco: el.scrollLeft <= 2,
      noFim: el.scrollLeft >= max - 2,
    };
    // Só atualiza se mudou (evita renderizar à toa a cada rolagem igual)
    setM((v) => (v.visivel === novo.visivel && v.noComeco === novo.noComeco && v.noFim === novo.noFim &&
      Math.abs(v.largura - novo.largura) < 0.001 && Math.abs(v.inicio - novo.inicio) < 0.001 ? v : novo));
  }, [alvo]);

  useEffect(() => {
    const el = alvo.current;
    if (!el) return;
    el.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    // Colunas entrando e saindo (filtros, agrupar por pessoa) mudam a largura total
    const mo = new MutationObserver(() => { medir(); Array.from(el.children).forEach((c) => ro.observe(c)); });
    mo.observe(el, { childList: true });
    Array.from(el.children).forEach((c) => ro.observe(c));
    medir();
    return () => { el.removeEventListener("scroll", medir); ro.disconnect(); mo.disconnect(); };
  }, [alvo, medir]);

  /** Leva a rolagem para a posição (0..1) do ponteiro na trilha. */
  const irPara = (clientX: number, deslocamento = 0) => {
    const el = alvo.current, t = trilha.current;
    if (!el || !t) return;
    const r = t.getBoundingClientRect();
    const frac = (clientX - r.left - deslocamento) / (r.width * (1 - m.largura) || 1);
    el.scrollLeft = Math.max(0, Math.min(1, frac)) * (el.scrollWidth - el.clientWidth);
  };

  const arrastar = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = trilha.current;
    if (!t) return;
    e.preventDefault();
    const r = t.getBoundingClientRect();
    const inicioMarcador = r.left + m.inicio * r.width;
    const larguraMarcador = m.largura * r.width;
    // Clicou no marcador: arrasta a partir dali; na trilha: centraliza no ponto
    const pegou = e.clientX >= inicioMarcador && e.clientX <= inicioMarcador + larguraMarcador;
    const desloc = pegou ? e.clientX - inicioMarcador : larguraMarcador / 2;
    const el = alvo.current;
    if (el) el.style.scrollBehavior = "auto";
    irPara(e.clientX, desloc);
    const mover = (ev: PointerEvent) => irPara(ev.clientX, desloc);
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      if (el) el.style.scrollBehavior = "";
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const passo = (dir: 1 | -1) => {
    const el = alvo.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (!m.visivel) return null;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button type="button" onClick={() => passo(-1)} disabled={m.noComeco} aria-label="Etapas anteriores"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div ref={trilha} onPointerDown={arrastar} role="scrollbar" aria-orientation="horizontal" aria-label="Rolar entre as etapas"
        aria-valuenow={Math.round((m.inicio / Math.max(0.0001, 1 - m.largura)) * 100)} aria-valuemin={0} aria-valuemax={100}
        className="relative h-2.5 flex-1 cursor-pointer touch-none rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-full bg-primary/60 hover:bg-primary transition-colors"
          style={{ left: `${m.inicio * 100}%`, width: `${m.largura * 100}%` }} />
      </div>
      <button type="button" onClick={() => passo(1)} disabled={m.noFim} aria-label="Próximas etapas"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
