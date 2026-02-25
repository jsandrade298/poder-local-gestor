import React from 'react';

interface MarkdownTextProps {
  children: string;
  className?: string;
}

// ─── Inline formatting ────────────────────────────────────────────────────────

function renderInline(text: string, baseKey: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[\s\S]*?\*\*|\*[\s\S]*?\*|`[\s\S]*?`|~~[\s\S]*?~~)/g);
  return parts.map((part, i) => {
    const k = `${baseKey}-i${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={k} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**'))
      return <em key={k} className="italic">{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={k} className="bg-muted px-1 py-0.5 rounded text-[0.82em] font-mono">{part.slice(1, -1)}</code>;
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4)
      return <del key={k} className="line-through opacity-70">{part.slice(2, -2)}</del>;
    return part || null;
  }).filter(Boolean) as React.ReactNode[];
}

// ─── Block types ──────────────────────────────────────────────────────────────

type Block =
  | { t: 'h1' | 'h2' | 'h3'; text: string }
  | { t: 'hr' }
  | { t: 'quote'; text: string }
  | { t: 'table'; headers: string[]; rows: string[][] }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'blank' }
  | { t: 'p'; text: string };

// ─── Parser ───────────────────────────────────────────────────────────────────

function parse(raw: string): Block[] {
  const lines = raw.split('\n');
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trim = line.trim();

    // blank
    if (!trim) { out.push({ t: 'blank' }); i++; continue; }

    // headings
    if (line.startsWith('#### ')) { out.push({ t: 'h3', text: line.slice(5) }); i++; continue; }
    if (line.startsWith('### '))  { out.push({ t: 'h3', text: line.slice(4) }); i++; continue; }
    if (line.startsWith('## '))   { out.push({ t: 'h2', text: line.slice(3) }); i++; continue; }
    if (line.startsWith('# '))    { out.push({ t: 'h1', text: line.slice(2) }); i++; continue; }

    // hr
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trim)) { out.push({ t: 'hr' }); i++; continue; }

    // blockquote
    if (line.startsWith('> ')) { out.push({ t: 'quote', text: line.slice(2) }); i++; continue; }
    if (line === '>') { out.push({ t: 'quote', text: '' }); i++; continue; }

    // table — collect all pipe lines
    if (trim.startsWith('|') && trim.endsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i]); i++; }
      const parseRow = (r: string) =>
        r.split('|').slice(1, -1).map(c => c.trim());
      const isSep = (r: string) => /^[\s|:\-]+$/.test(r);
      const dataRows = rows.filter((r, ri) => ri !== 0 && !isSep(r));
      out.push({ t: 'table', headers: parseRow(rows[0]), rows: dataRows.map(parseRow) });
      continue;
    }

    // unordered list — collect contiguous items
    if (/^[-*+] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+] /, '')); i++;
      }
      out.push({ t: 'ul', items }); continue;
    }

    // ordered list
    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s/, '')); i++;
      }
      out.push({ t: 'ol', items }); continue;
    }

    // paragraph
    out.push({ t: 'p', text: line }); i++;
  }
  return out;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderBlock(block: Block, idx: number): React.ReactNode {
  const k = idx;
  switch (block.t) {

    case 'h1':
      return (
        <h2 key={k} className="text-[16px] font-bold mt-5 mb-2 text-foreground leading-snug">
          {renderInline(block.text, `h1-${k}`)}
        </h2>
      );
    case 'h2':
      return (
        <h3 key={k} className="text-[14.5px] font-semibold mt-4 mb-1.5 text-foreground leading-snug">
          {renderInline(block.text, `h2-${k}`)}
        </h3>
      );
    case 'h3':
      return (
        <h4 key={k} className="text-[13.5px] font-semibold mt-3 mb-1 text-foreground leading-snug">
          {renderInline(block.text, `h3-${k}`)}
        </h4>
      );

    case 'hr':
      return <hr key={k} className="my-3 border-border/60" />;

    case 'quote':
      return (
        <blockquote key={k} className="my-2 pl-3 border-l-[3px] border-primary/30 text-[13px] text-muted-foreground italic leading-relaxed">
          {block.text ? renderInline(block.text, `q-${k}`) : <br />}
        </blockquote>
      );

    case 'table':
      return (
        <div key={k} className="my-3 overflow-x-auto rounded-lg border border-border text-[12.5px]">
          <table className="w-full border-collapse">
            {block.headers.length > 0 && (
              <thead>
                <tr className="bg-muted/80">
                  {block.headers.map((h, hi) => (
                    <th key={hi} className="px-3 py-2 text-left font-semibold text-foreground border-b border-border whitespace-nowrap">
                      {renderInline(h, `th-${k}-${hi}`)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-muted/30'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 border-b border-border/40 text-foreground align-top">
                      {renderInline(cell, `td-${k}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'ul':
      return (
        <ul key={k} className="my-1.5 space-y-0.5">
          {block.items.map((item, ii) => (
            <li key={ii} className="flex gap-2 text-[13px] leading-relaxed">
              <span className="mt-[7px] w-[5px] h-[5px] rounded-full bg-muted-foreground/50 flex-shrink-0" />
              <span>{renderInline(item, `ul-${k}-${ii}`)}</span>
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol key={k} className="my-1.5 space-y-0.5">
          {block.items.map((item, ii) => (
            <li key={ii} className="flex gap-2 text-[13px] leading-relaxed">
              <span className="flex-shrink-0 font-mono text-[11px] text-muted-foreground mt-[2px] min-w-[18px] text-right">
                {ii + 1}.
              </span>
              <span>{renderInline(item, `ol-${k}-${ii}`)}</span>
            </li>
          ))}
        </ol>
      );

    case 'blank':
      return <div key={k} className="h-[6px]" />;

    case 'p':
      if (!block.text.trim()) return null;
      return (
        <p key={k} className="text-[13.5px] leading-[1.7]">
          {renderInline(block.text, `p-${k}`)}
        </p>
      );
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const MarkdownText: React.FC<MarkdownTextProps> = ({ children, className = '' }) => {
  const blocks = parse(children ?? '');
  return (
    <div className={`space-y-0.5 ${className}`}>
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
};
