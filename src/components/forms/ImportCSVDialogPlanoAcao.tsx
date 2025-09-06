import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface ImportCSVDialogPlanoAcaoProps {
  children: React.ReactNode;
}

interface CSVRow {
  acao: string;
  eixo: string;
  prioridade: string;
  tema: string;
  responsavel: string;
  apoio: string;
  status: string;
  prazo: string;
  atualizacao: string;
}

export function ImportCSVDialogPlanoAcao({ children }: ImportCSVDialogPlanoAcaoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    total: number;
    success: number;
    errors: string[];
  } | null>(null);

  const queryClient = useQueryClient();

  // Carregar dados de referência
  const { data: eixos = [] } = useQuery({
    queryKey: ['eixos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eixos').select('id, nome').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: prioridades = [] } = useQuery({
    queryKey: ['prioridades-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('prioridades_acao').select('id, nome').order('nivel');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: temas = [] } = useQuery({
    queryKey: ['temas-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('temas_acao').select('id, nome').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: statusAcao = [] } = useQuery({
    queryKey: ['status-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('status_acao').select('id, nome').order('nome');
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

  const importMutation = useMutation({
    mutationFn: async (csvData: CSVRow[]) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const results = {
        total: csvData.length,
        success: 0,
        errors: [] as string[]
      };

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        setProgress(((i + 1) / csvData.length) * 100);

        try {
          // Validar campos obrigatórios
          if (!row.acao?.trim()) {
            results.errors.push(`Linha ${i + 2}: Campo "acao" é obrigatório`);
            continue;
          }

          // Buscar IDs das referências
          const eixo = eixos.find(e => e.nome.toLowerCase() === row.eixo?.toLowerCase()?.trim());
          const prioridade = prioridades.find(p => p.nome.toLowerCase() === row.prioridade?.toLowerCase()?.trim());
          const tema = temas.find(t => t.nome.toLowerCase() === row.tema?.toLowerCase()?.trim());
          const status = statusAcao.find(s => s.nome.toLowerCase() === row.status?.toLowerCase()?.trim());
          const responsavel = usuarios.find(u => u.nome.toLowerCase() === row.responsavel?.toLowerCase()?.trim());

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
            } else {
              results.errors.push(`Linha ${i + 2}: Formato de data inválido para "prazo". Use DD/MM/YYYY ou YYYY-MM-DD`);
              continue;
            }
          }

          // Inserir no banco
          const { error } = await supabase
            .from('planos_acao')
            .insert({
              acao: row.acao.trim(),
              eixo_id: eixo?.id || null,
              prioridade_id: prioridade?.id || null,
              tema_id: tema?.id || null,
              responsavel_id: responsavel?.id || null,
              apoio: row.apoio?.trim() || null,
              status_id: status?.id || null,
              prazo: prazoDate,
              atualizacao: row.atualizacao?.trim() || null,
              concluida: false,
              created_by: user.user.id
            });

          if (error) {
            results.errors.push(`Linha ${i + 2}: ${error.message}`);
          } else {
            results.success++;
          }
        } catch (err) {
          results.errors.push(`Linha ${i + 2}: Erro inesperado - ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setResults(results);
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      
      if (results.errors.length === 0) {
        toast.success(`${results.success} ações importadas com sucesso!`);
      } else if (results.success > 0) {
        toast.warning(`${results.success} ações importadas. ${results.errors.length} erros encontrados.`);
      } else {
        toast.error("Nenhuma ação foi importada devido a erros.");
      }
    },
    onError: (error) => {
      toast.error(`Erro na importação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      console.error('Erro na importação:', error);
    },
    onSettled: () => {
      setIsProcessing(false);
      setProgress(0);
    }
  });

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const expectedHeaders = ['acao', 'eixo', 'prioridade', 'tema', 'responsavel', 'apoio', 'status', 'prazo', 'atualizacao'];
    
    // Verificar se os headers estão corretos
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      toast.error(`Headers obrigatórios não encontrados: ${missingHeaders.join(', ')}`);
      return [];
    }

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      return row as CSVRow;
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Por favor, selecione um arquivo CSV válido.');
        return;
      }
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleImport = () => {
    if (!file) {
      toast.error('Por favor, selecione um arquivo CSV.');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const csvData = parseCSV(text);
        
        if (csvData.length === 0) {
          setIsProcessing(false);
          return;
        }
        
        importMutation.mutate(csvData);
      } catch (error) {
        toast.error('Erro ao processar arquivo CSV.');
        setIsProcessing(false);
      }
    };
    
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = [
      'acao',
      'eixo', 
      'prioridade',
      'tema',
      'responsavel',
      'apoio',
      'status',
      'prazo',
      'atualizacao'
    ];
    
    const exampleRows = [
      [
        'Implementar sistema de gestão de documentos',
        'Gestão e Modernização',
        'Alta',
        'Digitalização',
        'João Silva',
        'Equipe de TI',
        'Em Planejamento',
        '31/12/2024',
        'Iniciando levantamento de requisitos'
      ],
      [
        'Reformar praça central da cidade',
        'Infraestrutura',
        'Média',
        'Espaços Públicos',
        'Maria Santos',
        'Secretaria de Obras',
        'Em Andamento',
        '15/06/2025',
        'Projeto executivo em elaboração'
      ]
    ];

    const csvContent = [headers, ...exampleRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_plano_acao.csv';
    link.click();
    
    toast.success('Modelo CSV baixado com sucesso!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Plano de Ação via CSV
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Instruções */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Instruções para importação:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>acao</strong>: Descrição da ação (obrigatório)</li>
                  <li><strong>eixo</strong>: Nome do eixo (deve existir no sistema)</li>
                  <li><strong>prioridade</strong>: Nome da prioridade (deve existir no sistema)</li>
                  <li><strong>tema</strong>: Nome do tema (deve existir no sistema)</li>
                  <li><strong>responsavel</strong>: Nome completo do responsável (ex: "João Silva")</li>
                  <li><strong>apoio</strong>: Descrição do apoio necessário</li>
                  <li><strong>status</strong>: Nome do status (deve existir no sistema)</li>
                  <li><strong>prazo</strong>: Data no formato DD/MM/YYYY ou YYYY-MM-DD</li>
                  <li><strong>atualizacao</strong>: Descrição da última atualização</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Download do modelo */}
          <div className="flex justify-center">
            <Button variant="outline" onClick={downloadTemplate} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Baixar Modelo CSV
            </Button>
          </div>

          {/* Seleção de arquivo */}
          <div className="space-y-2">
            <Label htmlFor="csvFile">Selecionar arquivo CSV</Label>
            <Input
              id="csvFile"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
          </div>

          {/* Progresso */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processando...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Resultados */}
          {results && (
            <Alert className={results.errors.length === 0 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Importação concluída:</p>
                  <ul className="text-sm space-y-1">
                    <li>• Total de linhas: {results.total}</li>
                    <li>• Ações importadas: {results.success}</li>
                    <li>• Erros: {results.errors.length}</li>
                  </ul>
                  
                  {results.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium text-sm">Ver erros</summary>
                      <div className="mt-2 max-h-32 overflow-y-auto bg-white p-2 rounded border">
                        {results.errors.map((error, index) => (
                          <div key={index} className="text-xs text-red-600 mb-1">
                            {error}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Fechar
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!file || isProcessing}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {isProcessing ? 'Importando...' : 'Importar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}