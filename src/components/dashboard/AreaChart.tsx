import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface AreaChartProps {
  data: Array<{
    name: string;
    aberta: number;
    em_andamento: number;
    aguardando: number;
    resolvida: number;
    cancelada: number;
    total: number;
  }>;
}

export function AreaChart({ data }: AreaChartProps) {
  return (
    <Card className="backdrop-blur-sm bg-card/95 border border-border/50 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
          Demandas por Área de Atuação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
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
                formatter={(value, name) => [value, name]}
                labelFormatter={(label) => `Área: ${label}`}
              />
              <Legend />
              <Bar 
                dataKey="aberta"
                stackId="a"
                fill="#3b82f6"
                name="Aberta"
              />
              <Bar 
                dataKey="em_andamento"
                stackId="a"
                fill="#f59e0b"
                name="Em Andamento"
              />
              <Bar 
                dataKey="aguardando"
                stackId="a"
                fill="#8b5cf6"
                name="Aguardando"
              />
              <Bar 
                dataKey="resolvida"
                stackId="a"
                fill="#10b981"
                name="Resolvida"
              />
              <Bar 
                dataKey="cancelada"
                stackId="a"
                fill="#ef4444"
                name="Cancelada"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}