import { useState, useEffect, useRef, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2, UserPlus, X, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ─── Tipos ───────────────────────────────────────────────────

export interface MunicipeOption {
  id: string;
  nome: string;
  telefone?: string | null;
  bairro?: string | null;
}

interface MunicipeComboboxProps {
  value: string;
  onChange: (id: string) => void;
  onCreateNew?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Nome pré-resolvido para evitar fetch ao abrir (ex: demanda.municipes?.nome) */
  initialDisplayName?: string;
  className?: string;
}

// ─── Debounce hook ───────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Componente ──────────────────────────────────────────────

export function MunicipeCombobox({
  value,
  onChange,
  onCreateNew,
  placeholder = "Buscar munícipe...",
  disabled = false,
  initialDisplayName,
  className,
}: MunicipeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<MunicipeOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState<MunicipeOption | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const resolvedIdRef = useRef<string | null>(null);

  // ──────────────────────────────────────────────
  // 1) Resolver o display do munícipe selecionado
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!value) {
      setSelectedDisplay(null);
      resolvedIdRef.current = null;
      return;
    }

    // Se já resolveu este ID, não buscar de novo
    if (resolvedIdRef.current === value && selectedDisplay?.id === value) return;

    // Se temos nome passado como prop, usar direto
    if (initialDisplayName) {
      setSelectedDisplay({ id: value, nome: initialDisplayName });
      resolvedIdRef.current = value;
      return;
    }

    // Buscar no banco
    const resolve = async () => {
      const { data } = await supabase
        .from("municipes")
        .select("id, nome, telefone, bairro")
        .eq("id", value)
        .single();

      if (data) {
        setSelectedDisplay(data);
        resolvedIdRef.current = value;
      }
    };
    resolve();
  }, [value, initialDisplayName]);

  // ──────────────────────────────────────────────
  // 2) Busca server-side com debounce
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const fetchResults = async () => {
      setIsSearching(true);
      try {
        let query = supabase
          .from("municipes")
          .select("id, nome, telefone, bairro")
          .order("nome")
          .limit(30);

        if (debouncedSearch.trim().length > 0) {
          const term = `%${debouncedSearch.trim()}%`;
          query = query.or(`nome.ilike.${term},telefone.ilike.${term},bairro.ilike.${term}`);
        }

        const { data, error } = await query;
        if (!error && data) {
          setResults(data);
        }
      } catch (err) {
        console.error("Erro ao buscar munícipes:", err);
      } finally {
        setIsSearching(false);
      }
    };

    fetchResults();
  }, [debouncedSearch, open]);

  // ──────────────────────────────────────────────
  // 3) Handlers
  // ──────────────────────────────────────────────
  const handleSelect = useCallback(
    (municipe: MunicipeOption) => {
      onChange(municipe.id);
      setSelectedDisplay(municipe);
      resolvedIdRef.current = municipe.id;
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onChange("");
      setSelectedDisplay(null);
      resolvedIdRef.current = null;
      setSearch("");
    },
    [onChange]
  );

  // ──────────────────────────────────────────────
  // 4) Render
  // ──────────────────────────────────────────────
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          type="button"
          className={cn(
            "w-full justify-between font-normal h-auto min-h-10",
            !selectedDisplay && "text-muted-foreground",
            className
          )}
        >
          {selectedDisplay ? (
            <div className="flex items-center gap-2 flex-1 min-w-0 py-0.5">
              <User className="h-4 w-4 flex-shrink-0 text-primary" />
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="text-sm font-medium truncate w-full text-left text-foreground">
                  {selectedDisplay.nome}
                </span>
                {(selectedDisplay.telefone || selectedDisplay.bairro) && (
                  <span className="text-[11px] text-muted-foreground truncate w-full text-left">
                    {[selectedDisplay.telefone, selectedDisplay.bairro].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              <X
                className="h-4 w-4 flex-shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleClear}
              />
            </div>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
          {!selectedDisplay && (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite nome, telefone ou bairro..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isSearching ? (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">
                    {search.trim()
                      ? `Nenhum munícipe encontrado para "${search}"`
                      : "Digite para buscar"}
                  </p>
                </div>
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((municipe) => (
                  <CommandItem
                    key={municipe.id}
                    value={municipe.id}
                    onSelect={() => handleSelect(municipe)}
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        value === municipe.id ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">
                        {municipe.nome}
                      </span>
                      {(municipe.telefone || municipe.bairro) && (
                        <span className="text-[11px] text-muted-foreground truncate">
                          {[municipe.telefone, municipe.bairro]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}

                {results.length === 30 && (
                  <div className="px-3 py-2 text-[11px] text-center text-muted-foreground border-t">
                    Refine a busca para encontrar mais resultados
                  </div>
                )}
              </CommandGroup>
            )}

            {/* Botão "Cadastrar novo" */}
            {onCreateNew && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      onCreateNew();
                    }}
                    className="flex items-center gap-2 text-primary cursor-pointer py-2.5"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span className="font-medium">Cadastrar novo munícipe</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
