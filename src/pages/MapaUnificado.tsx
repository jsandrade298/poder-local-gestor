import { useState, useMemo } from 'react';
import { useMapaUnificado, DemandaMapa, MunicipeMapa } from '@/hooks/useMapaUnificado';
import { ClusterMap } from '@/components/mapa/ClusterMap';
import { HeatmapControls } from '@/components/mapa/HeatmapControls';
import { 
  MapPin, 
  Filter, 
  Route, 
  BarChart3, 
  Search, 
  RefreshCw,
  FileText,
  Users,
  Phone,
  X,
  ChevronRight,
  Navigation,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Copy,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

// Cores por status
const STATUS_COLORS: Record<string, string> = {
  'aberta': '#ef4444',
  'em_andamento': '#f59e0b',
  'concluida': '#22c55e',
  'cancelada': '#6b7280',
  'pendente': '#3b82f6',
};

const STATUS_LABELS: Record<string, string> = {
  'aberta': 'Aberta',
  'em_andamento': 'Em Andamento',
  'concluida': 'Concluída',
  'cancelada': 'Cancelada',
  'pendente': 'Pendente',
};

export default function MapaUnificado() {
  // Hook de dados
  const {
    areas,
    tags,
    demandas,
    municipes,
    demandasRaw,
    municipesRaw,
    semCoordenadas,
    isLoading,
    refetch
  } = useMapaUnificado();

  // Estados de filtro
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'demandas' | 'municipes'>('todos');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [areaFiltro, setAreaFiltro] = useState<string>('todas');
  const [tagFiltro, setTagFiltro] = useState<string>('todas');

  // Estados de heatmap
  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const [heatmapType, setHeatmapType] = useState<'demandas' | 'municipes' | 'ambos'>('demandas');

  // Estados de seleção
  const [itemSelecionado, setItemSelecionado] = useState<DemandaMapa | MunicipeMapa | null>(null);

  // Estados de rota
  const [pontosRota, setPontosRota] = useState<Array<DemandaMapa | MunicipeMapa>>([]);
  const [origemRota, setOrigemRota] = useState<{ lat: number; lng: number } | null>(null);

  // Filtrar demandas
  const demandasFiltradas = useMemo(() => {
    return demandas.filter(d => {
      // Busca textual
      if (busca) {
        const termo = busca.toLowerCase();
        const match = 
          d.titulo?.toLowerCase().includes(termo) ||
          d.protocolo?.toLowerCase().includes(termo) ||
          d.bairro?.toLowerCase().includes(termo) ||
          d.municipe_nome?.toLowerCase().includes(termo);
        if (!match) return false;
      }

      // Filtro de status
      if (statusFiltro !== 'todos' && d.status !== statusFiltro) return false;

      // Filtro de área
      if (areaFiltro !== 'todas' && d.area_id !== areaFiltro) return false;

      return true;
    });
  }, [demandas, busca, statusFiltro, areaFiltro]);

  // Filtrar munícipes
  const municipesFiltrados = useMemo(() => {
    return municipes.filter(m => {
      // Busca textual
      if (busca) {
        const termo = busca.toLowerCase();
        const match = 
          m.nome?.toLowerCase().includes(termo) ||
          m.bairro?.toLowerCase().includes(termo) ||
          m.endereco?.toLowerCase().includes(termo);
        if (!match) return false;
      }

      // Filtro de tag
      if (tagFiltro !== 'todas') {
        const temTag = m.tags?.some(t => t.id === tagFiltro);
        if (!temTag) return false;
      }

      return true;
    });
  }, [municipes, busca, tagFiltro]);

  // Contagem por status
  const contagemStatus = useMemo(() => {
    const contagem: Record<string, number> = {};
    demandasRaw.forEach(d => {
      const status = d.status || 'sem_status';
      contagem[status] = (contagem[status] || 0) + 1;
    });
    return contagem;
  }, [demandasRaw]);

  // Total de itens no mapa
  const totalNoMapa = 
    (tipoFiltro === 'todos' || tipoFiltro === 'demandas' ? demandasFiltradas.length : 0) +
    (tipoFiltro === 'todos' || tipoFiltro === 'municipes' ? municipesFiltrados.length : 0);

  // Obter geolocalização
  const obterLocalizacao = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOrigemRota({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          toast.success('Localização obtida com sucesso!');
        },
        (error) => {
          toast.error('Erro ao obter localização: ' + error.message);
        }
      );
    } else {
      toast.error('Geolocalização não suportada pelo navegador');
    }
  };

  // Adicionar à rota
  const adicionarARota = (item: DemandaMapa | MunicipeMapa) => {
    if (pontosRota.find(p => p.id === item.id)) {
      toast.warning('Este ponto já está na rota');
      return;
    }
    setPontosRota([...pontosRota, item]);
    toast.success('Ponto adicionado à rota');
  };

  // Remover da rota
  const removerDaRota = (id: string) => {
    setPontosRota(pontosRota.filter(p => p.id !== id));
  };

  // Mover ponto na rota
  const moverPonto = (index: number, direcao: 'up' | 'down') => {
    const novospontos = [...pontosRota];
    const novoIndex = direcao === 'up' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= novospontos.length) return;
    [novospontos[index], novospontos[novoIndex]] = [novospontos[novoIndex], novospontos[index]];
    setPontosRota(novospontos);
  };

  // Exportar para Google Maps
  const exportarGoogleMaps = () => {
    if (pontosRota.length === 0) {
      toast.warning('Adicione pontos à rota primeiro');
      return;
    }

    const waypoints = pontosRota
      .filter(p => p.latitude && p.longitude)
      .map(p => `${p.latitude},${p.longitude}`);

    let url = 'https://www.google.com/maps/dir/';
    
    if (origemRota) {
      url += `${origemRota.lat},${origemRota.lng}/`;
    }
    
    url += waypoints.join('/');
    
    window.open(url, '_blank');
  };

  // Formatar telefone para WhatsApp
  const formatWhatsAppLink = (telefone: string | null) => {
    if (!telefone) return null;
    const numero = telefone.replace(/\D/g, '');
    return `https://wa.me/55${numero}`;
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar Esquerda - Filtros */}
      <div className="w-80 border-r bg-background flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-lg">Gestão Territorial</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {totalNoMapa} itens no mapa
          </p>
        </div>

        <Tabs defaultValue="filtros" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 px-4 pt-2">
            <TabsTrigger value="filtros" className="text-xs">
              <Filter className="h-3 w-3 mr-1" />
              Filtros
            </TabsTrigger>
            <TabsTrigger value="rotas" className="text-xs">
              <Route className="h-3 w-3 mr-1" />
              Rotas
            </TabsTrigger>
            <TabsTrigger value="analise" className="text-xs">
              <BarChart3 className="h-3 w-3 mr-1" />
              Análise
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {/* Tab Filtros */}
            <TabsContent value="filtros" className="p-4 space-y-4 mt-0">
              {/* Busca */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">BUSCA RÁPIDA</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, protocolo, endereço..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Tipo de dado */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">TIPO DE DADO</label>
                <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="demandas">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-red-500" />
                        Demandas
                      </div>
                    </SelectItem>
                    <SelectItem value="municipes">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-purple-500" />
                        Munícipes
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">STATUS (DEMANDAS)</label>
                <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: STATUS_COLORS[value] }}
                          />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Áreas */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  ÁREAS (DEMANDAS)
                </label>
                <Select value={areaFiltro} onValueChange={setAreaFiltro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as áreas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as áreas</SelectItem>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: area.cor || '#6b7280' }}
                          />
                          {area.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  TAGS (MUNÍCIPES)
                </label>
                <Select value={tagFiltro} onValueChange={setTagFiltro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as tags</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: tag.cor || '#6b7280' }}
                          />
                          {tag.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Controles de Heatmap */}
              <HeatmapControls
                heatmapVisible={heatmapVisible}
                setHeatmapVisible={setHeatmapVisible}
                heatmapType={heatmapType}
                setHeatmapType={setHeatmapType}
                demandasCount={demandasFiltradas.length}
                municipesCount={municipesFiltrados.length}
              />

              <Separator />

              {/* Botão Atualizar */}
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => refetch()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Atualizar Mapa
              </Button>

              {/* Alerta de itens sem coordenadas */}
              {(semCoordenadas.demandas > 0 || semCoordenadas.municipes > 0) && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium text-amber-800">
                          Itens sem localização:
                        </p>
                        <p className="text-amber-700">
                          {semCoordenadas.demandas > 0 && `${semCoordenadas.demandas} demandas`}
                          {semCoordenadas.demandas > 0 && semCoordenadas.municipes > 0 && ', '}
                          {semCoordenadas.municipes > 0 && `${semCoordenadas.municipes} munícipes`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab Rotas */}
            <TabsContent value="rotas" className="p-4 space-y-4 mt-0">
              {/* Origem */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">PONTO DE PARTIDA</label>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={obterLocalizacao}
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  {origemRota 
                    ? `${origemRota.lat.toFixed(4)}, ${origemRota.lng.toFixed(4)}`
                    : 'Usar minha localização'
                  }
                </Button>
              </div>

              <Separator />

              {/* Pontos da rota */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    PONTOS DA ROTA ({pontosRota.length})
                  </label>
                  {pontosRota.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setPontosRota([])}
                      className="h-6 text-xs text-red-600 hover:text-red-700"
                    >
                      Limpar
                    </Button>
                  )}
                </div>

                {pontosRota.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Clique em um marcador no mapa e adicione à rota
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pontosRota.map((ponto, index) => (
                      <Card key={ponto.id} className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => moverPonto(index, 'up')}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => moverPonto(index, 'down')}
                              disabled={index === pontosRota.length - 1}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {index + 1}. {'titulo' in ponto ? ponto.titulo : ponto.nome}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {'bairro' in ponto && ponto.bairro}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-600"
                            onClick={() => removerDaRota(ponto.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {pontosRota.length > 0 && (
                <>
                  <Separator />
                  
                  {/* Botões de exportação */}
                  <div className="space-y-2">
                    <Button 
                      className="w-full" 
                      onClick={exportarGoogleMaps}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir no Google Maps
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Tab Análise */}
            <TabsContent value="analise" className="p-4 space-y-4 mt-0">
              {/* Cards de resumo */}
              <div className="grid grid-cols-2 gap-2">
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="text-lg font-bold">{demandasRaw.length}</p>
                        <p className="text-xs text-muted-foreground">Demandas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      <div>
                        <p className="text-lg font-bold">{municipesRaw.length}</p>
                        <p className="text-xs text-muted-foreground">Munícipes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Distribuição por status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Por Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(STATUS_LABELS).map(([status, label]) => {
                    const count = contagemStatus[status] || 0;
                    const percent = demandasRaw.length > 0 
                      ? (count / demandasRaw.length) * 100 
                      : 0;
                    
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="flex items-center gap-1">
                            <div 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[status] }}
                            />
                            {label}
                          </span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                        <Progress 
                          value={percent} 
                          className="h-1.5"
                          style={{ 
                            '--progress-background': STATUS_COLORS[status] 
                          } as any}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Top Áreas */}
              {areas.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top 5 Áreas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {areas
                        .map(area => ({
                          ...area,
                          count: demandasRaw.filter(d => d.area_id === area.id).length
                        }))
                        .filter(a => a.count > 0)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5)
                        .map(area => (
                          <div key={area.id} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 truncate">
                              <div 
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: area.cor || '#6b7280' }}
                              />
                              <span className="truncate">{area.nome}</span>
                            </span>
                            <Badge variant="secondary" className="ml-2">
                              {area.count}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Mapa Central */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 bg-background p-4 rounded-lg shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando mapa...</span>
            </div>
          </div>
        )}
        
        <ClusterMap
          demandas={tipoFiltro === 'municipes' ? [] : demandasFiltradas}
          municipes={tipoFiltro === 'demandas' ? [] : municipesFiltrados}
          mostrarDemandas={tipoFiltro !== 'municipes'}
          mostrarMunicipes={tipoFiltro !== 'demandas'}
          heatmapVisible={heatmapVisible}
          heatmapType={heatmapType}
          onDemandaClick={(d) => setItemSelecionado(d)}
          onMunicipeClick={(m) => setItemSelecionado(m)}
        />
      </div>

      {/* Sidebar Direita - Detalhes */}
      {itemSelecionado && (
        <div className="w-80 border-l bg-background flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Detalhes</h2>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setItemSelecionado(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {'titulo' in itemSelecionado ? (
                // Detalhes de Demanda
                <>
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: (itemSelecionado.area_cor || '#3b82f6') + '20' }}
                    >
                      <FileText 
                        className="h-5 w-5" 
                        style={{ color: itemSelecionado.area_cor || '#3b82f6' }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{itemSelecionado.titulo}</h3>
                      <p className="text-sm text-muted-foreground">
                        {itemSelecionado.protocolo}
                      </p>
                    </div>
                  </div>

                  {itemSelecionado.status && (
                    <Badge 
                      style={{
                        backgroundColor: STATUS_COLORS[itemSelecionado.status] + '20',
                        color: STATUS_COLORS[itemSelecionado.status],
                        borderColor: STATUS_COLORS[itemSelecionado.status]
                      }}
                    >
                      {STATUS_LABELS[itemSelecionado.status] || itemSelecionado.status}
                    </Badge>
                  )}

                  {itemSelecionado.descricao && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                      <p className="text-sm">{itemSelecionado.descricao}</p>
                    </div>
                  )}

                  {itemSelecionado.area_nome && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Área</p>
                      <Badge variant="outline">{itemSelecionado.area_nome}</Badge>
                    </div>
                  )}

                  {itemSelecionado.municipe_nome && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Solicitante</p>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{itemSelecionado.municipe_nome}</span>
                      </div>
                      {itemSelecionado.municipe_telefone && (
                        <a
                          href={formatWhatsAppLink(itemSelecionado.municipe_telefone) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 mt-1"
                        >
                          <Phone className="h-3 w-3" />
                          {itemSelecionado.municipe_telefone}
                        </a>
                      )}
                    </div>
                  )}

                  {itemSelecionado.bairro && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Localização</p>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {[itemSelecionado.logradouro, itemSelecionado.numero, itemSelecionado.bairro]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Detalhes de Munícipe
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{itemSelecionado.nome}</h3>
                      {itemSelecionado.email && (
                        <p className="text-sm text-muted-foreground">{itemSelecionado.email}</p>
                      )}
                    </div>
                  </div>

                  {itemSelecionado.telefone && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Telefone</p>
                      <a
                        href={formatWhatsAppLink(itemSelecionado.telefone) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
                      >
                        <Phone className="h-4 w-4" />
                        {itemSelecionado.telefone}
                      </a>
                    </div>
                  )}

                  {itemSelecionado.bairro && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Endereço</p>
                      <div className="flex items-start gap-1 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>
                          {[itemSelecionado.endereco, itemSelecionado.bairro, itemSelecionado.cidade]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {itemSelecionado.demandas_count > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Demandas</p>
                      <Badge variant="secondary">{itemSelecionado.demandas_count} demanda(s)</Badge>
                    </div>
                  )}

                  {itemSelecionado.tags && itemSelecionado.tags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {itemSelecionado.tags.map(tag => (
                          <Badge 
                            key={tag.id}
                            variant="outline"
                            style={{
                              backgroundColor: (tag.cor || '#6b7280') + '20',
                              borderColor: tag.cor || '#6b7280'
                            }}
                          >
                            {tag.nome}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <Separator />

              {/* Ações */}
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => adicionarARota(itemSelecionado)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar à Rota
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
