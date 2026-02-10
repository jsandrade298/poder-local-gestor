import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  description?: string;
  variant?: "default" | "destructive" | "warning" | "caution";
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  variant = "default",
}: KPICardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "destructive":
        return {
          card: "border-destructive/30 bg-destructive/5",
          icon: "bg-destructive/10",
          iconColor: "text-destructive",
        };
      case "warning":
        return {
          card: "border-orange-500/30 bg-orange-500/5",
          icon: "bg-orange-500/10",
          iconColor: "text-orange-600",
        };
      case "caution":
        return {
          card: "border-yellow-500/30 bg-yellow-500/5",
          icon: "bg-yellow-500/10",
          iconColor: "text-yellow-600",
        };
      default:
        return {
          card: "border-border/50",
          icon: "bg-primary/10",
          iconColor: "text-primary",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Card className={cn("shadow-sm transition-shadow hover:shadow-md", styles.card)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        <div className={cn("p-1.5 rounded-md", styles.icon)}>
          <Icon className={cn("h-4 w-4", styles.iconColor)} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="text-2xl font-bold text-foreground tracking-tight">
          {value}
        </div>
        {trend && (
          <div className="flex items-center text-xs mt-1">
            <span
              className={`font-medium ${
                trend.isPositive ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {trend.value}
            </span>
            <span className="ml-1 text-muted-foreground">vs mês anterior</span>
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
