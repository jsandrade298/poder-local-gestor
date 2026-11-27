/**
 * Voz do Jotinha, só com o que o próprio navegador oferece (custo zero):
 *  - ouvir: reconhecimento de fala. No Chrome 139+ com o pacote de português
 *    instalado, a transcrição acontece NO PRÓPRIO COMPUTADOR (o áudio não sai
 *    dele). Sem isso, usa o reconhecimento normal do navegador (gratuito; no
 *    Chrome/Edge o áudio é transcrito pelo serviço do navegador).
 *  - falar: síntese de voz em pt-BR, preferindo as vozes instaladas no
 *    sistema (rodam no computador) às vozes "online".
 * Sem suporte (ex.: Firefox), o Jotinha segue por texto.
 */

const Reconhecimento = () => (typeof window === "undefined" ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);
export const podeOuvir = () => !!Reconhecimento();
export const podeFalar = () => typeof window !== "undefined" && "speechSynthesis" in window;

// ── Reconhecimento no próprio aparelho (quando o Chrome permite) ─────

export type OndeOuve = "aparelho" | "navegador";
let onde: OndeOuve = "navegador";
let preparando: Promise<OndeOuve> | null = null;
export const ondeOuve = () => onde;

/**
 * Confere se dá para transcrever no próprio computador e, se o pacote de
 * português puder ser baixado, pede para o Chrome instalar (uma vez, ~60 MB).
 * Chame no clique que começa a ligação.
 */
export function prepararReconhecimento(): Promise<OndeOuve> {
  if (preparando) return preparando;
  preparando = (async () => {
    const C = Reconhecimento();
    const opcoes = { langs: ["pt-BR"], processLocally: true };
    try {
      if (!C || typeof C.available !== "function") return (onde = "navegador");
      let s: string = await C.available(opcoes);
      if ((s === "downloadable" || s === "downloading") && typeof C.install === "function") {
        const ok = await C.install(opcoes).catch(() => false);
        s = ok ? "available" : await C.available(opcoes);
      }
      return (onde = s === "available" ? "aparelho" : "navegador");
    } catch {
      return (onde = "navegador");
    }
  })();
  // Se não deu agora (ex.: download em andamento), tenta de novo na próxima ligação
  preparando.then((r) => { if (r === "navegador") preparando = null; });
  return preparando;
}

// ── Falar ───────────────────────────────────────────────────────

let vozes: SpeechSynthesisVoice[] = [];
const carregarVozes = () => { try { vozes = window.speechSynthesis.getVoices(); } catch { vozes = []; } };
if (podeFalar()) { carregarVozes(); window.speechSynthesis.addEventListener?.("voiceschanged", carregarVozes); }

/** Prefere vozes do próprio sistema (sem internet) e masculinas em pt-BR (o Jotinha é "o" Jotinha). */
function escolherVoz() {
  if (!vozes.length) carregarVozes();
  const br = vozes.filter((v) => /^pt[-_]BR/i.test(v.lang));
  const pt = br.length ? br : vozes.filter((v) => /^pt/i.test(v.lang));
  const locais = pt.filter((v) => v.localService);
  const masculinas = /Daniel|Antonio|Thiago|Fabio|Donato|Humberto|Julio|Nicolau|Valerio/i;
  return locais.find((v) => masculinas.test(v.name)) || locais[0]
    || pt.find((v) => /Natural/i.test(v.name) && masculinas.test(v.name)) || pt.find((v) => /Google português do Brasil/i.test(v.name))
    || pt[0] || null;
}

