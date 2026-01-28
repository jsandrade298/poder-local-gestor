import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Label
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AnaliseCruzadaChartProps {
  dadosCruzados: any[];
  areas: any[];
  tags: any[];
}

export function AnaliseCruzadaChart({ dadosCruzados, areas, tags }: AnaliseCruzadaChartProps) {
  
  // Preparar dados para gráfico de barras (Top combinações)
  const topCombinacoes = useMemo(() => {
    return dadosCruzados
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10)
      .map(item => ({
        nome: `${item.tag_nome} → ${item.area_nome}`,
        quantidade: item.quantidade,
        percentual: item.percentual,
        corTag: item.tag_cor || '#6b7280',
        corArea: item.area_cor || '#6b7280',
      }));
  }, [dadosCruzados]);

  // Preparar dados para gráfico de pizza (Distribuição por área)
  const dadosPorArea = useMemo(() => {
    const agrupado = new Map();
    
    dadosCruzados.forEach(item => {
      const existente = agrupado.get(item.area_id) || {
        nome: item.area_nome,
        quantidade: 0,
        cor: item.area_cor || '#6b7280',
      };
      existente.quantidade += item.quantidade;
      agrupado.set(item.area_id, existente);
    });
    
    return Array.from(agrupado.values())
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [dadosCruzados]);

  // Preparar dados para gráfico de pizza (Distribuição por tag)
  const dadosPorTag = useMemo(() => {
    const agrupado = new Map();
    
    dadosCruzados.forEach(item => {
      const existente = agrupado.get(item.tag_id) || {
        nome: item.tag_nome,
        quantidade: 0,
        cor: item.tag_cor || '#6b7280',
      };
      existente.quantidade += item.quantidade;
      agrupado.set(item.tag_id, existente);
    });
    
    return Array.from(agrupado.values())
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [dadosCruzados]);

  // Calcular correlação força (heat map data)
  const heatMapData = useMemo(() => {
    if (!dadosCruzados.length) return [];
    
    // Agrupar por tag
    const tagsMap = new Map();
    tags.forEach(tag => {
      tagsMap.set(tag.id, {
        nome: tag.nome,
        cor: tag.cor,
        areas: new Map()
      });
    });
    
    // Preencher com dados
    dadosCruzados.forEach(item => {
      const tag = tagsMap.get(item.tag_id);
      if (tag) {
        tag.areas.set(item.area_id, {
          nome: item.area_nome,
          quantidade: item.quantidade,
          percentual: item.percentual,
          cor: item.area_cor
        });
      }
    });
    
    // Converter para array
    return Array.from(tagsMap.values()).map(tag => ({
      tag: tag.nome,
      corTag: tag.cor,
      ...Array.from(tag.areas.values()).reduce((acc, area, idx) => ({
        ...acc,
        [`area_${idx}`]: area.quantidade,
        [`area_${idx}_nome`]: area.nome,
        [`area_${idx}_cor`]: area.cor
      }), {})
    }));
  }, [dadosCruzados, tags]);

  if (dadosCruzados.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Nenhum dado disponível para análise. Aplique filtros diferentes.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="barras" className="w-full flex-1 flex flex-col">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="barras">Top Combinações</TabsTrigger>
          <TabsTrigger value="pizza">Distribuição</TabsTrigger>
          <TabsTrigger value="heatmap">Correlação</TabsTrigger>
        </TabsList>
        
        <TabsContent value="barras" className="flex-1">
          <Card className="p-4 h-full">
            <h4 className="font-medium mb-4">Top 10 Combinações</h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topCombinacoes}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="nome" 
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value} demandas`, 'Quantidade']}
                    labelFormatter={(label) => `Combinação: ${label}`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="quantidade" 
                    name="Quantidade de Demandas"
                    radius={[0, 4, 4, 0]}
                  >
                    {topCombinacoes.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`}
                        fill={`url(#gradient-${index})`}
                      />
                    ))}
                  </Bar>
                  <defs>
                    {topCombinacoes.map((entry, index) => (
                      <linearGradient
                        key={index}
                        id={`gradient-${index}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor={entry.corTag} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={entry.corArea} stopOpacity={0.8} />
                      </linearGradient>
                    ))}
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="pizza" className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            <Card className="p-4">
              <h4 className="font-medium mb-4">Por Área</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosPorArea.slice(0, 6)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ nome, percent }) => `${nome}: ${percent.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="quantidade"
                      nameKey="nome"
                    >
                      {dadosPorArea.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                      <Label value="Áreas" position="center" />
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value} demandas`, 'Quantidade']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            
            <Card className="p-4">
              <h4 className="font-medium mb-4">Por Grupo (Tag)</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosPorTag.slice(0, 6)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ nome, percent }) => `${nome}: ${percent.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="quantidade"
                      nameKey="nome"
                    >
                      {dadosPorTag.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                      <Label value="Grupos" position="center" />
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value} demandas`, 'Quantidade']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="heatmap" className="flex-1">
          <Card className="p-4 h-full">
            <h4 className="font-medium mb-4">Força da Correlação</h4>
            <ScrollArea className="h-80">
              <div className="space-y-2">
                {heatMapData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div 
                      className="w-32 text-sm font-medium truncate"
                      style={{ color: item.corTag }}
                    >
                      {item.tag}
                    </div>
                    <div className="flex-1 flex gap-1">
                      {Object.keys(item)
                        .filter(key => key.startsWith('area_') && !key.includes('nome') && !key.includes('cor'))
                        .map((key, areaIdx) => (
                          <div 
                            key={areaIdx}
                            className="flex-1 h-8 rounded relative group"
                            style={{ 
                              backgroundColor: item[`area_${areaIdx}_cor`] || '#ccc',
                              opacity: Math.min(0.3 + (item[key] / 10), 1)
                            }}
                            title={`${item[`area_${areaIdx}_nome`]}: ${item[key]} demandas`}
                          >
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                              {item[key]}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-4 text-xs text-muted-foreground">
              <p>Intensidade da cor indica força da correlação entre grupo e área.</p>
              <p>Número mostra quantidade de demandas.</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
