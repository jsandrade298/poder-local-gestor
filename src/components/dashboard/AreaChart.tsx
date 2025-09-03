import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const areaData = [
  { name: "Trânsito", demandas: 45 },
  { name: "Saúde", demandas: 38 },
  { name: "Educação", demandas: 32 },
  { name: "Infraestrutura", demandas: 28 },
  { name: "Meio Ambiente", demandas: 15 },
  { name: "Segurança", demandas: 12 },
];

export function AreaChart() {
  return (
    <Card className="shadow-sm border-0 bg-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Demandas por Área de Atuação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={areaData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                formatter={(value) => [value, "Demandas"]}
                labelFormatter={(label) => `Área: ${label}`}
              />
              <Bar 
                dataKey="demandas" 
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}