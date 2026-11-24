import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** O que não carregou, ex.: "as demandas" */
  what?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/**
 * Estado de erro padrão para listas e telas: deixa claro que houve falha
 * (e não que "não há nada"), com um botão para tentar de novo.
 */
export function ErrorState({ what = "os dados", onRetry, retrying, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-10 text-center",
        className
      )}
    >
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">Não foi possível carregar {what}.</p>
        <p className="text-sm text-muted-foreground">
          Pode ser a conexão ou uma instabilidade momentânea. Nada foi perdido.
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} />
          Tentar de novo
        </Button>
      )}
    </div>
  );
}
