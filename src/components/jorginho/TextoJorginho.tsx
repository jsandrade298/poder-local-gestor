import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Mostra a resposta do Jotinha com um markdown simples e seguro:
 * **negrito**, *itálico*, `código`, listas e links. Links internos
 * ("/demandas?...") abrem no app; externos só se forem https.
 * Nada de HTML vindo da IA.
 */

function inline(texto: string, onLink?: () => void): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let ultimo = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1]) {
      const url = m[3];
      if (url.startsWith("/")) partes.push(<Link key={k++} to={url} onClick={onLink} className="font-medium text-primary underline-offset-2 hover:underline">{m[2]}</Link>);
      else if (/^https:\/\//.test(url)) partes.push(<a key={k++} href={url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{m[2]}</a>);
      else partes.push(m[2]);
    } else if (m[4]) partes.push(<strong key={k++}>{m[5]}</strong>);
    else if (m[6]) partes.push(<em key={k++}>{m[7]}</em>);
    else if (m[8]) partes.push(<code key={k++} className="rounded bg-muted px-1 text-[0.9em]">{m[9]}</code>);
    ultimo = re.lastIndex;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export function TextoJorginho({ texto, onLink }: { texto: string; onLink?: () => void }) {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const blocos: ReactNode[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;
  const fecharLista = () => {
    if (!lista) return;
    const Tag = lista.ordenada ? "ol" : "ul";
    blocos.push(<Tag key={blocos.length} className={lista.ordenada ? "list-decimal space-y-0.5 pl-5" : "list-disc space-y-0.5 pl-5"}>{lista.itens.map((i, n) => <li key={n}>{inline(i, onLink)}</li>)}</Tag>);
    lista = null;
  };
  linhas.forEach((l) => {
    const t = l.trim();
    const marcador = t.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (marcador) {
      const ordenada = /^\d/.test(marcador[1]);
      if (!lista || lista.ordenada !== ordenada) { fecharLista(); lista = { ordenada, itens: [] }; }
      lista.itens.push(marcador[2]);
      return;
    }
    fecharLista();
    if (!t) return;
    const titulo = t.match(/^#{1,4}\s+(.*)$/);
    blocos.push(titulo ? <p key={blocos.length} className="font-semibold">{inline(titulo[1], onLink)}</p> : <p key={blocos.length}>{inline(t, onLink)}</p>);
  });
  fecharLista();
  return <div className="space-y-1.5 [overflow-wrap:anywhere]">{blocos.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
