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
  variant?: "default" | "destructive" | "warning";
}

export function KPICard({ title, value, icon: Icon, trend, description, variant = "default" }: KPICardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "destructive":
        return {
          card: "border-destructive/20 bg-destructive/5",
          icon: "bg-destructive/10 group-hover:bg-destructive/20",
          iconColor: "text-destructive"
        };
      case "warning":
        return {
          card: "border-yellow-500/20 bg-yellow-500/5",
          icon: "bg-yellow-500/10 group-hover:bg-yellow-500/20",
          iconColor: "text-yellow-600"
        };
      default:
        return {
          card: "border-border/50 bg-card/95",
          icon: "bg-primary/10 group-hover:bg-primary/20",
          iconColor: "text-primary"
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Card className={cn("group backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]", styles.card)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          {title}
        </CardTitle>
        <div className={cn("p-2 rounded-lg transition-colors", styles.icon)}>
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-bold text-foreground tracking-tight">{value}</div>
        {trend && (
          <div className="flex items-center text-sm">
            <span className={`font-medium ${trend.isPositive ? "text-success" : "text-destructive"}`}>
              {trend.value}
            </span>
            <span className="ml-2 text-muted-foreground">em relação ao mês anterior</span>
          </div>
        )}
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}