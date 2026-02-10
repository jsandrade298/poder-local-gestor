import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface StatusDonutChartProps {
  title: string;
  data: Array<{
    name: string;
    slug: string;
    value: number;
    percent: number;
    color: string;
  }>;
  total: number;
}

export function StatusDonutChart({ title, data, total }: StatusDonutChartProps) {
  if (total === 0) {
    return (
      <Card className="border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhuma demanda cadastrada
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Donut */}
          <div className="relative w-48 h-48 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} (${
                      total > 0 ? Math.round((value / total) * 100) : 0
                    }%)`,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--popover))",
                    color: "hsl(var(--popover-foreground))",
                    fontSize: "13px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-foreground">
                {total}
              </span>
              <span className="text-[11px] text-muted-foreground">total</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 w-full">
            <div className="space-y-1 max-h-[220px] overflow-y-auto">
              {data.map((item) => (
                <div
                  key={item.slug}
                  className="flex items-center justify-between gap-2 text-sm px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-foreground truncate text-[13px]">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-semibold text-foreground tabular-nums text-[13px]">
                      {item.value}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums w-9 text-right">
                      {item.percent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
