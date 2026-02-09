import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  showDot?: boolean;
}

export function StatusBadge({ status, size = "md", showDot = true }: StatusBadgeProps) {
  const { getStatusLabel, getStatusColor } = useDemandaStatus();
  
  const label = getStatusLabel(status);
  const cor = getStatusColor(status);
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1",
  };

  return (
    <Badge
      className={`${sizeClasses[size]} font-medium`}
      style={{
        backgroundColor: `${cor}20`,
        color: cor,
        borderColor: cor,
      }}
      variant="outline"
    >
      {showDot && (
        <span
          className="w-2 h-2 rounded-full mr-1.5 inline-block"
          style={{ backgroundColor: cor }}
        />
      )}
      {label}
    </Badge>
  );
}
