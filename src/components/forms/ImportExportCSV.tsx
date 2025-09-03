import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMunicipes } from "@/hooks/useMunicipes";

export function ImportExportCSV() {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    success: number;
    errors: number;
    errorDetails?: string[];
  } | null>(null);
  
  const { toast } = useToast();
  const { municipes, importFromCSV } = useMunicipes();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo CSV válido.",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    setImportResults(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('Arquivo CSV deve conter pelo menos uma linha de cabeçalho e uma linha de dados');
      }

      // Processar CSV (simplificado - em produção usar biblioteca como Papa Parse)
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || '';
        });
        return obj;
      });

      // Mapear campos do CSV para campos do banco
      const mappedData = data.map(row => ({
        nome_completo: row.nome_completo || row.nome || '',
        email: row.email || '',
        telefone: row.telefone || row.celular || '',
        data_nascimento: row.data_nascimento || row.nascimento || '',
        end_logradouro: row.end_logradouro || row.endereco || '',
        end_numero: row.end_numero || row.numero || '',
        end_complemento: row.end_complemento || row.complemento || '',
        end_bairro: row.end_bairro || row.bairro || '',
        end_cidade: row.end_cidade || row.cidade || 'São Paulo',
        end_cep: row.end_cep || row.cep || '',
        observacoes: row.observacoes || row.obs || ''
      }));

      const result = await importFromCSV(mappedData);
      setImportResults(result);

      if (result.error) {
        toast({
          title: "Erro na importação",
          description: result.error,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Importação concluída",
          description: `${result.success} munícipes importados com sucesso. ${result.errors} erros encontrados.`
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      // Limpar input
      event.target.value = '';
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Criar CSV com todos os munícipes
      const headers = [
        'nome_completo',
        'email', 
        'telefone',
        'data_nascimento',
        'end_logradouro',
        'end_numero',
        'end_complemento',
        'end_bairro',
        'end_cidade',
        'end_cep',
        'observacoes'
      ];

      const csvContent = [
        headers.join(','),
        ...municipes.map(municipe => [
          `"${municipe.nome_completo}"`,
          `"${municipe.email}"`,
          `"${municipe.telefone || ''}"`,
          `"${municipe.data_nascimento || ''}"`,
          `"${municipe.end_logradouro || ''}"`,
          `"${municipe.end_numero || ''}"`,
          `"${municipe.end_complemento || ''}"`,
          `"${municipe.end_bairro || ''}"`,
          `"${municipe.end_cidade || ''}"`,
          `"${municipe.end_cep || ''}"`,
          `"${municipe.observacoes || ''}"`
        ].join(','))
      ].join('\n');

      // Download do arquivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `municipes_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Exportação concluída",
        description: `${municipes.length} munícipes exportados com sucesso.`
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      'nome_completo,email,telefone,data_nascimento,end_logradouro,end_numero,end_complemento,end_bairro,end_cidade,end_cep,observacoes',
      '"João da Silva","joao@email.com","(11) 99999-9999","1990-01-15","Rua das Flores","123","Apto 1","Centro","São Paulo","01000-000","Exemplo de munícipe"'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_municipes.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Importar CSV */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Importar Munícipes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Faça upload de um arquivo CSV para importar múltiplos munícipes de uma vez.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="csv-upload">Arquivo CSV</Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isImporting}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="flex-1"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
            </div>

            {isImporting && (
              <div className="text-sm text-muted-foreground">
                Processando arquivo...
              </div>
            )}

            {importResults && (
              <div className="p-3 border rounded-md bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Resultado da Importação</span>
                </div>
                <div className="text-sm space-y-1">
                  <p>✅ <strong>{importResults.success}</strong> munícipes importados</p>
                  <p>❌ <strong>{importResults.errors}</strong> registros com erro</p>
                  {importResults.errorDetails && importResults.errorDetails.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Detalhes dos erros:</p>
                      <ul className="list-disc list-inside text-xs">
                        {importResults.errorDetails.slice(0, 5).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {importResults.errorDetails.length > 5 && (
                          <li>... e mais {importResults.errorDetails.length - 5} erros</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exportar CSV */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exportar Munícipes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Baixe todos os munícipes cadastrados em formato CSV.
            </p>

            <div className="p-3 border rounded-md bg-muted/50">
              <div className="text-sm">
                <p><strong>{municipes.length}</strong> munícipes serão exportados</p>
                <p className="text-muted-foreground">
                  Incluindo todos os dados pessoais e de endereço
                </p>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting || municipes.length === 0}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exportando..." : "Exportar CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Como usar a importação CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <p><strong>1. Baixe o template:</strong> Use o botão "Baixar Template" para obter um arquivo modelo com as colunas corretas.</p>
            <p><strong>2. Preencha os dados:</strong> Adicione os dados dos munícipes no arquivo, respeitando o formato das colunas.</p>
            <p><strong>3. Faça o upload:</strong> Selecione o arquivo preenchido e aguarde o processamento.</p>
          </div>
          
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Colunas obrigatórias:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>nome_completo:</strong> Nome completo do munícipe</li>
              <li>• <strong>email:</strong> Email único (não pode repetir)</li>
            </ul>
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Colunas opcionais:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• telefone, data_nascimento (YYYY-MM-DD)</li>
              <li>• end_logradouro, end_numero, end_complemento</li>
              <li>• end_bairro, end_cidade, end_cep</li>
              <li>• observacoes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}