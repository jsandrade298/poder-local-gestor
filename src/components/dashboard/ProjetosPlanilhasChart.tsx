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
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Projetos & Planilhas por Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhum projeto ou planilha cadastrado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
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
              barCategoryGap="20%"
              barGap={4}
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
                  <span className="text-[11px] text-foreground">
                    {value === "projetos" ? "Projetos" : "Planilhas"}
                  </span>
                )}
              />
              <Bar
                dataKey="projetos"
                fill="#8b5cf6"
                name="projetos"
                radius={[4, 4, 0, 0]}
                maxBarSize={70}
              />
              <Bar
                dataKey="planilhas"
                fill="#06b6d4"
                name="planilhas"
                radius={[4, 4, 0, 0]}
                maxBarSize={70}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
