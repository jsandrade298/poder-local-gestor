import { useState, useMemo } from 'react';
import { useMapaUnificado } from '@/hooks/useMapaUnificado';
import { useMapConfig } from '@/hooks/useMapaConfiguracoes';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, RefreshCw, AlertCircle, Users, FileText, 
  ArrowRight, Search, Filter, Route as RouteIcon, 
  Layers, Navigation 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Importa o componente de mapa
import { ClusterMap, MapMarker } from '@/components/map/ClusterMap';

// --- Interface Auxiliar para Endereço ---
const formatAddress = (data: any) => {
  // Prioriza os campos de endereço explícitos do banco de dados
  const parts = [
    data.logradouro || data.rua,
    data.numero,
    data.bairro,
    data.cidade
  ].filter(Boolean);
  
  if (parts.length > 0) return parts.join(', ');
  
  // Fallback se não houver dados estruturados
  return data.endereco_completo || data.endereco || 'Endereço não informado';
};

export default function MapaUnificado() {
  const { center, zoom } = useMapConfig();
  const { demandas, municipes, isLoading, refetch } = useMapaUnificado();

  // --- Estados de UI ---
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<MapMarker[]>([]);
  const [activeTabLeft, setActiveTabLeft] = useState("filtros");
  
  // --- Estados de Filtro ---
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos"); // 'todos', 'demandas', 'municipes'

  // --- Filtragem dos Dados ---
  const filteredMarkers = useMemo(() => {
    // 1. Converter Demandas em Marcadores
    const demandaMarkers: MapMarker[] = demandas.map(d => ({
      id: d.id,
      latitude: d.latitude,
      longitude: d.longitude,
      title: d.titulo,
      description: d.protocolo,
      status: d.status || 'pendente',
      type: 'demanda',
      originalData: d
    }));

    // 2. Converter Munícipes em Marcadores
    const municipeMarkers: MapMarker[] = municipes.map(m => ({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      title: m.nome,
      description: m.bairro || '',
      type: 'municipe',
      originalData: m
    }));

    let all = [...demandaMarkers, ...municipeMarkers];

    // 3. Aplicar Filtros
    if (tipoFilter !== 'todos') {
      all = all.filter(m => m.type === (tipoFilter === 'demandas' ? 'demanda' : 'municipe'));
    }

    if (statusFilter !== 'todos') {
      all = all.filter(m => m.status === statusFilter || (m.type === 'municipe' && statusFilter === 'ativo'));
    }

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      all = all.filter(m => 
        m.title.toLowerCase().includes(lowerTerm) || 
        (m.description && m.description.toLowerCase().includes(lowerTerm)) ||
        formatAddress(m.originalData).toLowerCase().includes(lowerTerm)
      );
    }

    return all;
  }, [demandas, municipes, searchTerm, statusFilter, tipoFilter]);

  // --- Handlers ---
  const handleClusterClick = (items: MapMarker[]) => {
    setSelectedItems(items);
    setIsRightPanelOpen(true);
  };

  const selectedDemandas = selectedItems.filter(i => i.type === 'demanda');
  const selectedMunicipes = selectedItems.filter(i => i.type === 'municipe');

  return (
    <div className="flex w-full h-[calc(100vh-4rem)] overflow-hidden bg-gray-100 relative">
      
      {/* =================================================================================
          BARRA LATERAL ESQUERDA (Filtros e Rotas)
          ================================================================================= */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
            <MapPin className="h-5 w-5 text-primary" />
            Gestão Territorial
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {filteredMarkers.length} itens encontrados
          </p>
        </div>

        <Tabs value={activeTabLeft} onValueChange={setActiveTabLeft} className="flex-1 flex flex-col">
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="filtros" className="gap-2">
                <Filter className="h-4 w-4" /> Filtros
              </TabsTrigger>
              <TabsTrigger value="rota" className="gap-2">
                <RouteIcon className="h-4 w-4" /> Rotas
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ABA FILTROS */}
          <TabsContent value="filtros" className="flex-1 p-4 space-y-6 overflow-y-auto">
            
            {/* Busca Textual */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-gray-500">Busca Rápida</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Nome, título ou endereço..." 
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Filtros de Categoria */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-gray-500">Exibir</Label>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Tudo (Demandas e Munícipes)</SelectItem>
                  <SelectItem value="demandas">Apenas Demandas</SelectItem>
                  <SelectItem value="municipes">Apenas Munícipes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtros de Status */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-gray-500">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status da demanda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Resumo/Legenda */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase text-gray-500">Legenda</Label>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500 block"></span>
                  <span>Demandas</span>
                </div>
                <Badge variant="outline" className="font-mono">{filteredMarkers.filter(m => m.type === 'demanda').length}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-blue-500 block"></span>
                  <span>Munícipes</span>
                </div>
                <Badge variant="outline" className="font-mono">{filteredMarkers.filter(m => m.type === 'municipe').length}</Badge>
              </div>
            </div>

            <Button variant="outline" className="w-full mt-4" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar Dados
            </Button>

          </TabsContent>

          {/* ABA ROTA */}
          <TabsContent value="rota" className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-4">
              <div className="flex items-start gap-3">
                <Navigation className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 text-sm">Planejador de Rota</h4>
                  <p className="text-xs text-blue-700 mt-1">
                    Selecione itens no mapa para criar uma rota otimizada de visitação.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
                {/* Aqui virá a lista de pontos selecionados para a rota */}
                <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
                    <p className="text-sm">Nenhum ponto selecionado.</p>
                    <p className="text-xs mt-1">Clique nos pinos para adicionar.</p>
                </div>

                <Button className="w-full" disabled>
                    <RouteIcon className="h-4 w-4 mr-2" /> Gerar Rota Otimizada
                </Button>
            </div>
          </TabsContent>
        </Tabs>
      </aside>

      {/* =================================================================================
          ÁREA DO MAPA (CENTRO)
          ================================================================================= */}
      <main className="flex-1 relative h-full bg-gray-200">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-12 w-12 rounded-full" />
              <p className="text-muted-foreground animate-pulse">Carregando mapa...</p>
            </div>
          </div>
        ) : filteredMarkers.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
             <div className="bg-white p-6 rounded-lg shadow-lg text-center pointer-events-auto">
                <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Nenhum resultado</h3>
                <p className="text-sm text-gray-500 mb-4">Tente ajustar os filtros na barra lateral.</p>
                <Button variant="outline" size="sm" onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("todos");
                    setTipoFilter("todos");
                }}>Limpar Filtros</Button>
             </div>
          </div>
        ) : null}

        {/* Componente do Mapa */}
        <div className="absolute inset-0 z-0">
            <ClusterMap
                markers={filteredMarkers}
                center={center}
                zoom={zoom}
                onClusterClick={handleClusterClick}
            />
        </div>
      </main>

      {/* =================================================================================
          PAINEL DIREITO (DETALHES DO CLUSTER/PINO) - NON-MODAL
          ================================================================================= */}
      <Sheet open={isRightPanelOpen} onOpenChange={setIsRightPanelOpen} modal={false}>
        <SheetContent 
            side="right" 
            className="w-[400px] sm:w-[450px] p-0 shadow-xl border-l border-gray-200 flex flex-col focus:outline-none"
            // Removemos o overlay escuro padrão via CSS global ou prop se suportada,
            // mas aqui garantimos que o container permita interação
            style={{ pointerEvents: "auto" }}
        >
          <div className="p-6 border-b bg-white">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span>Raio-X do Local</span>
                <Badge variant="outline" className="ml-2">
                    {selectedItems.length} itens
                </Badge>
              </SheetTitle>
              <SheetDescription>
                Visualize munícipes e demandas nesta localização exata.
              </SheetDescription>
            </SheetHeader>
          </div>

          <Tabs defaultValue={selectedDemandas.length > 0 ? "demandas" : "municipes"} className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
            <div className="px-6 pt-4">
                <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="demandas" disabled={selectedDemandas.length === 0}>
                    Demandas ({selectedDemandas.length})
                </TabsTrigger>
                <TabsTrigger value="municipes" disabled={selectedMunicipes.length === 0}>
                    Munícipes ({selectedMunicipes.length})
                </TabsTrigger>
                </TabsList>
            </div>

            {/* LISTA DE DEMANDAS */}
            <TabsContent value="demandas" className="flex-1 overflow-auto p-4 space-y-3">
                <ScrollArea className="h-full pr-2">
                  {selectedDemandas.map((item) => (
                    <Card key={item.id} className="p-4 hover:shadow-md transition-shadow bg-white border-l-4 border-l-red-500">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant={item.originalData.status === 'concluido' ? 'default' : 'secondary'} className="text-[10px]">
                          {item.originalData.status}
                        </Badge>
                        <span className="text-[10px] text-gray-400 font-mono">
                          #{item.originalData.protocolo?.slice(-6)}
                        </span>
                      </div>
                      
                      <h4 className="font-semibold text-sm mb-1 text-gray-900">{item.title}</h4>
                      
                      {/* ENDEREÇO CORRIGIDO - Pega direto do banco */}
                      <div className="flex items-start gap-1.5 mb-2">
                        <MapPin className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-gray-600 line-clamp-2">
                            {formatAddress(item.originalData)}
                        </p>
                      </div>

                      <p className="text-xs text-gray-500 line-clamp-2 mb-3 bg-gray-50 p-2 rounded">
                        {item.originalData.descricao || 'Sem descrição detalhada.'}
                      </p>
                      
                      <Button size="sm" variant="outline" className="w-full text-xs h-8">
                        Ver Detalhes <ArrowRight className="ml-2 h-3 w-3" />
                      </Button>
                    </Card>
                  ))}
                </ScrollArea>
            </TabsContent>

            {/* LISTA DE MUNÍCIPES */}
            <TabsContent value="municipes" className="flex-1 overflow-auto p-4 space-y-3">
                <ScrollArea className="h-full pr-2">
                  {selectedMunicipes.map((item) => (
                    <Card key={item.id} className="p-3 hover:shadow-md transition-shadow bg-white border-l-4 border-l-blue-500 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                        {item.title.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{item.title}</h4>
                        
                        {/* ENDEREÇO CORRIGIDO */}
                        <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            <span className="text-[10px] text-gray-500 truncate max-w-[180px]">
                                {formatAddress(item.originalData)}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                            {item.originalData.telefone && (
                                <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    📱 {item.originalData.telefone}
                                </span>
                            )}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-gray-400 hover:text-blue-600">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Card>
                  ))}
                </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
