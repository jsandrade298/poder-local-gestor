import { useId } from "react";
import { useTema, type Modo, type Perfil } from "@/lib/tema";
import { cn } from "@/lib/utils";

/**
 * O Jotinha "Clipy": um clipe metálico dobrado em J (a letra da marca), com
 * olhos de íris e sobrancelhas que falam por ele.
 * Cores do perfil do gabinete (Brasil! ou Tech) e versão própria para o modo
 * escuro (contorno nítido + aura suave, para não virar "fantasma").
 */

export type Expressao =
  | "normal" | "falando" | "ouvindo" | "pensando" | "duvida" | "ideia" | "feliz" | "coracao"
  | "acenando" | "surpreso" | "animado" | "alerta" | "erro" | "ocupado" | "dormindo"
  /** apelido antigo de "ideia" (piscadinha + brilho) */
  | "piscando";

const TEMAS = {
  brasil: {
    contornoClaro: "#16224C", contornoEscuro: "#0F1B3D", auraEscuro: "rgba(96, 165, 250, 0.24)",
    tracoFacialEscuro: "#93C5FD", bocaEscura: "#1E3A8A",
    metalA: "#3B82F6", metalB: "#1D4ED8", metalC: "#16A34A",
    marca1: "#1D4ED8", marca2: "#16A34A", marca3: "#FACC15", coracao: "#F43F5E", acento: "#22C55E",
  },
  tech: {
    contornoClaro: "#191E4D", contornoEscuro: "#171336", auraEscuro: "rgba(168, 85, 247, 0.26)",
    tracoFacialEscuro: "#D8B4FE", bocaEscura: "#4C1D95",
    metalA: "#60A5FA", metalB: "#7C3AED", metalC: "#D91696",
    marca1: "#D91696", marca2: "#7C3AED", marca3: "#84CC16", coracao: "#EC4899", acento: "#C084FC",
  },
};

