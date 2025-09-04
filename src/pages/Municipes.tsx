import { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Download, Upload, MoreHorizontal, Mail, Phone, MapPin } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NovoMunicipeDialog } from "@/components/forms/NovoMunicipeDialog";
import { ImportCSVDialog } from "@/components/forms/ImportCSVDialog";
import { EditMunicipeDialog } from "@/components/forms/EditMunicipeDialog";
import { MunicipeDetailsDialog } from "@/components/forms/MunicipeDetailsDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateOnly } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";

export default function Municipes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [bairroFilter, setBairroFilter] = useState("all");
  const [cidadeFilter, setCidadeFilter] = useState("all");
  const [selectedMunicipe, setSelectedMunicipe] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [municipeToEdit, setMunicipeToEdit] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResults, setImportResults] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar munícipes com suas tags
  const { data: municipes = [], isLoading } = useQuery({
    queryKey: ['municipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select(`
          *,
          municipe_tags(
            tags(
              id,
              nome,
              cor
            )
          )
        `)
        .order('nome');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Buscar cidades únicas para o filtro
  const { data: cidades = [] } = useQuery({
    queryKey: ['cidades-municipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select('cidade')
        .not('cidade', 'is', null)
        .order('cidade');
      
      if (error) throw error;
      
      // Extrair cidades únicas
      const cidadesUnicas = [...new Set(data.map(item => item.cidade))];
      return cidadesUnicas.filter(Boolean).sort();
    }
  });

  // Buscar bairros únicos para o filtro
  const { data: bairros = [] } = useQuery({
    queryKey: ['bairros-municipes'], 
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipes')
        .select('bairro')
        .not('bairro', 'is', null)
        .order('bairro');
      
      if (error) throw error;
      
      // Extrair bairros únicos
      const bairrosUnicos = [...new Set(data.map(item => item.bairro))];
      return bairrosUnicos.filter(Boolean).sort();
    }
  });

  // Buscar tags para os filtros
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  const filteredMunicipes = municipes.filter(municipe => {
    const matchesSearch = !searchTerm || 
      municipe.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      municipe.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      municipe.telefone?.includes(searchTerm);
    
    const matchesTag = tagFilter === "all" || 
      (municipe.municipe_tags && municipe.municipe_tags.some((mt: any) => mt.tags?.id === tagFilter));
    
    const matchesBairro = bairroFilter === "all" || 
      municipe.bairro?.toLowerCase() === bairroFilter.toLowerCase();

    const matchesCidade = cidadeFilter === "all" ||
      municipe.cidade?.toLowerCase() === cidadeFilter.toLowerCase();
    
    return matchesSearch && matchesTag && matchesBairro && matchesCidade;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setTagFilter("all");
    setBairroFilter("all");
    setCidadeFilter("all");
  };

  // Função para exportar CSV
  const exportToCSV = () => {
    const headers = [
      'nome',
      'telefone', 
      'email',
      'logradouro',
      'numero',
      'bairro',
      'cidade',
      'cep',
      'complemento',
      'data_nascimento',
      'observacoes'
    ];

        const csvData = filteredMunicipes.map(municipe => [
          municipe.nome || '',
          municipe.telefone || '',
          municipe.email || '',
          municipe.endereco?.split(' - ')[0] || '', // logradouro
          '', // numero (extrair do endereço seria complexo)
          municipe.bairro || '',
          municipe.cidade || '',
          municipe.cep || '',
          '', // complemento
          municipe.data_nascimento ? formatDateOnly(municipe.data_nascimento) : '',
          municipe.observacoes || ''
        ]);

        // Usar ponto e vírgula como separador para melhor compatibilidade
        const csvContent = [
          headers.join(';'),
          ...csvData.map(row => 
            row.map(field => {
              const escaped = field.toString().replace(/"/g, '""');
              return `"${escaped}"`;
            }).join(';')
          )
        ].join('\r\n');

        // Adicionar BOM para UTF-8
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { 
          type: 'text/csv;charset=utf-8;' 
        });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `municipes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV exportado com sucesso!",
      description: `${filteredMunicipes.length} munícipes exportados.`
    });
  };

  // Função para processar CSV importado
  const importMunicipes = useMutation({
    mutationFn: async (municipes: any[]) => {
      const results = [];
      
      for (const municipe of municipes) {
        try {
          // Montar endereço completo
          let endereco = '';
          if (municipe.logradouro) {
            endereco = municipe.logradouro;
            if (municipe.numero) endereco += `, ${municipe.numero}`;
            if (municipe.complemento) endereco += ` - ${municipe.complemento}`;
          }

          const { data, error } = await supabase
            .from('municipes')
            .insert({
              nome: municipe.nome,
              telefone: municipe.telefone || null,
              email: municipe.email || null,
              endereco: endereco || null,
              bairro: municipe.bairro || null,
              cidade: municipe.cidade || 'São Paulo',
              cep: municipe.cep || null,
              data_nascimento: municipe.data_nascimento || null,
              observacoes: municipe.observacoes || null
            })
            .select('id')
            .single();

          if (error) {
            results.push({ success: false, nome: municipe.nome, error: error.message });
          } else {
            results.push({ success: true, nome: municipe.nome, id: data.id });
          }
        } catch (err) {
          results.push({ success: false, nome: municipe.nome, error: 'Erro inesperado' });
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      setImportResults(results);
      queryClient.invalidateQueries({ queryKey: ['municipes'] });
      
      // Não usar toast aqui - mostrar no modal
      console.log(`✅ Importação concluída: ${successCount} sucessos, ${errorCount} erros`);
    },
    onError: (error) => {
      setImportResults([{ success: false, nome: 'Erro', error: error.message }]);
      console.error('❌ Erro na importação:', error);
    }
  });

  // Função para processar arquivo CSV
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📄 handleFileImport chamado:', event);
    const file = event.target.files?.[0];
    console.log('📄 Arquivo selecionado:', file);
    if (!file) {
      console.log('❌ Nenhum arquivo selecionado');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo CSV.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast({
            title: "Arquivo vazio",
            description: "O arquivo CSV está vazio ou não possui dados válidos.",
            variant: "destructive"
          });
          return;
        }

        // Processar header - aceitar tanto vírgula quanto ponto e vírgula
        const separator = csv.includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.replace(/"/g, '').trim().toLowerCase());
        
        // Mapear colunas esperadas
        const expectedColumns = {
          nome: ['nome', 'nome completo', 'name'],
          telefone: ['telefone', 'phone', 'celular'],
          email: ['email', 'e-mail', 'mail'],
          logradouro: ['logradouro', 'endereco', 'endereço', 'address', 'rua'],
          numero: ['numero', 'número', 'number'],
          bairro: ['bairro', 'neighborhood'],
          cidade: ['cidade', 'city'],
          cep: ['cep', 'zip', 'zipcode'],
          complemento: ['complemento', 'complement'],
          data_nascimento: ['data_nascimento', 'data de nascimento', 'nascimento', 'birth_date'],
          observacoes: ['observacoes', 'observações', 'notes', 'obs']
        };

        // Processar dados
        const municipes = lines.slice(1).map(line => {
          const values = line.split(separator).map(v => v.replace(/"/g, '').trim());
          const municipe: any = {};

          Object.keys(expectedColumns).forEach(key => {
            const possibleHeaders = expectedColumns[key as keyof typeof expectedColumns];
            const headerIndex = headers.findIndex(h => possibleHeaders.includes(h));
            
            if (headerIndex !== -1 && values[headerIndex]) {
              if (key === 'data_nascimento') {
                // Tentar converter data
                const dateValue = values[headerIndex];
                if (dateValue && dateValue !== '') {
                  try {
                    const date = new Date(dateValue);
                    if (!isNaN(date.getTime())) {
                      municipe[key] = date.toISOString().split('T')[0];
                    }
                  } catch {
                    // Ignorar datas inválidas
                  }
                }
              } else {
                municipe[key] = values[headerIndex];
              }
            }
          });

          return municipe;
        }).filter(m => m.nome && m.nome.trim() !== ''); // Só importar se tiver nome

        if (municipes.length === 0) {
          toast({
            title: "Nenhum dado válido",
            description: "Não foram encontrados munícipes válidos no arquivo. Certifique-se de que há uma coluna 'nome'.",
            variant: "destructive"
          });
          return;
        }

        // Limpar resultados anteriores antes de nova importação
        setImportResults([]);
        importMunicipes.mutate(municipes);
      } catch (error) {
        toast({
          title: "Erro ao processar arquivo",
          description: "Erro ao ler o arquivo CSV. Verifique se o formato está correto.",
          variant: "destructive"
        });
      }
    };
    
    reader.readAsText(file, 'UTF-8');
    
    // Limpar input para permitir re-upload do mesmo arquivo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Função para excluir munícipe
  const deleteMunicipe = useMutation({
    mutationFn: async (municipeId: string) => {
      console.log('Iniciando exclusão do munícipe:', municipeId);
      
      // Primeiro, remover todas as tags associadas ao munícipe
      const { error: tagDeleteError } = await supabase
        .from('municipe_tags')
        .delete()
        .eq('municipe_id', municipeId);
      
      if (tagDeleteError) {
        console.error('Erro ao remover tags:', tagDeleteError);
      } else {
        console.log('Tags removidas com sucesso');
      }
      
      // Depois, excluir o munícipe
      const { error, data } = await supabase
        .from('municipes')
        .delete()
        .eq('id', municipeId)
        .select();

      console.log('Resultado da exclusão:', { error, data });
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Munícipe excluído com sucesso!",
        description: "O munícipe foi removido do sistema."
      });
      queryClient.invalidateQueries({ queryKey: ['municipes'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir munícipe",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleViewDetails = (municipe: any) => {
    setSelectedMunicipe(municipe);
    setShowDetails(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Munícipes
            </h1>
            <p className="text-base text-muted-foreground lg:text-lg">
              Gerencie o cadastro de munícipes e suas informações
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <ImportCSVDialog 
              onFileSelect={handleFileImport}
              isImporting={importMunicipes.isPending}
              fileInputRef={fileInputRef}
              importResults={importResults}
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={exportToCSV}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <NovoMunicipeDialog />
          </div>
        </div>

        {/* Filtros */}
        <Card className="shadow-sm border-0 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, email ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Tag
                </label>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as tags</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: tag.cor }}
                          />
                          {tag.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Bairro
                </label>
                <Select value={bairroFilter} onValueChange={setBairroFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os bairros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os bairros</SelectItem>
                    {bairros.map((bairro) => (
                      <SelectItem key={bairro} value={bairro.toLowerCase()}>
                        {bairro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Cidade
                </label>
                <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as cidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as cidades</SelectItem>
                    {cidades.map((cidade) => (
                      <SelectItem key={cidade} value={cidade.toLowerCase()}>
                        {cidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={clearFilters}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-sm border-0 bg-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total de Munícipes</p>
                  <p className="text-2xl font-bold text-foreground">{municipes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0 bg-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Resultado da Busca</p>
                  <p className="text-2xl font-bold text-foreground">{filteredMunicipes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Munícipes */}
        <Card className="shadow-sm border-0 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Lista de Munícipes</span>
              <span className="text-sm font-normal text-muted-foreground">
                {isLoading ? 'Carregando...' : `${filteredMunicipes.length} munícipes`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Munícipe</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        Carregando munícipes...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredMunicipes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum munícipe encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMunicipes.map((municipe) => (
                    <TableRow key={municipe.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{municipe.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {municipe.data_nascimento && `Nascimento: ${formatDateOnly(municipe.data_nascimento)}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm text-foreground">
                            <Mail className="h-3 w-3" />
                            {municipe.email || 'Não informado'}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-foreground">
                            <Phone className="h-3 w-3" />
                            {municipe.telefone || 'Não informado'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <p>{municipe.endereco || 'Endereço não informado'}</p>
                            {municipe.bairro && (
                              <p className="text-xs">{municipe.bairro}, {municipe.cidade}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {municipe.municipe_tags && municipe.municipe_tags.length > 0 ? (
                            municipe.municipe_tags.map((mt: any) => (
                              mt.tags && (
                                <Badge 
                                  key={mt.tags.id} 
                                  variant="secondary" 
                                  className="text-xs"
                                  style={{ 
                                    backgroundColor: `${mt.tags.cor}20`,
                                    borderColor: mt.tags.cor,
                                    color: mt.tags.cor
                                  }}
                                >
                                  {mt.tags.nome}
                                </Badge>
                              )
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem tags</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              console.log('Ver detalhes clicado para:', municipe.nome);
                              handleViewDetails(municipe);
                            }}>
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.preventDefault();
                              console.log('Editar clicado para:', municipe.nome);
                              setMunicipeToEdit(municipe);
                              setShowEditDialog(true);
                            }}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.preventDefault();
                              console.log('Excluir clicado para:', municipe.nome);
                              if (window.confirm(`Tem certeza que deseja excluir o munícipe "${municipe.nome}"?`)) {
                                deleteMunicipe.mutate(municipe.id);
                              }
                            }}>
                              <span className="text-destructive">Excluir</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dialog de Detalhes */}
        <MunicipeDetailsDialog
          municipe={selectedMunicipe}
          open={showDetails}
          onOpenChange={setShowDetails}
        />

        {/* Dialog de Edição */}
        <EditMunicipeDialog
          municipe={municipeToEdit}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      </div>
    </div>
  );
}