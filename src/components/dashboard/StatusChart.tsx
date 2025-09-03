import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const statusData = [
  { name: "Solicitado", value: 35, color: "#3b82f6" },
  { name: "Em Andamento", value: 28, color: "#f59e0b" },
  { name: "Concluído", value: 25, color: "#10b981" },
  { name: "Não Atendido", value: 8, color: "#ef4444" },
  { name: "Arquivado", value: 4, color: "#6b7280" },
];

export function StatusChart() {
  return (
    <Card className="shadow-sm border-0 bg-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Demandas por Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [`${value}%`, "Percentual"]}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}