// Animações: uma folha só para todos os Jotinhas da página
const CSS = `
@keyframes cp-flutuar { 0%, 100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(-7px) rotate(.8deg) } }
@keyframes cp-sombra { 0%, 100% { transform: scaleX(1); opacity: .22 } 50% { transform: scaleX(.82); opacity: .12 } }
@keyframes cp-pular { 0%, 100% { transform: translateY(0) rotate(0) scaleY(1) } 15% { transform: translateY(4px) scaleY(.94) } 38% { transform: translateY(-22px) rotate(-5deg) scaleY(1.03) } 60% { transform: translateY(0) rotate(0) scaleY(.96) } 78% { transform: translateY(-10px) rotate(4deg) scaleY(1.01) } }
@keyframes cp-carinho { 0%, 100% { transform: translateY(0) rotate(-1.5deg) scale(1) } 35% { transform: translateY(-7px) rotate(2deg) scale(1.02) } 70% { transform: translateY(-2px) rotate(-2deg) scale(1.01) } }
@keyframes cp-acenar { 0%, 100% { transform: rotate(0) translateY(0) } 18% { transform: rotate(-11deg) translateY(-5px) } 36% { transform: rotate(9deg) translateY(-2px) } 54% { transform: rotate(-9deg) translateY(-4px) } 72% { transform: rotate(6deg) translateY(-1px) } }
@keyframes cp-inclinar { 0%, 100% { transform: rotate(0) } 40% { transform: rotate(-6.5deg) } }
@keyframes cp-escutar { 0%, 100% { transform: rotate(0) translateY(0) } 50% { transform: rotate(5deg) translateY(-3px) } }
@keyframes cp-animado { 0%, 100% { transform: translateY(0) rotate(0) scale(1) } 25% { transform: translateY(-8px) rotate(-3deg) scale(1.02) } 50% { transform: translateY(-2px) rotate(3deg) scale(.99) } 75% { transform: translateY(-9px) rotate(-2deg) scale(1.02) } }
@keyframes cp-erro-tremer { 0%, 100% { transform: translateX(0) rotate(0) } 20% { transform: translateX(-3px) rotate(-2deg) } 40% { transform: translateX(3px) rotate(2deg) } 60% { transform: translateX(-2px) rotate(-1deg) } 80% { transform: translateX(2px) rotate(1deg) } }
@keyframes cp-dormir { 0%, 100% { transform: translateY(2px) rotate(-1.5deg) } 50% { transform: translateY(5px) rotate(-2.5deg) } }
@keyframes cp-piscar { 0%, 92%, 100% { transform: scaleY(1) } 95.5% { transform: scaleY(.06) } }
@keyframes cp-olhar { 0%, 28% { transform: translate(0, 0) } 34%, 52% { transform: translate(2.6px, -.9px) } 58%, 78% { transform: translate(-2.6px, .9px) } 84%, 100% { transform: translate(0, 0) } }
@keyframes cp-coracao-badge { 0%, 100% { transform: translateY(0) scale(.96) } 50% { transform: translateY(-3px) scale(1.12) } }
@keyframes cp-sobrancelha { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
@keyframes cp-falar { 0%, 100% { transform: scaleY(.38) scaleX(1.08) } 50% { transform: scaleY(1.18) scaleX(.94) } }
@keyframes cp-ponto { 0%, 100% { opacity: .2; transform: translateY(0) } 50% { opacity: 1; transform: translateY(-3px) } }
@keyframes cp-zzz { 0% { opacity: 0; transform: translate(0, 4px) scale(.65) } 28% { opacity: 1 } 100% { opacity: 0; transform: translate(12px, -18px) scale(1.15) } }
@keyframes cp-brilho { 0%, 100% { opacity: .25; transform: scale(.85) rotate(-10deg) } 50% { opacity: 1; transform: scale(1.15) rotate(10deg) } }
@keyframes cp-onda { 0% { opacity: 0; transform: translateX(0) } 45% { opacity: 1 } 100% { opacity: 0; transform: translateX(-4px) } }
@keyframes cp-simbolo-flutuar { 0%, 100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-4px) scale(1.06) } }
.jt-svg .cp-corpo { transform-origin: 120px 218px; animation: cp-flutuar 3.2s ease-in-out infinite }
.jt-svg .cp-sombra { transform-box: fill-box; transform-origin: center; animation: cp-sombra 3.2s ease-in-out infinite }
.jt-svg.exp-feliz .cp-corpo { animation: cp-pular 1.05s ease-in-out infinite }
.jt-svg.exp-coracao .cp-corpo { animation: cp-carinho 1.5s ease-in-out infinite }
.jt-svg.exp-acenando .cp-corpo { animation: cp-acenar 1.2s ease-in-out infinite }
.jt-svg.exp-ideia .cp-corpo, .jt-svg.exp-pensando .cp-corpo, .jt-svg.exp-duvida .cp-corpo { animation: cp-inclinar 2.2s ease-in-out infinite }
.jt-svg.exp-ouvindo .cp-corpo { animation: cp-escutar 2.4s ease-in-out infinite }
.jt-svg.exp-animado .cp-corpo { animation: cp-animado .85s ease-in-out infinite }
.jt-svg.exp-alerta .cp-corpo { animation: cp-inclinar 1.2s ease-in-out infinite }
.jt-svg.exp-erro .cp-corpo { animation: cp-erro-tremer .75s ease-in-out infinite }
.jt-svg.exp-dormindo .cp-corpo { animation: cp-dormir 3.6s ease-in-out infinite }
.jt-svg .cp-olho { transform-box: fill-box; transform-origin: center; animation: cp-piscar 4.6s infinite }
.jt-svg .cp-coracao-badge { transform-box: fill-box; transform-origin: center; animation: cp-coracao-badge 1.25s ease-in-out infinite }
.jt-svg .cp-pupilas { animation: cp-olhar 8.5s ease-in-out infinite }
.jt-svg.exp-falando .cp-sobrancelhas, .jt-svg.exp-ideia .cp-sobrancelhas, .jt-svg.exp-animado .cp-sobrancelhas, .jt-svg.exp-coracao .cp-sobrancelhas { animation: cp-sobrancelha .9s ease-in-out infinite }
.jt-svg .cp-boca-falando { transform-box: fill-box; transform-origin: center; animation: cp-falar .26s ease-in-out infinite }
.jt-svg .cp-ponto { animation: cp-ponto 1.15s infinite } .jt-svg .cp-ponto:nth-child(2) { animation-delay: .2s } .jt-svg .cp-ponto:nth-child(3) { animation-delay: .4s }
.jt-svg .cp-z { animation: cp-zzz 2.4s ease-in infinite } .jt-svg .cp-z2 { animation-delay: 1.2s }
.jt-svg .cp-brilho { transform-box: fill-box; transform-origin: center; animation: cp-brilho 1.05s ease-in-out infinite }
.jt-svg .cp-onda { animation: cp-onda 1.4s ease-out infinite } .jt-svg .cp-onda2 { animation-delay: .35s }
.jt-svg .cp-simbolo { transform-box: fill-box; transform-origin: center; animation: cp-simbolo-flutuar 1.5s ease-in-out infinite }
.jt-svg.jt-parado .cp-corpo, .jt-svg.jt-parado .cp-sombra { animation: none }
@media (prefers-reduced-motion: reduce) { .jt-svg * { animation: none !important } }
`;
if (typeof document !== "undefined") {
  const el = document.getElementById("jotinha-css") || Object.assign(document.createElement("style"), { id: "jotinha-css" });
  el.textContent = CSS;
  if (!el.parentNode) document.head.appendChild(el);
}

