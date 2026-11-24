import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Bold, Italic, Underline, List, ListOrdered, Link2, AtSign, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizarBusca } from "@/lib/busca";
import type { Pessoa } from "@/hooks/useQuadros";

/**
 * Editor de texto do app: negrito, itálico, sublinhado, tamanho, listas,
 * links e menção com @ (avisa a pessoa mencionada).
 * Usado em: comentários dos cartões (Quadros), atividades das demandas e
 * prontuário dos munícipes.
 *
 * O conteúdo é guardado como HTML e SEMPRE passa pelo DOMPurify, ao salvar
 * e ao exibir, com uma lista curta de tags e atributos permitidos.
 * Textos antigos (texto puro, com menções "@[Nome](id)" e links soltos)
 * continuam sendo exibidos e editados normalmente.
 *
 * O DOMPurify é dependência direta (package.json), na mesma versão usada
 * pelo jspdf, para não haver duas cópias.
 */

const PERMITIDO = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "a", "br", "p", "div", "span", "ul", "ol", "li", "font"],
  ALLOWED_ATTR: ["href", "target", "rel", "size", "data-mencao", "class"],
  ALLOWED_URI_REGEXP: /^(https?:|mailto:)/i,
};

export function limparHtml(html: string): string {
  return DOMPurify.sanitize(html, PERMITIDO) as unknown as string;
}

const ehHtml = (t: string) => /<[a-z][\s\S]*>/i.test(t);
const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/**
 * Texto antigo (puro) → HTML: escapa, mantém quebras de linha, transforma
 * menções "@[Nome](id)" em menções do editor e endereços em links.
 */
function textoParaHtml(texto: string) {
  const partes: string[] = [];
  const re = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  // Links soltos mostram só o domínio, como antes ("youtube.com")
  const dominio = (u: string) => { try { return new URL(u.replace(/&amp;/g, "&")).hostname.replace(/^www\./, ""); } catch { return u; } };
  const comLinks = (t: string) =>
    escapar(t).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}">${dominio(u)}</a>`);
  while ((m = re.exec(texto)) !== null) {
    partes.push(comLinks(texto.slice(ultimo, m.index)));
    partes.push(`<span class="mencao" data-mencao="${escapar(m[2])}">@${escapar(m[1])}</span>`);
    ultimo = m.index + m[0].length;
  }
  partes.push(comLinks(texto.slice(ultimo)));
  return partes.join("").replace(/\n/g, "<br>");
}

/** Qualquer conteúdo (HTML novo ou texto antigo) → HTML limpo. */
export function paraHtml(conteudo: string | null | undefined): string {
  if (!conteudo) return "";
  return limparHtml(ehHtml(conteudo) ? conteudo : textoParaHtml(conteudo));
}

