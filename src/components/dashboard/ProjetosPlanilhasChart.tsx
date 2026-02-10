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

interface ProjetosPlanilhasChartProps {
  data: Array<{
    name: string;
    projetos: number;
    planilhas: number;
  }>;
}

export function ProjetosPlanilhasChart({ data }: ProjetosPlanilhasChartProps) {
  const totalProjetos = data.reduce((s, d) => s + d.projetos, 0);
  const totalPlanilhas = data.reduce((s, d) => s + d.planilhas, 0);

  if (!data.length) {
    return (
      <Card className="backdrop-blur-sm bg-card/95 border border-border/50 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
            Projetos & Planilhas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum projeto ou planilha cadastrado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-sm bg-card/95 border border-border/50 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
          Projetos & Planilhas por Status
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {totalProjetos} proj · {totalPlanilhas} plan
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
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: "13px",
                }}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-foreground">
                    {value === "projetos" ? "Projetos" : "Planilhas"}
                  </span>
                )}
              />
              <Bar
                dataKey="projetos"
                fill="#8b5cf6"
                name="projetos"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="planilhas"
                fill="#06b6d4"
                name="planilhas"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
