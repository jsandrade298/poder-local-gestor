import React from 'react';

interface MarkdownTextProps {
  children: string;
  className?: string;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ children, className = "" }) => {
  const formatText = (text: string): React.ReactNode[] => {
    // Split by various markdown patterns while preserving the delimiters
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|~~.*?~~|\n)/g);
    
    return parts.map((part, index) => {
      // Bold text **text**
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={index} className="font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      
      // Italic text *text* (but not if it's part of **text**)
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
        return (
          <em key={index} className="italic">
            {part.slice(1, -1)}
          </em>
        );
      }
      
      // Inline code `text`
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code key={index} className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      
      // Strikethrough ~~text~~
      if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
        return (
          <del key={index} className="line-through">
            {part.slice(2, -2)}
          </del>
        );
      }
      
      // Line breaks
      if (part === '\n') {
        return <br key={index} />;
      }
      
      // Regular text
      return part;
    });
  };

  return (
    <span className={`whitespace-pre-wrap ${className}`}>
      {formatText(children)}
    </span>
  );
};