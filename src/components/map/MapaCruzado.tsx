import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Maximize2, Minimize2, Map as MapIcon, BarChart3, SlidersHorizontal, Lightbulb } from 'lucide-react';

// --- CORREÇÃO AQUI: imports apontando para '@/components/map/...' (sem o 'a' no final de map) ---
import { ClusterMapAvancado } from '@/components/map/ClusterMapAvancado';
import { FiltrosCruzados } from '@/components/map/FiltrosCruzados';
import { AnaliseCruzadaChart } from '@/components/map/AnaliseCruzadaChart';
import { InsightsPanel } from '@/components/map/InsightsPanel';

import { useMapaCruzado } from '@/hooks/useMapaCruzado';

export default function MapaCruzado() {
  const { 
    dadosFiltrados, 
    filtros, 
    atualizarFiltros, 
    metricas, 
    insights,
    isLoading 
  } = useMapaCruzado();

  const [activeTab, setActiveTab] = useState('mapa');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 overflow-hidden">
      
      {/* Header da Ferramenta */}
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-gray-800">
            <MapIcon className="h-5 w-5 text-indigo-600" />
            Análise Cruzada Territorial
          </h1>
          <p className="text-xs text-gray-500">
            Cruze dados de áreas (demandas) e tags (munícipes) para gerar inteligência.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            {metricas.totalMun} Munícipes
          </Badge>
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
            {metricas.totalDem} Demandas
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Sidebar de Filtros (Esquerda) */}
        <aside 
          className={`
            bg-white border-r border-gray-200 transition-all duration-300 flex flex-col z-20
            ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full opacity-0 overflow-hidden'}
          `}
        >
          <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Configuração
            </h3>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              <FiltrosCruzados 
                filtros={filtros} 
                onChange={atualizarFiltros} 
              />
            </div>
          </ScrollArea>
        </aside>

        {/* Botão Flutuante para Abrir/Fechar Sidebar */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-4 left-4 z-30 shadow-md rounded-full h-8 w-8 bg-white hover:bg-gray-100"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{ left: isSidebarOpen ? '20.5rem' : '1rem', transition: 'left 0.3s' }}
        >
          {isSidebarOpen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>

        {/* Área Principal (Direita) */}
        <main className="flex-1 flex flex-col min-w-0 bg-gray-100">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            
            <div className="px-4 pt-2 bg-white border-b">
              <TabsList className="w-full justify-start h-10 bg-transparent p-0">
                <TabsTrigger 
                  value="mapa" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:shadow-none rounded-none px-4"
                >
                  <MapIcon className="h-4 w-4 mr-2" /> Visão Geoespacial
                </TabsTrigger>
                <TabsTrigger 
                  value="analise" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:shadow-none rounded-none px-4"
                >
                  <BarChart3 className="h-4 w-4 mr-2" /> Gráficos & Tendências
                </TabsTrigger>
                <TabsTrigger 
                  value="insights" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:shadow-none rounded-none px-4"
                >
                  <Lightbulb className="h-4 w-4 mr-2" /> Insights IA
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 relative overflow-hidden">
              
              <TabsContent value="mapa" className="h-full m-0 p-0 border-none data-[state=active]:flex">
                <div className="w-full h-full">
                  {/* Mapa Avancado que suporta camadas de calor e clusters mistos */}
                  <ClusterMapAvancado 
                    dados={dadosFiltrados} 
                    isLoading={isLoading}
                  />
                </div>
              </TabsContent>

              <TabsContent value="analise" className="h-full m-0 p-6 overflow-y-auto">
                <div className="max-w-5xl mx-auto space-y-6">
                  <AnaliseCruzadaChart metricas={metricas} dados={dadosFiltrados} />
                </div>
              </TabsContent>

              <TabsContent value="insights" className="h-full m-0 p-6 overflow-y-auto">
                <div className="max-w-3xl mx-auto">
                  <InsightsPanel insights={insights} isLoading={isLoading} />
                </div>
              </TabsContent>

            </div>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
