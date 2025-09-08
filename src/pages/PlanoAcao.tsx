import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2, Download, Plus, Calendar as CalendarIcon, CheckCircle, Target, GripVertical, GripHorizontal, Upload, Save, Maximize, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { NovaAcaoDialog } from "@/components/forms/NovaAcaoDialog";
import { EditAcaoDialog } from "@/components/forms/EditAcaoDialog";
import { EixosManagerDialog } from "@/components/forms/EixosManagerDialog";
import { TemasManagerDialog } from "@/components/forms/TemasManagerDialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ImportCSVDialogPlanoAcao } from "@/components/forms/ImportCSVDialogPlanoAcao";
import { PlanoAcaoTable } from "@/components/PlanoAcaoTable";

export default function PlanoAcao() {
  const [searchTerm, setSearchTerm] = useState("");
  const [eixoFilter, setEixoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");
  const [temaFilter, setTemaFilter] = useState("all");
  const [concluidaFilter, setConcluidaFilter] = useState("all");
  const [isNewActionDialogOpen, setIsNewActionDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showEixosManager, setShowEixosManager] = useState(false);
  const [showTemasManager, setShowTemasManager] = useState(false);
  const [editingCell, setEditingCell] = useState<{actionId: string, field: string} | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [insertPosition, setInsertPosition] = useState<number | null>(null);
  
  // Estados para importação CSV
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para larguras das colunas
  const [columnWidths, setColumnWidths] = useState({
    eixo: 120,
    prioridade: 100,
    tema: 150,
    acao: 320,
    responsavel: 150,
    apoio: 200,
    status: 120,
    prazo: 120,
    atualizacao: 320,
    excluir: 80
  });
  
  const [tableHeight, setTableHeight] = useState(600);
  const [isMaximized, setIsMaximized] = useState(false);
  
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Carregar layout salvo ao inicializar
  useEffect(() => {
    const savedLayout = localStorage.getItem('plano-acao-layout');
    if (savedLayout) {
      try {
        const layout = JSON.parse(savedLayout);
        if (layout.columnWidths) {
          setColumnWidths(layout.columnWidths);
        }
        if (layout.tableHeight) {
          setTableHeight(layout.tableHeight);
        }
      } catch (error) {
        console.error('Erro ao carregar layout salvo:', error);
      }
    }
  }, []);

  // Função para salvar layout
  const saveLayout = () => {
    const layout = {
      columnWidths,
      tableHeight,
      savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('plano-acao-layout', JSON.stringify(layout));
    toast.success('Layout salvo com sucesso!');
  };

  const queryClient = useQueryClient();

  // Queries para dados
  const { data: planosAcao = [], isLoading, error } = useQuery({
    queryKey: ['planos-acao'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('planos_acao')
          .select(`
            *,
            eixos(nome, cor),
            prioridades_acao(nome, nivel, cor),
            temas_acao(nome),
            status_acao(nome, cor),
            responsavel:profiles!responsavel_id(nome),
            criador:profiles!created_by(nome)
          `)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Erro ao carregar planos:', err);
        throw err;
      }
    },
    retry: 1,
    staleTime: 30000
  });

  const { data: eixos = [] } = useQuery({
    queryKey: ['eixos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eixos').select('*').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: temas = [] } = useQuery({
    queryKey: ['temas-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('temas_acao').select('*, eixos(nome)').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: prioridades = [] } = useQuery({
    queryKey: ['prioridades-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('prioridades_acao').select('*').order('nivel');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: statusAcao = [] } = useQuery({
    queryKey: ['status-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('status_acao').select('*').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-plano'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  // Mutations
  const createAction = useMutation({
    mutationFn: async (newAction: any) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('planos_acao')
        .insert({
          ...newAction,
          created_by: user.user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      toast.success('Ação criada com sucesso!');
      setIsNewActionDialogOpen(false);
      setInsertPosition(null);
    },
    onError: (error) => {
      toast.error('Erro ao criar ação');
      console.error('Erro:', error);
    }
  });

  const updateAction = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { data, error } = await supabase
        .from('planos_acao')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      toast.success('Ação atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar ação');
      console.error('Erro:', error);
    }
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('planos_acao')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      toast.success('Ação excluída com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir ação');
      console.error('Erro:', error);
    }
  });

  // Função para importação CSV
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error("Por favor, selecione um arquivo CSV.");
      return;
    }

    setIsImporting(true);
    setImportResults([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csv = e.target?.result as string;
        
        // Parser CSV mais robusto para lidar com aspas e quebras de linha
        function parseCSVLine(line: string, separator: string): string[] {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          let quoteChar = '';
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (!inQuotes && (char === '"' || char === "'")) {
              inQuotes = true;
              quoteChar = char;
            } else if (inQuotes && char === quoteChar) {
              if (nextChar === quoteChar) {
                current += char;
                i++; // Skip next quote
              } else {
                inQuotes = false;
                quoteChar = '';
              }
            } else if (!inQuotes && char === separator) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current.trim());
          return result;
        }

        // Primeiro passo: dividir linhas respeitando aspas
        const rawLines = [];
        let currentLine = '';
        let insideQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < csv.length; i++) {
          const char = csv[i];
          const nextChar = csv[i + 1];
          
          if ((char === '"' || char === "'") && !insideQuotes) {
            insideQuotes = true;
            quoteChar = char;
            currentLine += char;
          } else if (char === quoteChar && insideQuotes) {
            if (nextChar === quoteChar) {
              currentLine += char + nextChar;
              i++;
            } else {
              insideQuotes = false;
              quoteChar = '';
              currentLine += char;
            }
          } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (currentLine.trim()) {
              rawLines.push(currentLine.trim());
            }
            currentLine = '';
            if (char === '\r' && nextChar === '\n') {
              i++;
            }
          } else {
            currentLine += char;
          }
        }
        
        if (currentLine.trim()) {
          rawLines.push(currentLine.trim());
        }

        // Filtrar linhas vazias ou inválidas
        const lines = rawLines.filter(line => {
          const trimmed = line.trim();
          if (!trimmed) return false;
          
          // Verificar se tem pelo menos um separador válido
          const hasSeparator = trimmed.includes(';') || trimmed.includes(',');
          if (!hasSeparator) {
            console.warn(`⚠️ Linha descartada (sem separador): "${trimmed.substring(0, 50)}..."`);
            return false;
          }
          
          return true;
        });
        
        console.log(`📁 Total de linhas válidas encontradas: ${lines.length - 1} (excluindo header)`);
        
        if (lines.length < 2) {
          toast.error("O arquivo CSV está vazio ou não possui dados válidos.");
          setIsImporting(false);
          return;
        }

        // Detectar separador mais preciso
        const firstLine = lines[0];
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const separator = semicolonCount >= commaCount ? ';' : ',';
        
        // Usar parser robusto para o header
        const headers = parseCSVLine(firstLine, separator).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
        
        console.log(`📋 Headers encontrados: ${headers.join(', ')}`);
        console.log(`📋 Separador detectado: "${separator}"`);
        console.log(`📋 Total de colunas no header: ${headers.length}`);
        
        const expectedHeaders = ['acao', 'eixo', 'prioridade', 'tema', 'responsavel', 'apoio', 'status', 'prazo', 'atualizacao'];
        const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          toast.error(`Headers obrigatórios não encontrados: ${missingHeaders.join(', ')}`);
          setIsImporting(false);
          return;
        }

        const { data: user } = await supabase.auth.getUser();
        if (!user.user) {
          toast.error('Usuário não autenticado');
          setIsImporting(false);
          return;
        }

        const results = [];
        
        // Processar cada linha usando o parser robusto
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i], separator).map(v => v.replace(/^["']|["']$/g, '').trim());
          const row: any = {};
          
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });

          if (!row.acao?.trim()) {
            results.push({
              success: false,
              acao: row.acao || `Linha ${i + 1}`,
              error: 'Campo "acao" é obrigatório'
            });
            continue;
          }

          try {
          // Buscar IDs das referências
          let eixo_id = null;
          if (row.eixo?.trim()) {
            const eixo = eixos.find(e => e.nome.toLowerCase() === row.eixo.toLowerCase().trim());
            eixo_id = eixo?.id || null;
          }

          let prioridade_id = null;
          if (row.prioridade?.trim()) {
            const prioridade = prioridades.find(p => p.nome.toLowerCase() === row.prioridade.toLowerCase().trim());
            prioridade_id = prioridade?.id || null;
          }

          let tema_id = null;
          if (row.tema?.trim()) {
            const tema = temas.find(t => t.nome.toLowerCase() === row.tema.toLowerCase().trim());
            tema_id = tema?.id || null;
          }

          let status_id = null;
          if (row.status?.trim()) {
            const status = statusAcao.find(s => s.nome.toLowerCase() === row.status.toLowerCase().trim());
            status_id = status?.id || null;
          }

          let responsavel_id = null;
          if (row.responsavel?.trim()) {
            const responsavel = usuarios.find(u => u.nome.toLowerCase() === row.responsavel.toLowerCase().trim());
            responsavel_id = responsavel?.id || null;
          }

          // Processar data
          let prazoDate = null;
          if (row.prazo?.trim()) {
            const dateFormats = [
              /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
              /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
            ];
            
            if (dateFormats[0].test(row.prazo)) {
              const [day, month, year] = row.prazo.split('/');
              prazoDate = `${year}-${month}-${day}`;
            } else if (dateFormats[1].test(row.prazo)) {
              prazoDate = row.prazo;
            }
          }

          const { error } = await supabase
            .from('planos_acao')
            .insert({
              acao: row.acao.trim(),
              eixo_id,
              prioridade_id,
              tema_id,
              responsavel_id,
              apoio: row.apoio?.trim() || null,
              status_id,
              prazo: prazoDate,
              atualizacao: row.atualizacao?.trim() || null,
              concluida: false,
              created_by: user.user.id
            });

          if (error) {
            results.push({
              success: false,
              acao: row.acao,
              error: error.message
            });
          } else {
            results.push({
              success: true,
              acao: row.acao
            });
          }
        } catch (err) {
          results.push({
            success: false,
            acao: row.acao,
            error: err instanceof Error ? err.message : 'Erro inesperado'
          });
        }
      }

        setImportResults(results);
        queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
        
        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;
        
        if (errorCount === 0) {
          toast.success(`${successCount} ações importadas com sucesso!`);
        } else if (successCount > 0) {
          toast.warning(`${successCount} ações importadas. ${errorCount} erros encontrados.`);
        } else {
          toast.error("Nenhuma ação foi importada devido a erros.");
        }
      } catch (error) {
        toast.error(`Erro na importação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        console.error('Erro na importação:', error);
      } finally {
        setIsImporting(false);
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  // Função para reorganizar ações
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    // Lógica de reorganização pode ser implementada aqui
  };

  // Função para inserir nova ação em posição específica
  const handleInsertAction = (position: number) => {
    setInsertPosition(position);
    setIsNewActionDialogOpen(true);
  };

  // Componente para inserção entre linhas
  const InsertRow = ({ index }: { index: number }) => (
    <tr 
      className="group cursor-pointer hover:bg-muted/50 transition-colors"
      onMouseEnter={() => setHoveredRowIndex(index)}
      onMouseLeave={() => setHoveredRowIndex(null)}
      onClick={() => handleInsertAction(index)}
    >
      <td colSpan={12} className="p-2 text-center">
        <div className={cn(
          "flex items-center justify-center gap-2 text-muted-foreground transition-all duration-200",
          hoveredRowIndex === index ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Adicionar nova ação aqui</span>
        </div>
      </td>
    </tr>
  );

  // Filtros aplicados com memoização para performance
  const filteredActions = useMemo(() => {
    if (!planosAcao) return [];
    
    return planosAcao.filter((action) => {
      const matchesSearch = !searchTerm || 
        action.acao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        action.eixos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        action.temas_acao?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        action.apoio?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesEixo = eixoFilter === "all" || action.eixo_id === eixoFilter;
      const matchesStatus = statusFilter === "all" || action.status_id === statusFilter;
      const matchesResponsavel = responsavelFilter === "all" || action.responsavel_id === responsavelFilter;
      const matchesPrioridade = prioridadeFilter === "all" || action.prioridade_id === prioridadeFilter;
      const matchesTema = temaFilter === "all" || action.tema_id === temaFilter;
      const matchesConcluida = concluidaFilter === "all" || 
        (concluidaFilter === "true" && action.concluida) || 
        (concluidaFilter === "false" && !action.concluida);

      return matchesSearch && matchesEixo && matchesStatus && matchesResponsavel && matchesPrioridade && matchesTema && matchesConcluida;
    });
  }, [planosAcao, searchTerm, eixoFilter, statusFilter, responsavelFilter, prioridadeFilter, temaFilter, concluidaFilter]);

  // Calcular estatísticas
  const totalAcoes = filteredActions.length;
  const acoesConcluidas = filteredActions.filter(a => a.concluida).length;
  const percentualConcluido = totalAcoes > 0 ? Math.round((acoesConcluidas / totalAcoes) * 100) : 0;

  // Funções auxiliares otimizadas com useCallback
  const handleToggleConcluida = useCallback((action: any) => {
    updateAction.mutate({
      id: action.id,
      updates: { concluida: !action.concluida }
    });
  }, [updateAction]);

  const handleQuickEdit = useCallback((action: any, field: string, value: any) => {
    const finalValue = field === 'responsavel_id' && value === 'none' ? null : value;
    
    updateAction.mutate({
      id: action.id,
      updates: { [field]: finalValue }
    });
  }, [updateAction]);

  const handleCellEdit = useCallback((actionId: string, field: string, currentValue: string) => {
    setEditingCell({ actionId, field });
    setEditingValue(currentValue || '');
  }, []);

  const handleCellSave = useCallback(() => {
    if (editingCell) {
      const action = filteredActions.find(a => a.id === editingCell.actionId);
      if (action) {
        handleQuickEdit(action, editingCell.field, editingValue);
      }
      setEditingCell(null);
      setEditingValue('');
    }
  }, [editingCell, editingValue, filteredActions, handleQuickEdit]);

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
    setEditingValue('');
  }, []);

  // Funções para redimensionamento de colunas
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    e.preventDefault();
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(50, Math.min(800, startWidth + deltaX)); // Min 50px, Max 800px
    
    setColumnWidths(prev => ({
      ...prev,
      [isResizing]: newWidth
    }));
  }, [isResizing, startX, startWidth]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(null);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleResizeMove]);

  const handleResizeStart = (columnName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(columnName);
    setStartX(e.clientX);
    setStartWidth(columnWidths[columnName as keyof typeof columnWidths]);
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  // Cleanup dos event listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeEnd]);

  const exportToCSV = () => {
    const headers = [
      'Eixo', 'Prioridade', 'Tema', 'Ação', 'Responsável', 
      'Apoio', 'Status', 'Prazo', 'Atualização', 'Concluída'
    ];

    const csvData = filteredActions.map(action => [
      action.eixos?.nome || '',
      action.prioridades_acao?.nome || '',
      action.temas_acao?.nome || '',
      action.acao || '',
      action.responsavel?.nome || '',
      action.apoio || '',
      action.status_acao?.nome || '',
      action.prazo ? format(new Date(action.prazo), 'dd/MM/yyyy') : '',
      action.atualizacao || '',
      action.concluida ? 'Sim' : 'Não'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `plano_acao_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    toast.success('Arquivo CSV exportado com sucesso!');
  };

  // Se há erro, mostrar mensagem de erro
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold text-destructive mb-2">Erro ao carregar dados</h2>
            <p className="text-muted-foreground mb-4">{(error as Error)?.message || 'Erro desconhecido'}</p>
            <Button onClick={() => window.location.reload()}>
              Recarregar Página
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-8 w-8" />
            Plano de Ação
          </h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe as ações estratégicas do gabinete
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEixosManager(true)}>
            Gerenciar Eixos
          </Button>
          <Button variant="outline" onClick={() => setShowTemasManager(true)}>
            Gerenciar Temas
          </Button>
          <ImportCSVDialogPlanoAcao
            onFileSelect={handleFileSelect}
            isImporting={isImporting}
            fileInputRef={fileInputRef}
            importResults={importResults}
          >
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
          </ImportCSVDialogPlanoAcao>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Maximize className="h-4 w-4 mr-2" />
                Maximizar Planilha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[98vw] max-h-[98vh] h-[98vh] w-[98vw] p-0 flex flex-col">
              <DialogHeader className="p-6 pb-2 border-b flex-shrink-0">
                <div className="flex items-start justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <Target className="h-6 w-6" />
                    Plano de Ação - Visualização Maximizada
                  </DialogTitle>
                  <div className="mt-1 mr-8">
                    <Button
                      onClick={saveLayout}
                      variant="outline"
                      size="sm"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Layout
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              
              {/* Filtros no modal maximizado */}
              <div className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar ações..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                  </div>

                  <Select value={eixoFilter} onValueChange={setEixoFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar por eixo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os eixos</SelectItem>
                      {eixos.map((eixo) => (
                        <SelectItem key={eixo.id} value={eixo.id}>
                          {eixo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {statusAcao.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar por responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os responsáveis</SelectItem>
                      {usuarios.map((usuario) => (
                        <SelectItem key={usuario.id} value={usuario.id}>
                          {usuario.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar por prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as prioridades</SelectItem>
                      {prioridades.map((prioridade) => (
                        <SelectItem key={prioridade.id} value={prioridade.id}>
                          {prioridade.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={temaFilter} onValueChange={setTemaFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar por tema" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os temas</SelectItem>
                      {temas.map((tema) => (
                        <SelectItem key={tema.id} value={tema.id}>
                          {tema.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={concluidaFilter} onValueChange={setConcluidaFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar por situação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="true">Concluídas</SelectItem>
                      <SelectItem value="false">Pendentes</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setSearchTerm('');
                      setEixoFilter('all');
                      setStatusFilter('all');
                      setResponsavelFilter('all');
                      setPrioridadeFilter('all');
                      setTemaFilter('all');
                      setConcluidaFilter('all');
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </Button>
                </div>
              </div>
              
              {/* Container principal da planilha no modal - mesma estrutura da planilha normal */}
              <div 
                className="planilha-container"
                style={{ 
                  flexGrow: 1,
                  height: 'calc(98vh - 200px)',
                  margin: '16px'
                }}
              >
                <PlanoAcaoTable
                  filteredActions={filteredActions}
                  isLoading={isLoading}
                  columnWidths={columnWidths}
                  editingCell={editingCell}
                  editingValue={editingValue}
                  hoveredRowIndex={hoveredRowIndex}
                  eixos={eixos}
                  prioridades={prioridades}
                  temas={temas}
                  statusAcao={statusAcao}
                  usuarios={usuarios}
                  handleDragEnd={handleDragEnd}
                  handleToggleConcluida={handleToggleConcluida}
                  handleQuickEdit={handleQuickEdit}
                  handleCellEdit={handleCellEdit}
                  handleCellSave={handleCellSave}
                  handleCellCancel={handleCellCancel}
                  setEditingValue={setEditingValue}
                  setHoveredRowIndex={setHoveredRowIndex}
                  handleInsertAction={handleInsertAction}
                  deleteAction={deleteAction}
                  updateAction={updateAction}
                  handleResizeStart={handleResizeStart}
                  isMaximized={true}
                />
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => setIsNewActionDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Ação
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Total de Ações</p>
                <p className="text-2xl font-bold">{totalAcoes}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold text-green-600">{acoesConcluidas}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-blue-600">{totalAcoes - acoesConcluidas}</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">% Progresso</p>
                <p className="text-2xl font-bold text-primary">{percentualConcluido}%</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{percentualConcluido}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={eixoFilter} onValueChange={setEixoFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por eixo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eixos</SelectItem>
                {eixos.map((eixo) => (
                  <SelectItem key={eixo.id} value={eixo.id}>
                    {eixo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusAcao.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {usuarios.map((usuario) => (
                  <SelectItem key={usuario.id} value={usuario.id}>
                    {usuario.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                {prioridades.map((prioridade) => (
                  <SelectItem key={prioridade.id} value={prioridade.id}>
                    {prioridade.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={temaFilter} onValueChange={setTemaFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os temas</SelectItem>
                {temas.map((tema) => (
                  <SelectItem key={tema.id} value={tema.id}>
                    {tema.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={concluidaFilter} onValueChange={setConcluidaFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="true">Concluídas</SelectItem>
                <SelectItem value="false">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela com Scroll contido no Card */}
      <Card>
        <CardContent className="p-0">
          {/* Controles de altura da tabela */}
          <div className="p-4 border-b flex items-center gap-4">
            <label className="text-sm font-medium">Altura da tabela:</label>
            <input
              type="range"
              min="400"
              max="800"
              value={tableHeight}
              onChange={(e) => setTableHeight(Number(e.target.value))}
              className="flex-1 max-w-xs"
            />
            <span className="text-sm text-muted-foreground">{tableHeight}px</span>
            
            {/* Botão Salvar Layout */}
            <Button
              onClick={saveLayout}
              variant="outline"
              size="sm"
              className="ml-4"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar Layout
            </Button>
          </div>
          
          {/* Container principal com scroll SEMPRE nas bordas */}
          <div 
            className="planilha-container bg-background border rounded-lg"
            style={{ 
              height: `${tableHeight}px`,
              maxHeight: `${tableHeight}px`,
              minHeight: `${tableHeight}px`
            }}
          >
            {/* Garantir overflow vertical adicionando altura extra */}
            <div style={{ minHeight: `${tableHeight + 100}px` }}>
              <PlanoAcaoTable
              filteredActions={filteredActions}
              isLoading={isLoading}
              columnWidths={columnWidths}
              editingCell={editingCell}
              editingValue={editingValue}
              hoveredRowIndex={hoveredRowIndex}
              eixos={eixos}
              prioridades={prioridades}
              temas={temas}
              statusAcao={statusAcao}
              usuarios={usuarios}
              handleDragEnd={handleDragEnd}
              handleToggleConcluida={handleToggleConcluida}
              handleQuickEdit={handleQuickEdit}
              handleCellEdit={handleCellEdit}
              handleCellSave={handleCellSave}
              handleCellCancel={handleCellCancel}
              setEditingValue={setEditingValue}
              setHoveredRowIndex={setHoveredRowIndex}
              handleInsertAction={handleInsertAction}
              deleteAction={deleteAction}
              updateAction={updateAction}
              handleResizeStart={handleResizeStart}
              isMaximized={false}
                />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <NovaAcaoDialog
        open={isNewActionDialogOpen}
        onOpenChange={setIsNewActionDialogOpen}
        onSubmit={(data) => {
          createAction.mutate(data);
        }}
      />

      <EditAcaoDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        action={editingAction}
        onSubmit={(data) => {
          if (editingAction) {
            updateAction.mutate({
              id: editingAction.id,
              updates: data
            });
          }
          setIsEditDialogOpen(false);
        }}
      />

      <EixosManagerDialog
        open={showEixosManager}
        onOpenChange={setShowEixosManager}
      />

      <TemasManagerDialog
        open={showTemasManager}
        onOpenChange={setShowTemasManager}
      />
    </div>
  );
}