const PATH_J_PRINCIPAL = "M 84 156 L 96 68 C 100 35 122 19 147 21 C 171 23 186 43 181 73 L 164 185 C 158 226 127 246 90 241 C 56 237 37 212 42 184 C 45 167 59 157 72 164";
const PATH_DOBRA_BAIXA = "M 151 132 L 145 162 C 141 179 127 187 114 183 C 103 180 99 168 102 153";

type Tema = (typeof TEMAS)["brasil"];
interface Paleta { contorno: string; tracoFacial: string; bocaFundo: string }

function Tubo({ d, t, p, escuro, id }: { d: string; t: Tema; p: Paleta; escuro: boolean; id: string }) {
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      {escuro && <path d={d} stroke={t.auraEscuro} strokeWidth="15.5" />}
      <path d={d} stroke={p.contorno} strokeWidth="11.5" />
      <path d={d} stroke={`url(#metal-azul-${id})`} strokeWidth="8.6" />
      <path d={d} stroke={`url(#metal-prata-${id})`} strokeWidth="5.2" transform="translate(-1.1, -0.8)" />
      <path d={d} stroke="#FFFFFF" strokeWidth="1.6" opacity="0.88" transform="translate(-1.8, -1.3)" />
    </g>
  );
}

function Olho({ cx, cy, fechado, e, olhar, p, id }: { cx: number; cy: number; fechado: boolean; e: Expressao; olhar: { dx: number; dy: number }; p: Paleta; id: string }) {
  if (fechado) {
    return e === "dormindo"
      ? <path d={`M ${cx - 10.5} ${cy + 1} Q ${cx} ${cy + 8.5} ${cx + 10.5} ${cy + 1}`} fill="none" stroke={p.tracoFacial} strokeWidth="3.3" strokeLinecap="round" />
      : <path d={`M ${cx - 10.5} ${cy + 3} Q ${cx} ${cy - 7.5} ${cx + 10.5} ${cy + 3}`} fill="none" stroke={p.tracoFacial} strokeWidth="3.5" strokeLinecap="round" />;
  }
  const rx = e === "surpreso" ? 13.8 : 12.6, ry = e === "surpreso" ? 16.2 : 14.8, rp = e === "surpreso" ? 5.2 : 6.2;
  const x = cx + olhar.dx, y = cy + olhar.dy;
  return (
    <g className="cp-olho">
      <ellipse cx={cx} cy={cy + 1.5} rx={rx + 0.4} ry={ry + 0.4} fill="#000" opacity="0.16" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#olho-grad-${id})`} stroke={p.contorno} strokeWidth="2.1" />
      <g className={e === "normal" ? "cp-pupilas" : undefined}>
        <circle cx={x} cy={y} r={rp} fill="#1E293B" />
        <circle cx={x} cy={y} r={Math.max(2.6, rp * 0.56)} fill="#090F24" />
        <circle cx={x + 2.1} cy={y - 2.6} r="2.1" fill="#FFF" />
        <circle cx={x - 1.9} cy={y + 2.2} r="0.95" fill="#FFF" opacity="0.72" />
      </g>
    </g>
  );
}

