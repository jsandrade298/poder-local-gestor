import { cn } from "@/lib/utils";
import { useTema, Perfil, Modo } from "@/lib/tema";

/**
 * Peças da marca Jorgeus (arquivos em /public/brand, gerados por
 * scripts/gerar-marca.py). Escolhem sozinhas a versão do perfil do
 * gabinete e do modo claro/escuro; dá para fixar com `perfil`/`modo`.
 */

interface Base {
  perfil?: Perfil;
  modo?: Modo;
  className?: string;
}

function useVersao(perfil?: Perfil, modo?: Modo) {
  const tema = useTema();
  return { p: perfil ?? tema.perfil, m: (modo ?? tema.modo) === "escuro" ? "escuro" : "claro" };
}

/** Monograma "J" (ícone). Igual no claro e no escuro. */
export function MarcaIcone({ perfil, className }: Omit<Base, "modo">) {
  const { p } = useVersao(perfil);
  return <img src={`/brand/${p}-icone.png`} alt="Jorgeus" className={cn("h-8 w-8 object-contain select-none", className)} draggable={false} />;
}

/** Só a palavra JORGEUS (para a barra lateral e cabeçalhos). */
export function MarcaPalavra({ perfil, modo, className }: Base) {
  const { p, m } = useVersao(perfil, modo);
  return <img src={`/brand/${p}-palavra-${m}.png`} alt="Jorgeus" className={cn("h-4 w-auto object-contain select-none", className)} draggable={false} />;
}

/** Logo completo: símbolo + JORGEUS + "Gestão e Inteligência Parlamentar". */
export function MarcaLogo({ perfil, modo, className }: Base) {
  const { p, m } = useVersao(perfil, modo);
  return (
    <img
      src={`/brand/${p}-logo-${m}.png`}
      alt="Jorgeus — Gestão e Inteligência Parlamentar"
      className={cn("h-12 w-auto object-contain select-none", className)}
      draggable={false}
    />
  );
}
