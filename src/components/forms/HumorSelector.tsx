import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";

export type HumorType = 'muito_insatisfeito' | 'insatisfeito' | 'neutro' | 'satisfeito' | 'muito_satisfeito' | null;

interface HumorSelectorProps {
  value: HumorType;
  onChange: (value: HumorType) => void;
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
}

const humorOptions: { value: HumorType; emoji: string; label: string; color: string }[] = [
  { value: 'muito_insatisfeito', emoji: '😠', label: 'Muito Insatisfeito', color: 'hover:bg-red-100 data-[selected=true]:bg-red-100 data-[selected=true]:ring-2 data-[selected=true]:ring-red-500' },
  { value: 'insatisfeito', emoji: '😟', label: 'Insatisfeito', color: 'hover:bg-orange-100 data-[selected=true]:bg-orange-100 data-[selected=true]:ring-2 data-[selected=true]:ring-orange-500' },
  { value: 'neutro', emoji: '😐', label: 'Neutro', color: 'hover:bg-yellow-100 data-[selected=true]:bg-yellow-100 data-[selected=true]:ring-2 data-[selected=true]:ring-yellow-500' },
  { value: 'satisfeito', emoji: '😊', label: 'Satisfeito', color: 'hover:bg-green-100 data-[selected=true]:bg-green-100 data-[selected=true]:ring-2 data-[selected=true]:ring-green-500' },
  { value: 'muito_satisfeito', emoji: '😄', label: 'Muito Satisfeito', color: 'hover:bg-emerald-100 data-[selected=true]:bg-emerald-100 data-[selected=true]:ring-2 data-[selected=true]:ring-emerald-500' },
];

const sizeClasses = {
  sm: 'text-lg p-1.5',
  md: 'text-2xl p-2',
  lg: 'text-3xl p-3',
};

export function HumorSelector({ 
  value, 
  onChange, 
  label = "Humor do Munícipe",
  showLabel = true,
  size = 'md',
  readonly = false
}: HumorSelectorProps) {
  return (
    <div className="space-y-2">
      {showLabel && (
        <Label className="text-sm font-medium">{label}</Label>
      )}
      <TooltipProvider>
        <div className="flex items-center gap-1">
          {humorOptions.map((option) => (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  data-selected={value === option.value}
                  disabled={readonly}
                  onClick={() => !readonly && onChange(value === option.value ? null : option.value)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    sizeClasses[size],
                    option.color,
                    readonly ? "cursor-default opacity-80" : "cursor-pointer",
                    value === option.value ? "scale-110 shadow-md" : "opacity-60 hover:opacity-100"
                  )}
                >
                  {option.emoji}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{option.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}

// Componente para exibição apenas (usado em cards e visualizações)
interface HumorBadgeProps {
  humor: HumorType;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function HumorBadge({ humor, showLabel = false, size = 'sm' }: HumorBadgeProps) {
  if (!humor) return null;
  
  const option = humorOptions.find(o => o.value === humor);
  if (!option) return null;

  const sizeClassesBadge = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("cursor-default", sizeClassesBadge[size])}>
            {option.emoji}
            {showLabel && <span className="ml-1 text-xs text-muted-foreground">{option.label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Humor: {option.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Função auxiliar para obter label do humor
export function getHumorLabel(humor: HumorType): string {
  const option = humorOptions.find(o => o.value === humor);
  return option?.label || 'Não informado';
}

// Função auxiliar para obter emoji do humor
export function getHumorEmoji(humor: HumorType): string {
  const option = humorOptions.find(o => o.value === humor);
  return option?.emoji || '';
}