function Sobrancelhas({ e, p }: { e: Expressao; p: Paleta }) {
  const s = { fill: "none", stroke: p.tracoFacial, strokeWidth: 4.2, strokeLinecap: "round" as const };
  const par = (a: string, b: string, extra?: object) => <g className="cp-sobrancelhas"><path d={a} {...s} {...extra} /><path d={b} {...s} {...extra} /></g>;
  switch (e) {
    case "pensando": return par("M 107 55 Q 118 47 129 54", "M 143 58 Q 154 56 164 60");
    case "duvida": return par("M 107 58 Q 118 54 129 58", "M 143 51 Q 154 43 164 50");
    case "feliz": case "acenando": case "animado": return par("M 107 52 Q 118 43 129 51", "M 143 52 Q 154 44 164 53");
    case "coracao": return par("M 107 51 Q 118 43 129 50", "M 143 51 Q 154 43 164 51");
    case "surpreso": return par("M 107 48 Q 118 40 129 48", "M 143 48 Q 154 40 164 48");
    case "alerta": case "erro": return par("M 108 52 L 128 59", "M 163 52 L 143 59");
    case "dormindo": return par("M 108 61 Q 118 59 128 61", "M 144 61 Q 154 59 164 61", { strokeWidth: 3.8 });
    default: return par("M 107 56 Q 118 48 129 55", "M 143 56 Q 154 49 164 57");
  }
}

function Boca({ e, p, escuro }: { e: Expressao; p: Paleta; escuro: boolean }) {
  const traco = { fill: "none", stroke: p.tracoFacial, strokeLinecap: "round" as const };
  switch (e) {
    case "falando":
      return (
        <g className="cp-boca-falando">
          <ellipse cx="136" cy="99" rx="8.5" ry="7.2" fill={p.bocaFundo} stroke={p.tracoFacial} strokeWidth="1.5" />
          <path d="M 130 102 Q 136 98 142 102 Q 140 106 136 106 Q 132 106 130 102 Z" fill="#F43F5E" />
        </g>
      );
    case "feliz": case "acenando": case "animado": case "coracao": {
      const dy = e === "coracao" ? 1 : 0;
      return (
        <g>
          <path d={`M 122 ${93 + dy} Q 136 ${98 + dy * 2} 150 ${92 + dy} Q 148 ${110 + dy} 136 ${110 + dy} Q 124 ${110 + dy} 122 ${93 + dy} Z`} fill={p.bocaFundo} stroke={p.tracoFacial} strokeWidth="1.6" />
          <path d={`M 127 ${104 + dy} Q 136 ${99 + dy} 145 ${104 + dy} Q 143 ${110 + dy} 136 ${110 + dy} Q 129 ${110 + dy} 127 ${104 + dy} Z`} fill={e === "coracao" ? "#FB7185" : "#F43F5E"} />
        </g>
      );
    }
    case "surpreso":
      return (
        <g>
          <ellipse cx="136" cy="100" rx="7.2" ry="9.8" fill={p.bocaFundo} stroke={p.tracoFacial} strokeWidth="1.6" />
          <ellipse cx="136" cy="104" rx="4.2" ry="3.8" fill="#F43F5E" />
        </g>
      );
    case "pensando": case "duvida": case "ocupado":
      return <path d="M 128 100 Q 133 97 138 100 Q 142 102 146 98" {...traco} strokeWidth="3.3" />;
    case "alerta": case "erro":
      return <path d="M 125 103 Q 136 96 147 103" {...traco} strokeWidth="3.4" />;
    case "dormindo":
      return <ellipse cx="136" cy="99" rx="3.4" ry="2.6" fill={p.tracoFacial} opacity="0.85" />;
    case "ideia": case "piscando": case "ouvindo":
      return <g><path d="M 123 95 Q 136 106 150 94" {...traco} strokeWidth="3.5" /><path d="M 147 91.5 L 151.5 96" {...traco} strokeWidth="2.7" /></g>;
    default:
      return (
        <g>
          <path d="M 129 103 Q 136 106 143 103" fill="none" stroke={escuro ? "#94A3B8" : "#93A8D1"} strokeWidth="2.1" strokeLinecap="round" opacity="0.7" />
          <path d="M 123 95 Q 136 105 149 94" {...traco} strokeWidth="3.5" />
          <path d="M 147 91.5 L 151.5 96" {...traco} strokeWidth="2.7" />
        </g>
      );
  }
}

