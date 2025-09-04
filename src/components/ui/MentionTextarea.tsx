import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MentionsInput, Mention } from "react-mentions";
import "./MentionTextarea.css";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MentionTextarea({ 
  value, 
  onChange, 
  placeholder = "Digite sua mensagem...", 
  className = "",
  disabled = false 
}: MentionTextareaProps) {
  // Buscar usuários para menções
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-mentions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .order('nome');
      
      if (error) throw error;
      return data.map(user => ({
        id: user.id,
        display: user.nome,
        email: user.email
      }));
    },
  });

  const handleChange = (event: any, newValue: string) => {
    onChange(newValue);
  };

  // Extrair menções do texto
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[2]); // ID do usuário
    }
    
    return mentions;
  };

  // Expor função para obter menções
  const getMentions = () => extractMentions(value);

  return (
    <div className={`mention-container ${className}`}>
      <MentionsInput
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="mention-input"
        style={{
          '&multiLine': {
            control: {
              fontFamily: 'inherit',
              minHeight: 100,
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              padding: '8px',
              fontSize: '14px',
              backgroundColor: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
            },
            highlighter: {
              padding: '8px',
              border: '1px solid transparent',
              minHeight: 100,
            },
            input: {
              padding: '8px',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              fontFamily: 'inherit',
              minHeight: 84,
              resize: 'vertical',
            },
          },
          suggestions: {
            list: {
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              fontSize: '14px',
              maxHeight: '200px',
              overflow: 'auto',
            },
            item: {
              padding: '8px 12px',
              borderBottom: '1px solid hsl(var(--border))',
              cursor: 'pointer',
              '&focused': {
                backgroundColor: 'hsl(var(--accent))',
              },
            },
          },
        }}
      >
        <Mention
          trigger="@"
          data={usuarios}
          markup="@[__display__](__id__)"
          displayTransform={(id, display) => `@${display}`}
          renderSuggestion={(suggestion, search, highlightedDisplay, index, focused) => (
            <div className={`flex items-center gap-2 ${focused ? 'bg-accent' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                {suggestion.display.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-sm">{suggestion.display}</div>
                <div className="text-xs text-muted-foreground">{suggestion.email}</div>
              </div>
            </div>
          )}
          style={{
            backgroundColor: 'transparent',
            color: 'transparent',
            fontWeight: 'normal',
            borderRadius: '0',
            padding: '0',
          }}
        />
      </MentionsInput>
    </div>
  );
}

// Utility function para extrair menções de um texto
export const extractMentionsFromText = (text: string): string[] => {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[2]); // ID do usuário
  }
  
  return mentions;
};

// Utility function para converter texto com menções para display
export const renderMentionText = (text: string): JSX.Element => {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Adicionar texto antes da menção
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // Adicionar a menção estilizada
    parts.push(
      <span 
        key={match.index}
        className="bg-primary text-primary-foreground px-1 rounded font-medium"
      >
        @{match[1]}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Adicionar texto restante
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return <>{parts}</>;
};