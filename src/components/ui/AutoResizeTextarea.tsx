import React, { useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface AutoResizeTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  width?: number;
  placeholder?: string;
  autoFocus?: boolean;
}

export function AutoResizeTextarea({ 
  value, 
  onChange, 
  onSave, 
  onCancel, 
  width = 200,
  placeholder,
  autoFocus = true 
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = Math.max(60, Math.min(200, textarea.scrollHeight));
      textarea.style.height = `${scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex gap-2 items-start w-full">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        style={{ 
          width: Math.max(width - 100, 200),
          minHeight: '60px',
          maxHeight: '200px',
          resize: 'none',
          overflow: 'hidden'
        }}
        placeholder={placeholder}
        className="transition-all duration-200"
      />
      <div className="flex flex-col gap-1 flex-shrink-0">
        <Button size="sm" onClick={onSave}>
          Salvar
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}