function Extras({ e, t, p, escuro }: { e: Expressao; t: Tema; p: Paleta; escuro: boolean }) {
  const simbolo = (texto: string, cor: string) => (
    <g className="cp-simbolo" fill={cor} stroke={p.contorno} strokeWidth="1.2" fontFamily="system-ui, sans-serif" fontWeight="900">
      <text x="185" y="42" fontSize="28">{texto}</text>
    </g>
  );
  switch (e) {
    case "coracao":
      return (
        <g className="cp-coracao-badge" transform="translate(193, 35)">
          <path d="M 0 11.5 C -13 3 -16 -8 -8 -12.5 C -3.8 -15 0 -12 0 -9.2 C 0 -12 3.8 -15 8 -12.5 C 16 -8 13 3 0 11.5 Z" fill={t.coracao} stroke={p.contorno} strokeWidth="2.1" strokeLinejoin="round" />
          <circle cx="-4.2" cy="-6.4" r="1.8" fill="#FFF" opacity="0.82" />
        </g>
      );
    case "pensando": case "ocupado":
      return <g fill={t.acento}><circle className="cp-ponto" cx="82" cy="52" r="3.4" /><circle className="cp-ponto" cx="69" cy="37" r="4.8" /><circle className="cp-ponto" cx="55" cy="21" r="6.2" /></g>;
    case "duvida": return simbolo("?", t.acento);
    case "surpreso": return simbolo("!", "#F59E0B");
    case "alerta":
      return (
        <g className="cp-simbolo">
          <path d="M 192 16 L 207 42 L 177 42 Z" fill="#FACC15" stroke={p.contorno} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M 192 24 V 33 M 192 37.5 V 38" stroke="#16224C" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );
    case "erro":
      return (
        <g className="cp-simbolo">
          <circle cx="192" cy="30" r="13" fill="#EF4444" stroke={p.contorno} strokeWidth="2.2" />
          <path d="M 187 25 L 197 35 M 197 25 L 187 35" stroke="#FFF" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );
    case "dormindo":
      return (
        <g fill={escuro ? "#93C5FD" : t.marca1} fontFamily="system-ui, sans-serif" fontWeight="900">
          <text className="cp-z" x="180" y="48" fontSize="18">z</text>
          <text className="cp-z cp-z2" x="194" y="30" fontSize="14">Z</text>
        </g>
      );
    case "feliz": case "ideia": case "piscando": case "animado":
      return (
        <g className="cp-brilho">
          <path d="M 192 22 L 195 32 L 205 35 L 195 38 L 192 48 L 189 38 L 179 35 L 189 32 Z" fill="#FACC15" stroke={p.contorno} strokeWidth="1.6" strokeLinejoin="round" />
        </g>
      );
    case "ouvindo":
      return (
        <g fill="none" stroke={t.acento} strokeWidth="3" strokeLinecap="round">
          <path className="cp-onda" d="M 90 64 Q 81 77 90 90" />
          <path className="cp-onda cp-onda2" d="M 80 57 Q 68 77 80 97" />
        </g>
      );
    default: return null;
  }
}

export function JorginhoAvatar({ expressao = "normal", className, titulo = "Jotinha", perfil, modo, parado }: {
  expressao?: Expressao; className?: string; titulo?: string;
  /** Fixa o perfil/modo (prévias); por padrão segue o tema do gabinete */
  perfil?: Perfil; modo?: Modo;
  /** Sem flutuar (para listas, como as mensagens da conversa) */
  parado?: boolean;
}) {
  const tema = useTema();
  const t = TEMAS[(perfil ?? tema.perfil) === "tech" ? "tech" : "brasil"];
  const escuro = (modo ?? tema.modo) === "escuro";
  const id = useId().replace(/:/g, "");
  const e: Expressao = expressao === "piscando" ? "ideia" : expressao;
  const p: Paleta = {
    contorno: escuro ? t.contornoEscuro : t.contornoClaro,
    tracoFacial: escuro ? t.tracoFacialEscuro : t.contornoClaro,
    bocaFundo: escuro ? t.bocaEscura : t.contornoClaro,
  };
  const fechadoE = e === "dormindo" || e === "feliz";
  const fechadoD = fechadoE || e === "ideia";
  const olhar = e === "pensando" || e === "duvida" ? { dx: 2.5, dy: -3.2 }
    : e === "ouvindo" ? { dx: -2.2, dy: 0.6 }
    : e === "coracao" ? { dx: 1.8, dy: -1.2 }
    : { dx: 1.4, dy: 1.2 };

  return (
    <svg viewBox="0 0 230 270" className={cn("jt-svg select-none overflow-visible", `exp-${e}`, parado && "jt-parado", className)} role="img" aria-label={titulo}>
      <defs>
        <linearGradient id={`metal-azul-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={t.metalA} /><stop offset="55%" stopColor={t.metalB} /><stop offset="100%" stopColor={t.metalC} />
        </linearGradient>
        <linearGradient id={`metal-prata-${id}`} x1="0%" y1="15%" x2="100%" y2="85%">
          <stop offset="0%" stopColor="#F8FAFC" /><stop offset="35%" stopColor="#CBD5E1" /><stop offset="65%" stopColor="#F1F5F9" /><stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
        <radialGradient id={`olho-grad-${id}`} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#FFFFFF" /><stop offset="72%" stopColor="#F1F5F9" /><stop offset="100%" stopColor="#CBD5E1" />
        </radialGradient>
      </defs>

      <ellipse className="cp-sombra" cx="114" cy="259" rx="46" ry="6.5" fill={escuro ? "#60A5FA" : t.contornoClaro} opacity="0.22" />

      <g className="cp-corpo">
        <Tubo d={PATH_DOBRA_BAIXA} t={t} p={p} escuro={escuro} id={id} />
        <Tubo d={PATH_J_PRINCIPAL} t={t} p={p} escuro={escuro} id={id} />
        <g fill="#FFF" opacity="0.9">
          <circle cx="122" cy="24" r="2.2" /><circle cx="171" cy="148" r="2.5" /><circle cx="96" cy="240" r="2" /><circle cx="52" cy="172" r="1.8" />
        </g>
        <Sobrancelhas e={e} p={p} />
        <Olho cx={118} cy={76} fechado={fechadoE} e={e} olhar={olhar} p={p} id={id} />
        <Olho cx={153} cy={77} fechado={fechadoD} e={e} olhar={olhar} p={p} id={id} />
        {(e === "coracao" || e === "pensando") && (
          <g fill="#FB7185" opacity={e === "coracao" ? 0.55 : 0.34}>
            <ellipse cx="105" cy="90" rx={e === "coracao" ? 5.2 : 4.2} ry={e === "coracao" ? 3.1 : 2.5} />
            <ellipse cx="164" cy="91" rx={e === "coracao" ? 5.2 : 4.2} ry={e === "coracao" ? 3.1 : 2.5} />
          </g>
        )}
        <Boca e={e} p={p} escuro={escuro} />
      </g>

      <Extras e={e} t={t} p={p} escuro={escuro} />
    </svg>
  );
}
