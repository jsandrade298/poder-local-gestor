import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface PlanosStatusChartProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

export function PlanosStatusChart({ data }: PlanosStatusChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (!data.length) {
    return (
      <Card className="backdrop-blur-sm bg-card/95 border border-border/50 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Planos de Ação por Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum plano de ação cadastrado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-sm bg-card/95 border border-border/50 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Planos de Ação por Status
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {total} {total === 1 ? "ação" : "ações"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="opacity-30"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={data.length > 4 ? -20 : 0}
                textAnchor={data.length > 4 ? "end" : "middle"}
                height={data.length > 4 ? 50 : 30}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [value, "Ações"]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
