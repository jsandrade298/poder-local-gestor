import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StatusSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  includeAll?: boolean;
  allLabel?: string;
}

export function StatusSelect({
  value,
  onValueChange,
  placeholder = "Selecione um status",
  disabled = false,
  includeAll = false,
  allLabel = "Todos os status",
}: StatusSelectProps) {
  const { statusList, isLoading } = useDemandaStatus();

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Carregando..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && (
          <SelectItem value="todos">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: "#6b7280" }}
              />
              {allLabel}
            </div>
          </SelectItem>
        )}
        {statusList.map((status) => (
          <SelectItem key={status.slug} value={status.slug}>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: status.cor }}
              />
              {status.nome}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Versão para filtros com opção "Todos"
interface StatusFilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function StatusFilterSelect({ value, onValueChange }: StatusFilterSelectProps) {
  return (
    <StatusSelect
      value={value}
      onValueChange={onValueChange}
      includeAll
      allLabel="Todos os status"
      placeholder="Filtrar por status"
    />
  );
}
