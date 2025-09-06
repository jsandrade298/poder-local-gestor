import { useState, useRef, useEffect } from "react";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Download, Upload, MoreHorizontal, Mail, Phone, MapPin, FileText, Edit, Trash2, Eye, CheckSquare, Square, Users, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NovoMunicipeDialog } from "@/components/forms/NovoMunicipeDialog";
import { ImportCSVDialog } from "@/components/forms/ImportCSVDialog";
import { EditMunicipeDialog } from "@/components/forms/EditMunicipeDialog";
import { MunicipeDetailsDialog } from "@/components/forms/MunicipeDetailsDialog";
import { MunicipeDemandasDialog } from "@/components/forms/MunicipeDemandasDialog";
import { EnviarWhatsAppDialog } from "@/components/forms/EnviarWhatsAppDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  const [showDemandasDialog, setShowDemandasDialog] = useState(false);
  const [municipeParaDemandas, setMunicipeParaDemandas] = useState<any>(null);
  const [selectedMunicipes, setSelectedMunicipes] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResults, setImportResults] = useState<any[]>([]);
  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const { toast } = useToast();
  const queryClient = useQueryClient();


  // Buscar munícipes com suas tags - SEM LIMITE
  const { data: municipes = [], isLoading } = useQuery({
    queryKey: ['municipes-complete'], // Chave única para esta query complexa
    queryFn: async () => {
      console.log('🔄 Iniciando busca de munícipes...');
      
      // Estratégia 1: Tentar buscar tudo de uma vez sem range
      try {
        const { data: allData, error: allError, count } = await supabase
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
          `, { count: 'exact' })
          .order('nome')
          .limit(10000); // Limite alto para forçar buscar tudo
        
        if (!allError && allData) {
          console.log(`✅ Busca única: ${allData.length} munícipes carregados (total no banco: ${count})`);
          return allData;
        }
        
        console.log('⚠️ Busca única falhou, tentando em lotes...');
      } catch (e) {
        console.log('⚠️ Busca única falhou, tentando em lotes...', e);
      }
      
      // Estratégia 2: Buscar em lotes se a primeira falhar
      let allMunicipes: any[] = [];
      let from = 0;
      const size = 1000; // Buscar em lotes de 1000
      let hasMore = true;
      let totalExpected = 0;
      
      while (hasMore) {
        const { data, error, count } = await supabase
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
          `, { count: 'exact' })
          .order('nome')
          .range(from, from + size - 1);
        
        if (error) {
          console.error('❌ Erro ao buscar munícipes:', error);
          throw error;
        }
        
        // Armazenar total esperado na primeira iteração
        if (from === 0 && count !== null) {
          totalExpected = count;
          console.log(`📈 Total esperado no banco: ${totalExpected}`);
        }
        
        if (data && data.length > 0) {
          allMunicipes = [...allMunicipes, ...data];
          console.log(`📊 Lote ${Math.floor(from/size) + 1}: ${data.length} munícipes (${from + 1} a ${from + data.length})`);
          
          // Se retornou menos que o tamanho do lote, chegamos ao fim
          if (data.length < size) {
            hasMore = false;
          } else {
            from += size;
          }
        } else {
          hasMore = false;
        }
        
        // Verificação de segurança: se já temos o total esperado, parar
        if (totalExpected > 0 && allMunicipes.length >= totalExpected) {
          hasMore = false;
        }
        
        // Verificação de segurança: evitar loop infinito
        if (from > 50000) {
          console.warn('⚠️ Limite de segurança atingido');
          hasMore = false;
        }
      }
      
      console.log(`✅ Total final carregado: ${allMunicipes.length} munícipes (esperado: ${totalExpected})`);
      
      // Verificar se carregamos todos os registros esperados
      if (totalExpected > 0 && allMunicipes.length < totalExpected) {
        console.warn(`⚠️ ATENÇÃO: Carregados ${allMunicipes.length} de ${totalExpected} munícipes`);
      }
      
      return allMunicipes;
    },
    staleTime: 5 * 60 * 1000, // Cache válido por 5 minutos
    refetchOnMount: false, // Não refetch automático no mount
    refetchOnWindowFocus: false, // Não refetch no foco
    refetchOnReconnect: true // Apenas refetch na reconexão
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

  // Calcular paginação
  const totalItems = filteredMunicipes.length;
  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === -1 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === -1 ? totalItems : startIndex + itemsPerPage;
  const paginatedMunicipes = itemsPerPage === -1 ? filteredMunicipes : filteredMunicipes.slice(startIndex, endIndex);

  // Reset da página quando filtros mudam
  const resetPage = () => {
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTagFilter("all");
    setBairroFilter("all");
    setCidadeFilter("all");
    resetPage();
  };

  // Gerenciar seleção de munícipes
  const handleSelectMunicipe = (municipeId: string, checked: boolean) => {
    if (checked) {
      setSelectedMunicipes(prev => [...prev, municipeId]);
    } else {
      setSelectedMunicipes(prev => prev.filter(id => id !== municipeId));
      setSelectAll(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedMunicipes(paginatedMunicipes.map(m => m.id));
    } else {
      setSelectedMunicipes([]);
    }
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
            // Se tem tags, tentar associar múltiplas tags
            if (municipe.tagIds && municipe.tagIds.length > 0) {
              const tagInserts = municipe.tagIds.map((tagId: string) => ({
                municipe_id: data.id,
                tag_id: tagId
              }));
              
              const { error: tagError } = await supabase
                .from('municipe_tags')
                .insert(tagInserts);
              
              if (tagError) {
                console.warn(`Erro ao associar tags para ${municipe.nome}:`, tagError);
              }
            } else if (municipe.tagId) {
              // Compatibilidade com formato antigo (uma única tag)
              const { error: tagError } = await supabase
                .from('municipe_tags')
                .insert({
                  municipe_id: data.id,
                  tag_id: municipe.tagId
                });
              
              if (tagError) {
                console.warn(`Erro ao associar tag para ${municipe.nome}:`, tagError);
              }
            }
            
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
      queryClient.invalidateQueries({ queryKey: ['municipes-complete'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-select'] });
      
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
    reader.onload = async (e) => {
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
        
        console.log('📋 Headers encontrados:', headers);
        console.log('📋 Separador usado:', separator);
        
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
          observacoes: ['observacoes', 'observações', 'notes', 'obs'],
          tag: ['tag', 'tags', 'etiqueta', 'etiquetas']
        };

        // Buscar todas as tags existentes para fazer o mapeamento
        const { data: existingTags } = await supabase
          .from('tags')
          .select('id, nome');
        
        const tagMap = new Map(existingTags?.map(tag => [tag.nome.toLowerCase(), tag.id]) || []);

        // Processar dados
        const municipes = lines.slice(1).map((line, index) => {
          const values = line.split(separator).map(v => v.replace(/"/g, '').trim());
          const municipe: any = {};

          Object.keys(expectedColumns).forEach(key => {
            const possibleHeaders = expectedColumns[key as keyof typeof expectedColumns];
            const headerIndex = headers.findIndex(h => possibleHeaders.includes(h));
            
            if (headerIndex !== -1 && values[headerIndex]) {
              if (key === 'data_nascimento') {
                // Tentar converter data no formato brasileiro DD/MM/AAAA
                const dateValue = values[headerIndex];
                if (dateValue && dateValue !== '') {
                  try {
                    let date: Date;
                    
                    // Verificar se está no formato brasileiro DD/MM/AAAA ou DD/MM/AA
                    if (dateValue.includes('/')) {
                      const parts = dateValue.split('/');
                      if (parts.length === 3) {
                        const day = parseInt(parts[0]);
                        const month = parseInt(parts[1]) - 1; // Mês é 0-indexado no JS
                        let year = parseInt(parts[2]);
                        
                        // Se ano tem 2 dígitos, assumir 19xx ou 20xx
                        if (year < 100) {
                          year = year > 30 ? 1900 + year : 2000 + year;
                        }
                        
                        date = new Date(year, month, day);
                      } else {
                        date = new Date(dateValue);
                      }
                    } else {
                      // Formato ISO ou outro
                      date = new Date(dateValue);
                    }
                    
                    if (!isNaN(date.getTime())) {
                      municipe[key] = date.toISOString().split('T')[0];
                    }
                  } catch {
                     // Ignorar datas inválidas
                   }
                 }
                } else if (key === 'tag' || key === 'tags') {
                  // Processar múltiplas tags - separadas por vírgula, ponto e vírgula, ou pipe
                  const tagNames = values[headerIndex];
                  if (tagNames && tagNames.trim() !== '') {
                    const separators = /[,;|]/; // Aceita vírgula, ponto e vírgula ou pipe
                    const tagList = tagNames.split(separators)
                      .map(name => name.trim().toLowerCase())
                      .filter(name => name !== '');
                    
                    const tagIds: string[] = [];
                    tagList.forEach(tagName => {
                      const tagId = tagMap.get(tagName);
                      if (tagId) {
                        tagIds.push(tagId);
                      }
                    });
                    
                    if (tagIds.length > 0) {
                      municipe.tagIds = tagIds;
                    }
                  }
                } else {
                  municipe[key] = values[headerIndex];
                }
              }
            });

            console.log(`📋 Linha ${index + 2}: ${JSON.stringify(municipe)}`);
            return municipe;
        }).filter(m => {
          const hasName = m.nome && m.nome.trim() !== '';
          console.log(`📋 Munícipe ${m.nome || 'sem nome'}: ${hasName ? 'válido' : 'inválido'}`);
          return hasName;
        }); // Só importar se tiver nome

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
    
    // Forçar codificação UTF-8 para resolver problemas de caracteres especiais
    reader.readAsText(file, 'UTF-8');
    
    // Limpar input para permitir re-upload do mesmo arquivo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Função para detectar duplicados por telefone
  const findDuplicates = () => {
    const phoneGroups: { [key: string]: any[] } = {};
    
    // Agrupar munícipes por telefone (ignorar null/empty)
    municipes.forEach(municipe => {
      if (municipe.telefone && municipe.telefone.trim() !== '') {
        const cleanPhone = municipe.telefone.replace(/\D/g, ''); // Remove caracteres não numéricos
        if (cleanPhone.length >= 10) { // Apenas telefones válidos
          if (!phoneGroups[cleanPhone]) {
            phoneGroups[cleanPhone] = [];
          }
          phoneGroups[cleanPhone].push(municipe);
        }
      }
    });
    
    // Filtrar apenas grupos com mais de 1 munícipe (duplicados)
    const duplicateGroups = Object.values(phoneGroups).filter(group => group.length > 1);
    const allDuplicates = duplicateGroups.flat();
    
    if (allDuplicates.length === 0) {
      toast({
        title: "Nenhum duplicado encontrado",
        description: "Não foram encontrados munícipes com telefones duplicados."
      });
      return;
    }
    
    // Inicializar seleção automática dos duplicados mais antigos
    const toRemove = new Set<string>();
    duplicateGroups.forEach(group => {
      const sorted = group.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      // Marcar todos exceto o mais recente para remoção
      sorted.slice(1).forEach(municipe => toRemove.add(municipe.id));
    });
    
    setDuplicates(allDuplicates);
    setSelectedForRemoval(toRemove);
    setShowDuplicatesDialog(true);
  };

  // Função para excluir duplicados baseado na seleção do usuário
  const removeDuplicates = useMutation({
    mutationFn: async () => {
      const toDelete = Array.from(selectedForRemoval);

      if (toDelete.length === 0) return { deleted: 0, errors: [] };
      
      const results = [];
      
      for (const municipeId of toDelete) {
        try {
          // Remover tags associadas
          await supabase
            .from('municipe_tags')
            .delete()
            .eq('municipe_id', municipeId);
          
          // Excluir munícipe
          const { error } = await supabase
            .from('municipes')
            .delete()
            .eq('id', municipeId);
          
          if (error) {
            results.push({ id: municipeId, success: false, error: error.message });
          } else {
            results.push({ id: municipeId, success: true });
          }
        } catch (err) {
          results.push({ id: municipeId, success: false, error: 'Erro inesperado' });
        }
      }
      
      return {
        deleted: results.filter(r => r.success).length,
        errors: results.filter(r => !r.success)
      };
    },
    onSuccess: (result) => {
      toast({
        title: `${result.deleted} duplicados removidos!`,
        description: result.errors.length > 0 
          ? `${result.errors.length} erro(s) encontrado(s).`
          : "Operação concluída com sucesso."
      });
      
      if (result.errors.length > 0) {
        console.error('Erros na remoção de duplicados:', result.errors);
      }
      
      queryClient.invalidateQueries({ queryKey: ['municipes-complete'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-select'] });
      setShowDuplicatesDialog(false);
      setDuplicates([]);
      setSelectedForRemoval(new Set());
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover duplicados",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Função para excluir munícipes em massa
  const deleteMunicipesInBatch = useMutation({
    mutationFn: async (municipeIds: string[]) => {
      const results = [];
      
      for (const municipeId of municipeIds) {
        try {
          console.log('Iniciando exclusão do munícipe:', municipeId);
          
          // Primeiro, remover todas as tags associadas ao munícipe
          const { error: tagDeleteError } = await supabase
            .from('municipe_tags')
            .delete()
            .eq('municipe_id', municipeId);
          
          if (tagDeleteError) {
            console.error('Erro ao remover tags:', tagDeleteError);
          }
          
          // Depois, excluir o munícipe
          const { error, data } = await supabase
            .from('municipes')
            .delete()
            .eq('id', municipeId)
            .select();
          
          if (error) {
            results.push({ id: municipeId, success: false, error: error.message });
          } else {
            results.push({ id: municipeId, success: true });
          }
        } catch (err) {
          results.push({ id: municipeId, success: false, error: 'Erro inesperado' });
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      if (successCount > 0) {
        toast({
          title: `${successCount} munícipe(s) excluído(s) com sucesso!`,
          description: errorCount > 0 ? `${errorCount} erro(s) encontrado(s).` : "Operação concluída."
        });
      }
      
      if (errorCount > 0) {
        toast({
          title: `Erro ao excluir ${errorCount} munícipe(s)`,
          description: "Verifique se não há demandas vinculadas aos munícipes.",
          variant: "destructive"
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['municipes-complete'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-select'] });
      setSelectedMunicipes([]);
      setSelectAll(false);
    },
    onError: (error) => {
      toast({
        title: "Erro na exclusão em massa",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Função para excluir munícipe individual
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
      queryClient.invalidateQueries({ queryKey: ['municipes-complete'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-select'] });
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
            {/* Botão de debug temporário */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                console.log('🔍 DEBUG: Total de munícipes carregados:', municipes.length);
                console.log('🔍 DEBUG: Primeiros 5 munícipes:', municipes.slice(0, 5).map(m => m.nome));
                console.log('🔍 DEBUG: Últimos 5 munícipes:', municipes.slice(-5).map(m => m.nome));
                toast({
                  title: "Debug Info",
                  description: `Total carregado: ${municipes.length} munícipes. Veja o console para detalhes.`
                });
              }}
              className="gap-2"
            >
              🔍 Debug
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                console.log('🔄 Refresh manual dos munícipes');
                queryClient.invalidateQueries({ queryKey: ['municipes-complete'] });
                queryClient.invalidateQueries({ queryKey: ['municipes-dashboard'] });
                queryClient.invalidateQueries({ queryKey: ['municipes-select'] });
                toast({
                  title: "Dados atualizados!",
                  description: "Lista de munícipes foi atualizada."
                });
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <EnviarWhatsAppDialog municipesSelecionados={selectedMunicipes} />
            <Button 
              variant="outline" 
              size="sm"
              onClick={findDuplicates}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Detectar Duplicados
            </Button>
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
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      resetPage();
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Tag
                </label>
                <Select value={tagFilter} onValueChange={(value) => {
                  setTagFilter(value);
                  resetPage();
                }}>
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
                <Select value={bairroFilter} onValueChange={(value) => {
                  setBairroFilter(value);
                  resetPage();
                }}>
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
                <Select value={cidadeFilter} onValueChange={(value) => {
                  setCidadeFilter(value);
                  resetPage();
                }}>
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

        {/* Controles de Paginação e Tabela */}
        <Card className="shadow-sm border-0 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Lista de Munícipes</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Mostrar:</span>
                  <Select 
                    value={itemsPerPage.toString()} 
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 por página</SelectItem>
                      <SelectItem value="50">50 por página</SelectItem>
                      <SelectItem value="100">100 por página</SelectItem>
                      <SelectItem value="-1">Mostrar todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm font-normal text-muted-foreground">
                  {isLoading ? 'Carregando...' : 
                    itemsPerPage === -1 ? 
                      `${filteredMunicipes.length} munícipes` :
                      `${startIndex + 1}-${Math.min(endIndex, totalItems)} de ${totalItems} munícipes`
                  }
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
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
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        Carregando munícipes...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedMunicipes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum munícipe encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMunicipes.map((municipe) => (
                    <TableRow key={municipe.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedMunicipes.includes(municipe.id)}
                          onCheckedChange={(checked) => handleSelectMunicipe(municipe.id, !!checked)}
                          aria-label={`Selecionar ${municipe.nome}`}
                        />
                      </TableCell>
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
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.preventDefault();
                              setMunicipeParaDemandas(municipe);
                              setShowDemandasDialog(true);
                            }}>
                              <FileText className="h-4 w-4 mr-2" />
                              Ver demandas
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.preventDefault();
                              console.log('Editar clicado para:', municipe.nome);
                              setMunicipeToEdit(municipe);
                              setShowEditDialog(true);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.preventDefault();
                              console.log('Excluir clicado para:', municipe.nome);
                              if (window.confirm(`Tem certeza que deseja excluir o munícipe "${municipe.nome}"?`)) {
                                deleteMunicipe.mutate(municipe.id);
                              }
                            }}>
                              <Trash2 className="h-4 w-4 mr-2" />
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
          
          {/* Paginação */}
          {totalPages > 1 && itemsPerPage !== -1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
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

        {/* Dialog de Demandas do Munícipe */}
        <MunicipeDemandasDialog
          municipe={municipeParaDemandas}
          open={showDemandasDialog}
          onOpenChange={setShowDemandasDialog}
        />

        {/* Botão Flutuante de Ações em Massa */}
        {selectedMunicipes.length > 0 && (
          <div className="fixed bottom-6 right-6 z-50 animate-scale-in">
            <div className="bg-card border border-border rounded-2xl shadow-lg backdrop-blur-sm p-4 min-w-[280px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <CheckSquare className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedMunicipes.length} selecionado{selectedMunicipes.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Clique para gerenciar
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMunicipes([]);
                    setSelectAll(false);
                  }}
                  className="h-8 w-8 p-0 hover:bg-muted"
                >
                </Button>
              </div>
              
              <div className="flex gap-2">
                <EnviarWhatsAppDialog municipesSelecionados={selectedMunicipes} />
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all duration-200 hover:scale-105"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão em massa</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir {selectedMunicipes.length} munícipe(s) selecionado(s)? 
                        Esta ação não pode ser desfeita e removerá todos os dados associados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteMunicipesInBatch.mutate(selectedMunicipes)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir {selectedMunicipes.length} munícipe(s)
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedMunicipes([]);
                    setSelectAll(false);
                  }}
                  className="transition-all duration-200 hover:scale-105"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Dialog de Duplicados */}
        <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Munícipes Duplicados Encontrados
              </DialogTitle>
              <DialogDescription>
                {duplicates.length} munícipe(s) com telefones duplicados. Você pode remover os duplicados mantendo apenas o cadastro mais recente de cada telefone.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4">
              {(() => {
                const phoneGroups: { [key: string]: any[] } = {};
                duplicates.forEach(municipe => {
                  const cleanPhone = municipe.telefone.replace(/\D/g, '');
                  if (!phoneGroups[cleanPhone]) {
                    phoneGroups[cleanPhone] = [];
                  }
                  phoneGroups[cleanPhone].push(municipe);
                });

                return Object.entries(phoneGroups).map(([phone, group]) => {
                  const sorted = group.sort((a, b) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  );

                  return (
                    <Card key={phone} className="border-l-4 border-l-yellow-500">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Telefone: {group[0].telefone}
                          <Badge variant="secondary">{group.length} duplicados</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                       <div className="space-y-2">
                          {sorted.map((municipe, index) => {
                            const isSelectedForRemoval = selectedForRemoval.has(municipe.id);
                            const isKept = index === 0 && !isSelectedForRemoval;
                            const willBeRemoved = index > 0 || isSelectedForRemoval;
                            
                            return (
                              <div 
                                key={municipe.id} 
                                className={`p-3 rounded-lg border ${
                                  isKept
                                    ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                                    : willBeRemoved
                                    ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                                    : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">
                                      {municipe.nome}
                                      {isKept && (
                                        <Badge variant="outline" className="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                          Será mantido
                                        </Badge>
                                      )}
                                      {willBeRemoved && (
                                        <Badge variant="outline" className="ml-2 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                                          Será removido
                                        </Badge>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Email: {municipe.email || 'Não informado'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Cadastrado em: {new Date(municipe.created_at).toLocaleDateString('pt-BR')}
                                    </p>
                                  </div>
                                  
                                  {/* Checkbox para controlar remoção */}
                                  <div className="flex items-center space-x-2 ml-4">
                                    <Checkbox
                                      checked={selectedForRemoval.has(municipe.id)}
                                      onCheckedChange={(checked) => {
                                        const newSelected = new Set(selectedForRemoval);
                                        if (checked) {
                                          newSelected.add(municipe.id);
                                        } else {
                                          newSelected.delete(municipe.id);
                                        }
                                        setSelectedForRemoval(newSelected);
                                      }}
                                    />
                                    <label className="text-xs text-muted-foreground">
                                      Remover
                                    </label>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                });
              })()}
            </div>

            <div className="border-t pt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-green-600">Mantidos:</span> {
                  duplicates.length - selectedForRemoval.size
                } • 
                <span className="font-medium text-red-600 ml-2">Removidos:</span> {
                  selectedForRemoval.size
                }
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDuplicatesDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => removeDuplicates.mutate()}
                  disabled={removeDuplicates.isPending || selectedForRemoval.size === 0}
                >
                  {removeDuplicates.isPending ? 'Removendo...' : `Remover ${selectedForRemoval.size} Duplicado(s)`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}