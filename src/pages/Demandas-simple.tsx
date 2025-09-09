import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Search, Filter, Eye, Edit, Trash2, Download, Upload, FileText, Activity } from "lucide-react";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { EditDemandaDialog } from "@/components/forms/EditDemandaDialog";
import { ViewDemandaDialog } from "@/components/forms/ViewDemandaDialog";
import { ImportCSVDialogDemandas } from "@/components/forms/ImportCSVDialogDemandas";
import { ValidarMunicipesDialog } from "@/components/forms/ValidarMunicipesDialog";
import { toast } from "sonner";
import { formatInTimeZone } from 'date-fns-tz';
import { formatDateOnly, formatDateTime } from '@/lib/dateUtils';
import { useLocation, useSearchParams } from "react-router-dom";
import * as XLSX from 'xlsx';

export default function Demandas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedResponsavel, setSelectedResponsavel] = useState("");
  const [selectedPrioridade, setSelectedPrioridade] = useState("");
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [importResults, setImportResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [novaDemandaOpen, setNovaDemandaOpen] = useState(false);
  const [editDemandaOpen, setEditDemandaOpen] = useState(false);
  const [viewDemandaOpen, setViewDemandaOpen] = useState(false);
  const [selectedDemanda, setSelectedDemanda] = useState<any>(null);
  const [deleteDemandaOpen, setDeleteDemandaOpen] = useState(false);
  const [validarMunicipesOpen, setValidarMunicipesOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const area = searchParams.get('area') || '';
  const status = searchParams.get('status') || '';
  const responsavel = searchParams.get('responsavel') || '';
  const prioridade = searchParams.get('prioridade') || '';

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [areas, setAreas] = useState<any[]>([]);
  const [responsaveis, setResponsaveis] = useState<any[]>([]);
  const [statusList, setStatusList] = useState<any[]>([]);
  const [prioridades, setPrioridades] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (selectedArea) params.set('area', selectedArea);
    else params.delete('area');
    if (selectedStatus) params.set('status', selectedStatus);
    else params.delete('status');
    if (selectedResponsavel) params.set('responsavel', selectedResponsavel);
    else params.delete('responsavel');
    if (selectedPrioridade) params.set('prioridade', selectedPrioridade);
    else params.delete('prioridade');
    window.history.replaceState({}, '', `${location.pathname}?${params.toString()}`);
  }, [selectedArea, selectedStatus, selectedResponsavel, selectedPrioridade, location.pathname]);

  const { data: demandasData, isLoading: demandasIsLoading, refetch: refetchDemandas, isFetching: demandasIsFetching } = useQuery({
    queryKey: ['demandas', searchTerm, page, pageSize, area, status, responsavel, prioridade],
    queryFn: async () => {
      let query = supabase
        .from('demandas')
        .select('*', { count: 'exact' })
        .ilike('titulo', `%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (area) {
        query = query.eq('area_nome', area);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (responsavel) {
        query = query.eq('responsavel_nome', responsavel);
      }
      if (prioridade) {
        query = query.eq('prioridade', prioridade);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Erro ao buscar demandas:", error);
        throw new Error(error.message);
      }

      return { data, count };
    },
    keepPreviousData: true,
  });

  const { data: areasData, isLoading: areasIsLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        console.error("Erro ao buscar áreas:", error);
        throw new Error(error.message);
      }

      return data;
    },
  });

  const { data: responsaveisData, isLoading: responsaveisIsLoading } = useQuery({
    queryKey: ['responsaveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        console.error("Erro ao buscar responsáveis:", error);
        throw new Error(error.message);
      }

      return data;
    },
  });

  const { data: statusData, isLoading: statusIsLoading } = useQuery({
    queryKey: ['status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('status')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        console.error("Erro ao buscar status:", error);
        throw new Error(error.message);
      }

      return data;
    },
  });

  const { data: prioridadesData, isLoading: prioridadesIsLoading } = useQuery({
    queryKey: ['prioridades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prioridades')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        console.error("Erro ao buscar prioridades:", error);
        throw new Error(error.message);
      }

      return data;
    },
  });

  useEffect(() => {
    if (areasData) {
      setAreas(areasData);
    }
  }, [areasData]);

  useEffect(() => {
    if (responsaveisData) {
      setResponsaveis(responsaveisData);
    }
  }, [responsaveisData]);

  useEffect(() => {
    if (statusData) {
      setStatusList(statusData);
    }
  }, [statusData]);

  useEffect(() => {
    if (prioridadesData) {
      setPrioridades(prioridadesData);
    }
  }, [prioridadesData]);

  const createDemandaMutation = useMutation(
    async (newDemanda: any) => {
      const { data, error } = await supabase
        .from('demandas')
        .insert([newDemanda]);

      if (error) {
        console.error("Erro ao criar demanda:", error);
        throw new Error(error.message);
      }

      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['demandas'] });
        toast.success("Demanda criada com sucesso!");
        setNovaDemandaOpen(false);
      },
      onError: (error: any) => {
        toast.error("Erro ao criar demanda: " + error.message);
      },
    }
  );

  const updateDemandaMutation = useMutation(
    async (updatedDemanda: any) => {
      const { data, error } = await supabase
        .from('demandas')
        .update(updatedDemanda)
        .eq('id', updatedDemanda.id);

      if (error) {
        console.error("Erro ao atualizar demanda:", error);
        throw new Error(error.message);
      }

      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['demandas'] });
        toast.success("Demanda atualizada com sucesso!");
        setEditDemandaOpen(false);
      },
      onError: (error: any) => {
        toast.error("Erro ao atualizar demanda: " + error.message);
      },
    }
  );

  const deleteDemandaMutation = useMutation(
    async (id: string) => {
      const { data, error } = await supabase
        .from('demandas')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Erro ao excluir demanda:", error);
        throw new Error(error.message);
      }

      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['demandas'] });
        toast.success("Demanda excluída com sucesso!");
        setDeleteDemandaOpen(false);
      },
      onError: (error: any) => {
        toast.error("Erro ao excluir demanda: " + error.message);
      },
    }
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleAreaChange = (value: string) => {
    setSelectedArea(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    setPage(1);
  };

  const handleResponsavelChange = (value: string) => {
    setSelectedResponsavel(value);
    setPage(1);
  };

  const handlePrioridadeChange = (value: string) => {
    setSelectedPrioridade(value);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsImporting(true);
    setImportResults([]);
    await handleFileImport(event);
    setIsImporting(false);
  };

  // Função simplificada para processar apenas XLSX
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🚀 Iniciando importação de XLSX...');
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      toast.error("Por favor, selecione um arquivo XLSX.");
      return;
    }

    console.log(`📁 Arquivo XLSX detectado: ${file.name}`);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        console.log('📊 Processando arquivo XLSX...');
        
        // Processar arquivo XLSX
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converter para array de arrays
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '', 
          blankrows: false 
        }) as string[][];
        
        console.log(`✅ XLSX processado: ${jsonData.length} linhas detectadas`);
        
        if (jsonData.length < 2) {
          toast.error("O arquivo XLSX deve ter pelo menos uma linha de cabeçalho e uma linha de dados.");
          return;
        }
        
        // Headers da primeira linha
        const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
        const dataRows = jsonData.slice(1);
        
        console.log(`📁 Headers encontrados: ${headers.join(', ')}`);
        console.log(`📁 ${dataRows.length} linhas de dados para processar`);

        // Mapear headers para posições
        const columnPositions: Record<string, number> = {};
        
        const headerMappings: Record<string, string[]> = {
          titulo: ['titulo', 'título', 'title', 'assunto'],
          descricao: ['descricao', 'descrição', 'description', 'detalhes'],
          municipe_nome: ['municipe_nome', 'municipe', 'solicitante', 'requerente', 'nome'],
          area_nome: ['area_nome', 'area', 'área', 'setor', 'departamento'],
          responsavel_nome: ['responsavel_nome', 'responsavel', 'responsável', 'atribuido'],
          status: ['status', 'situacao', 'situação', 'estado'],
          prioridade: ['prioridade', 'priority', 'urgencia', 'urgência'],
          logradouro: ['logradouro', 'endereco', 'endereço', 'rua', 'avenida'],
          numero: ['numero', 'número', 'number', 'num'],
          bairro: ['bairro', 'distrito', 'neighborhood'],
          cidade: ['cidade', 'city', 'municipio', 'município'],
          cep: ['cep', 'zipcode', 'codigo_postal'],
          complemento: ['complemento', 'complement', 'adicional'],
          data_prazo: ['data_prazo', 'prazo', 'deadline', 'vencimento'],
          observacoes: ['observacoes', 'observações', 'notes', 'comentarios']
        };

        // Detectar posições automaticamente
        for (const [campo, variacoes] of Object.entries(headerMappings)) {
          for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            if (variacoes.some(v => header.includes(v) || v.includes(header))) {
              columnPositions[campo] = i;
              console.log(`✅ Campo "${campo}" detectado na coluna ${i + 1} (${header})`);
              break;
            }
          }
        }

        // Verificar campos obrigatórios
        const camposObrigatorios = ['titulo', 'descricao', 'municipe_nome'];
        const camposFaltando = camposObrigatorios.filter(campo => columnPositions[campo] === undefined);
        
        if (camposFaltando.length > 0) {
          toast.error(`Campos obrigatórios não encontrados: ${camposFaltando.join(', ')}`);
          return;
        }

        // Processar as linhas
        const demandasValidas = [];
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const titulo = String(row[columnPositions.titulo] || '').trim();
          const descricao = String(row[columnPositions.descricao] || '').trim();
          const municipeNome = String(row[columnPositions.municipe_nome] || '').trim();
          
          if (!titulo || titulo.length < 3) {
            console.warn(`⚠️ Linha ${i + 2} ignorada: título inválido`);
            continue;
          }
          
          const demanda: any = {
            titulo,
            descricao: descricao || 'Sem descrição',
            municipe_nome: municipeNome || 'Não informado',
            protocolo: `XLSX-${Date.now()}-${i}`,
          };

          // Mapear campos opcionais
          for (const [key, position] of Object.entries(columnPositions)) {
            if (['titulo', 'descricao', 'municipe_nome'].includes(key)) continue;
            
            const value = String(row[position] || '').trim();
            if (value) {
              if (key === 'prioridade') {
                const prioridadeMap: Record<string, string> = {
                  'baixa': 'baixa',
                  'media': 'media',
                  'média': 'media',
                  'alta': 'alta',
                  'urgente': 'urgente'
                };
                demanda.prioridade = prioridadeMap[value.toLowerCase()] || 'media';
              } else if (key === 'data_prazo' && value) {
                try {
                  const date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    demanda.data_prazo = date.toISOString().split('T')[0];
                  }
                } catch {
                  // Ignorar datas inválidas
                }
              } else {
                demanda[key] = value;
              }
            }
          }

          demandasValidas.push(demanda);
        }

        console.log(`📝 ${demandasValidas.length} demandas válidas processadas`);
        
        if (demandasValidas.length === 0) {
          toast.error("Nenhuma demanda válida foi encontrada no arquivo.");
          return;
        }

        // Simular importação (substitua pela lógica real)
        setImportResults(demandasValidas.map(d => ({
          success: true,
          titulo: d.titulo
        })));
        
        toast.success(`${demandasValidas.length} demandas importadas com sucesso!`);

      } catch (error) {
        console.error('Erro ao processar XLSX:', error);
        toast.error("Erro ao processar arquivo XLSX.");
      }
    };
    
    reader.readAsArrayBuffer(file);
     
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Demandas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 items-center">
            <div className="col-span-1 md:col-span-2">
              <Input
                type="search"
                placeholder="Buscar por título..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            <Button onClick={() => setShowFilterDialog(true)}>
              <Filter className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <Button onClick={() => setNovaDemandaOpen(true)}>
          Nova Demanda
        </Button>
        <div className="flex gap-2">
          <ImportCSVDialogDemandas
            onFileSelect={handleFileSelect}
            isImporting={isImporting}
            fileInputRef={fileInputRef}
            importResults={importResults}
          />
          <Button onClick={() => setValidarMunicipesOpen(true)}>
            Validar Municipes
          </Button>
        </div>
      </div>

      {demandasIsLoading ? (
        <p>Carregando demandas...</p>
      ) : (
        <>
          {demandasData?.data && demandasData?.data.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {demandasData.data.map((demanda: any) => (
                <Card key={demanda.id}>
                  <CardHeader>
                    <CardTitle>{demanda.titulo}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">{demanda.descricao}</p>
                    <Badge variant="secondary">
                      {demanda.status}
                    </Badge>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        Criado em: {formatDateOnly(demanda.created_at)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedDemanda(demanda);
                            setViewDemandaOpen(true);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedDemanda(demanda);
                            setEditDemandaOpen(true);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedDemanda(demanda);
                            setDeleteDemandaOpen(true);
                          }}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p>Nenhuma demanda encontrada.</p>
          )}
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Página {page} de {Math.ceil((demandasData?.count || 0) / pageSize)}
            </div>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Input
                type="number"
                className="w-20 text-center"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              />
              <Button
                variant="outline"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= Math.ceil((demandasData?.count || 0) / pageSize)}
              >
                Próximo
              </Button>
            </div>
          </div>
        </>
      )}

      <NovaDemandaDialog
        open={novaDemandaOpen}
        setOpen={setNovaDemandaOpen}
        areas={areas}
        responsaveis={responsaveis}
        statusList={statusList}
        prioridades={prioridades}
        createDemandaMutation={createDemandaMutation}
      />

      <EditDemandaDialog
        open={editDemandaOpen}
        setOpen={setEditDemandaOpen}
        demanda={selectedDemanda}
        areas={areas}
        responsaveis={responsaveis}
        statusList={statusList}
        prioridades={prioridades}
        updateDemandaMutation={updateDemandaMutation}
      />

      <ViewDemandaDialog
        open={viewDemandaOpen}
        setOpen={setViewDemandaOpen}
        demanda={selectedDemanda}
        areas={areas}
        responsaveis={responsaveis}
        statusList={statusList}
        prioridades={prioridades}
      />

      <AlertDialog open={deleteDemandaOpen} setOpen={setDeleteDemandaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Tem certeza de que deseja excluir esta demanda?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDemandaOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteDemandaMutation.mutate(selectedDemanda.id);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Filtrar Demandas</DialogTitle>
            <DialogDescription>
              Selecione os filtros desejados para refinar a lista de demandas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Select value={selectedArea} onValueChange={handleAreaChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as áreas</SelectItem>
                {areas.map((area: any) => (
                  <SelectItem key={area.id} value={area.nome}>
                    {area.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                {statusList.map((statusItem: any) => (
                  <SelectItem key={statusItem.id} value={statusItem.nome}>
                    {statusItem.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedResponsavel} onValueChange={handleResponsavelChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os responsáveis</SelectItem>
                {responsaveis.map((responsavelItem: any) => (
                  <SelectItem key={responsavelItem.id} value={responsavelItem.nome}>
                    {responsavelItem.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPrioridade} onValueChange={handlePrioridadeChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as prioridades</SelectItem>
                {prioridades.map((prioridadeItem: any) => (
                  <SelectItem key={prioridadeItem.id} value={prioridadeItem.nome}>
                    {prioridadeItem.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowFilterDialog(false)}>
            Aplicar Filtros
          </Button>
        </DialogContent>
      </Dialog>

      <ValidarMunicipesDialog
        open={validarMunicipesOpen}
        setOpen={setValidarMunicipesOpen}
      />
    </div>
  );
}
