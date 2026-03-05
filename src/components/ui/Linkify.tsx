import React from "react";

/**
 * Regex para detectar URLs em texto.
 * Captura: http(s)://..., www.… e domínios com extensão conhecida.
 */
const URL_REGEX =
  /(https?:\/\/[^\s<>)}\]]+|www\.[^\s<>)}\]]+\.[^\s<>)}\]]+)/gi;

interface LinkifyProps {
  children: string;
  className?: string;
}

/**
 * Renderiza texto com URLs automaticamente convertidas em links clicáveis.
 * Uso: <Linkify className="text-sm">{texto}</Linkify>
 */
export function Linkify({ children, className = "" }: LinkifyProps) {
  if (!children) return null;

  const parts = children.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          // Reset lastIndex por causa do flag 'g'
          URL_REGEX.lastIndex = 0;
          const href = part.startsWith("http") ? part : `https://${part}`;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
            >
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}
