import { ChevronDown, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CampoBusca, TODOS_OS_CAMPOS } from "@/lib/busca";

interface CamposBuscaSelectProps {
  opcoes: CampoBusca[];
  value: string[];
  onChange: (campos: string[]) => void;
  /** Campos restaurados pelo botão "Padrão". */
  padrao: string[];
  /** Texto de ajuda no rodapé (ex.: sobre telefone). */
  dica?: string;
  className?: string;
}

/**
 * Escolha de onde a busca procura o texto digitado.
 * "Todos os campos" é exclusivo; desmarcar tudo volta ao padrão.
 */
export function CamposBuscaSelect({ opcoes, value, onChange, padrao, dica, className }: CamposBuscaSelectProps) {
  const todos = value.includes(TODOS_OS_CAMPOS);

  const rotulo = todos
    ? "Todos os campos"
    : (() => {
        const nomes = opcoes.filter((o) => value.includes(o.value)).map((o) => o.label);
        if (nomes.length === 0) return "Escolher campos";
        if (nomes.length <= 2) return nomes.join(", ");
        return `${nomes[0]} +${nomes.length - 1}`;
      })();

  const alternar = (campo: string, marcado: boolean) => {
    const base = value.filter((v) => v !== TODOS_OS_CAMPOS);
    const novo = marcado ? [...base, campo] : base.filter((v) => v !== campo);
    onChange(novo.length > 0 ? novo : padrao);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-10 w-10 sm:w-auto shrink-0 gap-1.5 px-0 sm:px-3 font-normal", className)}
          aria-label={`Buscar em: ${rotulo}`}
        >
          {/* Celular: só o ícone, para não espremer o campo de busca */}
          <ListChecks className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline text-muted-foreground">Em:</span>
          <span className="hidden sm:inline max-w-[150px] truncate">{rotulo}</span>
          <ChevronDown className="hidden sm:inline h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-3">
        <p className="text-sm font-medium mb-2">Buscar o texto em</p>

        <div className="flex items-center gap-2 py-1">
          <Checkbox
            id="campo-busca-todos"
            checked={todos}
            onCheckedChange={(c) => onChange(c === true ? [TODOS_OS_CAMPOS] : padrao)}
          />
          <Label htmlFor="campo-busca-todos" className="text-sm cursor-pointer">Todos os campos</Label>
        </div>

        <Separator className="my-2" />

        <div className="space-y-1">
          {opcoes.map((o) => (
            <div key={o.value} className="flex items-center gap-2 py-1">
              <Checkbox
                id={`campo-busca-${o.value}`}
                checked={!todos && value.includes(o.value)}
                onCheckedChange={(c) => alternar(o.value, c === true)}
              />
              <Label htmlFor={`campo-busca-${o.value}`} className="text-sm cursor-pointer">{o.label}</Label>
            </div>
          ))}
        </div>

        <Separator className="my-2" />

        <div className="flex items-start justify-between gap-2">
          {dica && <p className="text-xs text-muted-foreground leading-snug">{dica}</p>}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => onChange(padrao)}>
            Padrão
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
