import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";

interface FunilItem {
  name: string;
  slug: string;
  value: number;
  color: string;
  is_final: boolean;
}

interface FunilStatusChartProps {
  data: FunilItem[];
  total: number;
}

export function FunilStatusChart({ data, total }: FunilStatusChartProps) {
  if (data.length === 0) return null;

  const totalSteps = data.length;

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          Funil de Status
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Estado atual das demandas · ordenado conforme configuração
        </p>
      </CardHeader>
      <CardContent>
        <div
          className="flex flex-col items-center py-2 gap-[3px]"
          style={{ maxWidth: 560, margin: "0 auto" }}
        >
          {data.map((item, index) => {
            // Largura diminui linearmente: 100% no topo → 34% na base
            const widthPercent =
              totalSteps === 1
                ? 100
                : 100 - (index / (totalSteps - 1)) * 66;

            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const isFirst = index === 0;
            const isLast = index === totalSteps - 1;
            const isEmpty = item.value === 0;

            return (
              <div key={item.slug} className="w-full flex justify-center">
                <div
                  className="relative flex items-center justify-center transition-all duration-500 group"
                  style={{
                    width: `${widthPercent}%`,
                    minHeight: 46,
                    backgroundColor: item.color,
                    opacity: isEmpty ? 0.25 : 0.88,
                    borderRadius: isFirst && isLast
                      ? 12
                      : isFirst
                      ? "12px 12px 0 0"
                      : isLast
                      ? "0 0 12px 12px"
                      : 0,
                  }}
                >
                  <div className="flex items-center gap-2 text-white px-4 py-1 z-10">
                    <span className="font-bold text-lg drop-shadow-sm leading-none">
                      {item.value}
                    </span>
                    <span className="font-semibold text-sm drop-shadow-sm whitespace-nowrap">
                      {item.name}
                    </span>
                    {!isEmpty && (
                      <span className="text-[11px] opacity-80 drop-shadow-sm">
                        ({pct}%)
                      </span>
                    )}
                    {item.is_final && (
                      <span className="ml-1 text-[10px] bg-white/25 px-1.5 py-0.5 rounded-full font-medium">
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legenda rápida abaixo */}
        <div className="flex flex-wrap justify-center gap-3 mt-4 pt-3 border-t">
          {data.filter(d => d.value > 0).map(item => (
            <div key={item.slug} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">
                {item.name}
                {item.is_final && <span className="ml-0.5 text-green-600 dark:text-green-400"> ✓</span>}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
