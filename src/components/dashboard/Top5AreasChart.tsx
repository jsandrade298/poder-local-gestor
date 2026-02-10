import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface Top5AreasChartProps {
  data: Array<Record<string, any>>;
  statuses: string[];
  getStatusLabel: (slug: string) => string;
  getStatusColor: (slug: string) => string;
}

export function Top5AreasChart({
  data,
  statuses,
  getStatusLabel,
  getStatusColor,
}: Top5AreasChartProps) {
  if (!data.length) {
    return (
      <Card className="backdrop-blur-sm bg-card/95 border border-border/50 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Top 5 Áreas × Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma demanda com área atribuída
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-sm bg-card/95 border border-border/50 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Top 5 Áreas × Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                className="opacity-30"
              />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={120}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: "13px",
                }}
                formatter={(value: number, name: string) => [
                  value,
                  getStatusLabel(name),
                ]}
                labelFormatter={(label) => `${label}`}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-foreground">
                    {getStatusLabel(value)}
                  </span>
                )}
                wrapperStyle={{ fontSize: "12px" }}
              />
              {statuses.map((status) => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="a"
                  fill={getStatusColor(status)}
                  name={status}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