/** Tira o que não se lê em voz alta: links, markdown, emojis. */
export function textoParaFala(t: string) {
  return String(t || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>]+/g, "")
    .replace(/#(?=\S)/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Fala e resolve quando termina (ou se o navegador travar, por tempo). */
export function falar(texto: string): Promise<void> {
  return new Promise((resolve) => {
    if (!podeFalar()) return resolve();
    const limpo = textoParaFala(texto);
    if (!limpo) return resolve();
    const s = window.speechSynthesis;
    try { s.cancel(); } catch { /* nada */ }
    const u = new SpeechSynthesisUtterance(limpo);
    u.lang = "pt-BR";
    const v = escolherVoz();
    if (v) u.voice = v;
    u.rate = 1.1;
    u.pitch = 1.12;
    let acabou = false;
    const fim = () => { if (acabou) return; acabou = true; window.clearTimeout(t); resolve(); };
    u.onend = fim;
    u.onerror = fim;
    const t = window.setTimeout(fim, 3000 + limpo.length * 90);
    s.speak(u);
  });
}

export function pararFala() { try { window.speechSynthesis?.cancel(); } catch { /* nada */ } }

// ── Ouvir ───────────────────────────────────────────────────────

export interface Escuta { resultado: Promise<string>; parar: () => void }

/**
 * Ouve uma resposta. Termina sozinho depois de ~1,4 s de silêncio após a
 * pessoa falar (ou 9 s sem ouvir nada). `aoParcial` recebe o texto ao vivo.
 * Erros: "sem_permissao", "sem_microfone", "rede", "sem_reconhecimento".
 */
export function ouvir(aoParcial?: (texto: string) => void): Escuta {
  const C = Reconhecimento();
  if (!C) return { resultado: Promise.reject(new Error("sem_reconhecimento")), parar: () => {} };
  let atual: any = null;
  let encerrado = false;
  let silencio: number | undefined, inicio: number | undefined;
  let final = "", parcial = "";
  const parar = () => { encerrado = true; window.clearTimeout(silencio); window.clearTimeout(inicio); try { atual?.stop(); } catch { /* já parou */ } };

  const resultado = new Promise<string>((resolve, reject) => {
    const comecar = (local: boolean) => {
      const r = new C();
      atual = r;
      r.lang = "pt-BR";
      r.interimResults = true;
      r.continuous = true;
      r.maxAlternatives = 1;
      if (local) { try { r.processLocally = true; } catch { /* navegador antigo */ } }
      let trocou = false;
      r.onresult = (e: any) => {
        let fin = "", tmp = "";
        for (let i = 0; i < e.results.length; i++) {
          const x = e.results[i];
          if (x.isFinal) fin += x[0].transcript; else tmp += x[0].transcript;
        }
        final = fin; parcial = tmp;
        aoParcial?.(`${fin} ${tmp}`.replace(/\s+/g, " ").trim());
        window.clearTimeout(inicio);
        window.clearTimeout(silencio);
        silencio = window.setTimeout(parar, 1400);
      };
      r.onerror = (e: any) => {
        // O pacote local sumiu/não serve: segue no reconhecimento normal, sem a pessoa perceber
        if (local && (e.error === "language-not-supported" || e.error === "service-not-allowed")) { trocou = true; onde = "navegador"; return; }
        if (e.error === "not-allowed" || e.error === "service-not-allowed") reject(new Error("sem_permissao"));
        else if (e.error === "audio-capture") reject(new Error("sem_microfone"));
        else if (e.error === "network") reject(new Error("rede"));
        // no-speech / aborted: termina no onend com o que tiver
      };
      r.onend = () => {
        if (trocou && !encerrado) { comecar(false); return; }
        window.clearTimeout(silencio); window.clearTimeout(inicio);
        resolve(`${final} ${parcial}`.replace(/\s+/g, " ").trim());
      };
      try { r.start(); } catch (e) { if (local) comecar(false); else reject(e); }
    };
    comecar(onde === "aparelho");
  });
  inicio = window.setTimeout(parar, 9000);
  return { resultado, parar };
}

export function mensagemErroVoz(codigo: string) {
  switch (codigo) {
    case "sem_permissao": return "O navegador não liberou o microfone. Clique no cadeado da barra de endereço, permita o microfone e tente de novo — ou siga digitando.";
    case "sem_microfone": return "Não encontrei um microfone neste aparelho. Pode seguir digitando.";
    case "rede": return "O reconhecimento de voz precisa de internet neste navegador. Pode seguir digitando.";
    case "sem_reconhecimento": return "Este navegador não reconhece voz (use Chrome, Edge ou Safari). Pode seguir digitando.";
    default: return "A voz falhou por aqui. Pode seguir digitando.";
  }
}
