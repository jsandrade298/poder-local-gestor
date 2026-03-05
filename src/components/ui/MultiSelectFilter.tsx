import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Option {
  value: string;
  label: string;
  color?: string;
}

interface MultiSelectFilterProps {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxDisplayed?: number;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  placeholder = "Todos",
  searchPlaceholder = "Buscar…",
  emptyMessage = "Nenhuma opção encontrada",
  maxDisplayed = 2,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => onChange(options.map((o) => o.value));
  const clearAll = () => onChange([]);

  const displayLabel = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length <= maxDisplayed) {
      return selected
        .map((v) => options.find((o) => o.value === v)?.label || v)
        .join(", ");
    }
    return `${selected.length} selecionados`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10 px-3 text-sm"
        >
          <span className="truncate text-left flex-1">
            {selected.length > 0 ? (
              <span className="flex items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 text-[10px] rounded-sm font-semibold shrink-0"
                >
                  {selected.length}
                </Badge>
                <span className="truncate">{displayLabel()}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          {selected.length > 0 ? (
            <X
              className="h-3.5 w-3.5 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
            />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {/* Search */}
        {options.length > 6 && (
          <div className="flex items-center border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        )}

        {/* Quick actions */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b">
          <button
            onClick={selectAll}
            className="text-[11px] text-primary hover:underline"
          >
            Selecionar todos
          </button>
          {selected.length > 0 && (
            <button
              onClick={clearAll}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Options */}
        <div className="max-h-[240px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {emptyMessage}
            </p>
          ) : (
            filtered.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggle(option.value)}
                  className={`flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  {option.color && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