/** Conteúdo → texto puro (para PDF, IA, WhatsApp, exportações). */
export function paraTexto(conteudo: string | null | undefined): string {
  if (!conteudo) return "";
  if (!ehHtml(conteudo)) return conteudo.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
  const div = document.createElement("div");
  div.innerHTML = limparHtml(conteudo.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "$&\n"));
  return (div.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Ids das pessoas mencionadas (HTML novo ou texto antigo). */
export function mencoesDe(conteudo: string | null | undefined): string[] {
  if (!conteudo) return [];
  const ids = ehHtml(conteudo)
    ? [...conteudo.matchAll(/data-mencao="([^"]+)"/g)].map((m) => m[1])
    : [...conteudo.matchAll(/@\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
  return [...new Set(ids)];
}

export function ConteudoRico({ html, className }: { html: string; className?: string }) {
  const seguro = paraHtml(html)
    // links sempre abrem fora e sem acesso à página de origem
    .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer nofollow" ');
  return (
    <div
      className={cn("conteudo-rico text-sm leading-relaxed break-words [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_.mencao]:text-primary [&_.mencao]:font-medium [&_.mencao]:bg-primary/10 [&_.mencao]:rounded [&_.mencao]:px-1", className)}
      dangerouslySetInnerHTML={{ __html: seguro }}
    />
  );
}

export interface EditorRicoRef {
  /** HTML limpo e ids das pessoas mencionadas. */
  conteudo: () => { html: string; mencoes: string[]; vazio: boolean };
  limpar: () => void;
  focar: () => void;
}

interface Props {
  pessoas: Pessoa[];
  placeholder?: string;
  onEnviar?: () => void;
  disabled?: boolean;
  /** Conteúdo ao abrir (HTML ou texto antigo). Lido na montagem; para trocar, mude a `key`. */
  valorInicial?: string | null;
  /** Avisado a cada mudança, com o HTML limpo ("" quando vazio) — para formulários. */
  onChange?: (html: string) => void;
  /** Nome acessível da área de texto */
  rotulo?: string;
}

const TAMANHOS = [
  { v: "2", r: "Pequeno" },
  { v: "3", r: "Normal" },
  { v: "5", r: "Grande" },
];

export const EditorRico = forwardRef<EditorRicoRef, Props>(function EditorRico(
  { pessoas, placeholder = "Escrever um comentário…", onEnviar, disabled, valorInicial, onChange, rotulo = "Comentário" },
  ref
) {
  const area = useRef<HTMLDivElement>(null);
  const [vazio, setVazio] = useState(!valorInicial);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Valor inicial (edição): converte texto antigo e menções para o editor
  useEffect(() => {
    if (area.current && valorInicial) {
      area.current.innerHTML = paraHtml(valorInicial);
      setVazio(!area.current.textContent?.trim());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const emitir = useCallback(() => {
    const el = area.current;
    if (!el || !onChangeRef.current) return;
    const temAlgo = !!el.textContent?.trim() || !!el.querySelector("[data-mencao]");
    onChangeRef.current(temAlgo ? limparHtml(el.innerHTML) : "");
  }, []);
  const [menuTamanho, setMenuTamanho] = useState(false);
  const [link, setLink] = useState<{ aberto: boolean; url: string }>({ aberto: false, url: "" });
  const selecaoSalva = useRef<Range | null>(null);
  // menção: termo digitado depois do @ e posição do @
  const [mencao, setMencao] = useState<{ termo: string; ativo: number } | null>(null);
  const [ativos, setAtivos] = useState({ b: false, i: false, u: false });

  const atualizarEstado = useCallback(() => {
    const el = area.current;
    if (!el) return;
    setVazio(!el.textContent?.trim() && !el.querySelector("[data-mencao]"));
    emitir();
    try {
      setAtivos({
        b: document.queryCommandState("bold"),
        i: document.queryCommandState("italic"),
        u: document.queryCommandState("underline"),
      });
    } catch { /* navegador sem queryCommandState */ }
  }, [emitir]);

  const salvarSelecao = () => {
    const s = window.getSelection();
    if (s && s.rangeCount && area.current?.contains(s.anchorNode)) selecaoSalva.current = s.getRangeAt(0).cloneRange();
  };
  const restaurarSelecao = () => {
    const r = selecaoSalva.current;
    if (!r) return;
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };

  const comando = (cmd: string, valor?: string) => {
    area.current?.focus();
    restaurarSelecao();
    document.execCommand(cmd, false, valor);
    salvarSelecao();
    atualizarEstado();
  };

  // ── Menção com @ ──
  const detectarMencao = () => {
    const s = window.getSelection();
    if (!s || !s.rangeCount || !s.isCollapsed) { setMencao(null); return; }
    const no = s.anchorNode;
    if (!no || no.nodeType !== Node.TEXT_NODE || !area.current?.contains(no)) { setMencao(null); return; }
    const antes = (no.textContent || "").slice(0, s.anchorOffset);
    const m = antes.match(/(^|\s)@([\p{L}\p{N}]{0,30})$/u);
    if (!m) { setMencao(null); return; }
    setMencao((atual) => ({ termo: m[2], ativo: atual?.termo === m[2] ? atual.ativo : 0 }));
  };

  const candidatos = mencao
    ? pessoas.filter((p) => normalizarBusca(p.nome).includes(normalizarBusca(mencao.termo))).slice(0, 6)
    : [];

  const inserirMencao = (p: Pessoa) => {
    const s = window.getSelection();
    if (!s || !s.rangeCount) return;
    const no = s.anchorNode as Text;
    const fim = s.anchorOffset;
    const texto = no.textContent || "";
    const inicio = texto.slice(0, fim).lastIndexOf("@");
    if (inicio < 0) return;
    const range = document.createRange();
    range.setStart(no, inicio);
    range.setEnd(no, fim);
    range.deleteContents();
    const chip = document.createElement("span");
    chip.className = "mencao";
    chip.setAttribute("data-mencao", p.id);
    chip.contentEditable = "false";
    chip.textContent = "@" + p.nome;
    const espaco = document.createTextNode(" ");
    range.insertNode(espaco);
    range.insertNode(chip);
    const depois = document.createRange();
    depois.setStartAfter(espaco);
    depois.collapse(true);
    s.removeAllRanges();
    s.addRange(depois);
    setMencao(null);
    atualizarEstado();
  };

  // ── Link ──
  const abrirLink = () => { salvarSelecao(); setLink({ aberto: true, url: "https://" }); };
  const aplicarLink = () => {
    let url = link.url.trim();
    if (!url || url === "https://") { setLink({ aberto: false, url: "" }); return; }
    if (!/^(https?:|mailto:)/i.test(url)) url = "https://" + url;
    area.current?.focus();
    restaurarSelecao();
    const s = window.getSelection();
    if (s && s.isCollapsed) {
      // sem texto selecionado: insere o próprio endereço como link
      document.execCommand("insertHTML", false, `<a href="${url.replace(/"/g, "&quot;")}">${url.replace(/</g, "&lt;")}</a>&nbsp;`);
    } else {
      document.execCommand("createLink", false, url);
    }
    setLink({ aberto: false, url: "" });
    atualizarEstado();
  };

  useImperativeHandle(ref, () => ({
    conteudo: () => {
      const el = area.current;
      const html = limparHtml(el?.innerHTML || "");
      const mencoes = Array.from(el?.querySelectorAll("[data-mencao]") || []).map((n) => n.getAttribute("data-mencao")!).filter(Boolean);
      return { html, mencoes: [...new Set(mencoes)], vazio: !el?.textContent?.trim() };
    },
    limpar: () => { if (area.current) area.current.innerHTML = ""; setVazio(true); setMencao(null); emitir(); },
    focar: () => area.current?.focus(),
  }));

  useEffect(() => {
    const onSel = () => { if (area.current?.contains(document.getSelection()?.anchorNode || null)) { salvarSelecao(); atualizarEstado(); } };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [atualizarEstado]);

  const BotaoFormato = ({ ativo, onClick, rotulo, children }: { ativo?: boolean; onClick: () => void; rotulo: string; children: React.ReactNode }) => (
    <Button
      type="button" variant="ghost" size="sm" disabled={disabled}
      className={cn("h-8 w-8 p-0", ativo && "bg-muted text-foreground")}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      aria-label={rotulo} title={rotulo} aria-pressed={ativo}
    >
      {children}
    </Button>
  );

  return (
    <div className={cn("rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring", disabled && "opacity-60")}>
      {/* Barra de formatação */}
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1 relative">
        <BotaoFormato ativo={ativos.b} onClick={() => comando("bold")} rotulo="Negrito (Ctrl+B)"><Bold className="h-4 w-4" /></BotaoFormato>
        <BotaoFormato ativo={ativos.i} onClick={() => comando("italic")} rotulo="Itálico (Ctrl+I)"><Italic className="h-4 w-4" /></BotaoFormato>
        <BotaoFormato ativo={ativos.u} onClick={() => comando("underline")} rotulo="Sublinhado (Ctrl+U)"><Underline className="h-4 w-4" /></BotaoFormato>
        <div className="relative">
          <BotaoFormato onClick={() => { salvarSelecao(); setMenuTamanho(!menuTamanho); }} rotulo="Tamanho do texto"><Type className="h-4 w-4" /></BotaoFormato>
          {menuTamanho && (
            <div className="absolute z-20 top-9 left-0 w-32 rounded-md border bg-popover shadow-md py-1" role="menu">
              {TAMANHOS.map((t) => (
                <button
                  key={t.v} type="button" role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { comando("fontSize", t.v); setMenuTamanho(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-muted"
                  style={{ fontSize: t.v === "2" ? 12 : t.v === "5" ? 17 : 14 }}
                >{t.r}</button>
              ))}
            </div>
          )}
        </div>
        <span className="w-px h-5 bg-border mx-1" aria-hidden />
        <BotaoFormato onClick={() => comando("insertUnorderedList")} rotulo="Lista com marcadores"><List className="h-4 w-4" /></BotaoFormato>
        <BotaoFormato onClick={() => comando("insertOrderedList")} rotulo="Lista numerada"><ListOrdered className="h-4 w-4" /></BotaoFormato>
        <BotaoFormato onClick={abrirLink} rotulo="Inserir link"><Link2 className="h-4 w-4" /></BotaoFormato>
        <BotaoFormato onClick={() => { comando("insertText", "@"); detectarMencao(); }} rotulo="Mencionar alguém (@)"><AtSign className="h-4 w-4" /></BotaoFormato>
      </div>

      {link.aberto && (
        <div className="flex items-center gap-2 border-b px-2 py-1.5">
          <input
            autoFocus value={link.url} onChange={(e) => setLink({ aberto: true, url: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicarLink(); } if (e.key === "Escape") setLink({ aberto: false, url: "" }); }}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none" placeholder="https://…" aria-label="Endereço do link"
          />
          <Button type="button" size="sm" className="h-7" onClick={aplicarLink}>Inserir</Button>
          <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setLink({ aberto: false, url: "" })}>Cancelar</Button>
        </div>
      )}

      {/* Área de texto */}
      <div className="relative">
        {vazio && <div className="absolute left-3 top-2 text-sm text-muted-foreground pointer-events-none">{placeholder}</div>}
        <div
          ref={area}
          role="textbox" aria-multiline="true" aria-label={rotulo}
          contentEditable={!disabled}
          suppressContentEditableWarning
          className="min-h-[84px] max-h-[260px] overflow-y-auto px-3 py-2 text-sm outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_.mencao]:text-primary [&_.mencao]:font-medium [&_.mencao]:bg-primary/10 [&_.mencao]:rounded [&_.mencao]:px-1"
          onInput={() => { atualizarEstado(); detectarMencao(); }}
          onKeyUp={(e) => { if (!["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].includes(e.key)) detectarMencao(); }}
          onKeyDown={(e) => {
            if (mencao && candidatos.length) {
              if (e.key === "ArrowDown") { e.preventDefault(); setMencao({ ...mencao, ativo: (mencao.ativo + 1) % candidatos.length }); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setMencao({ ...mencao, ativo: (mencao.ativo - 1 + candidatos.length) % candidatos.length }); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); inserirMencao(candidatos[mencao.ativo]); return; }
              if (e.key === "Escape") { e.preventDefault(); setMencao(null); return; }
            }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onEnviar?.(); }
          }}
          onPaste={(e) => {
            // colar sempre como texto simples (evita estilos e scripts de outras páginas)
            e.preventDefault();
            document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
          }}
          onBlur={() => setTimeout(() => setMencao(null), 150)}
        />

        {mencao && candidatos.length > 0 && (
          <div className="absolute z-30 left-3 bottom-full mb-1 w-64 rounded-md border bg-popover shadow-lg py-1" role="listbox" aria-label="Mencionar">
            <div className="px-3 py-1 text-[11px] text-muted-foreground">Mencionar (avisa a pessoa)</div>
            {candidatos.map((p, i) => (
              <button
                key={p.id} type="button" role="option" aria-selected={i === mencao.ativo}
                onMouseDown={(e) => { e.preventDefault(); inserirMencao(p); }}
                className={cn("w-full text-left px-3 py-1.5 text-sm flex items-center gap-2", i === mencao.ativo ? "bg-muted" : "hover:bg-muted/60")}
              >
                <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-semibold grid place-items-center">
                  {p.nome.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                {p.nome}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
