import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileText, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ImportResult {
  success: boolean;
  titulo: string;
  error?: string;
  id?: string;
}

interface ImportCSVDialogDemandasProps {
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isImporting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  importResults?: ImportResult[];
}

export function ImportCSVDialogDemandas({ onFileSelect, isImporting, fileInputRef, importResults }: ImportCSVDialogDemandasProps) {
  const [open, setOpen] = useState(false);

  const downloadTemplate = () => {
    const headers = [
      'titulo',           // Coluna A
      'descricao',        // Coluna B
      'municipe_nome',    // Coluna C
      'area_nome',        // Coluna D
      'responsavel_nome', // Coluna E
      'status',           // Coluna F
      'prioridade',       // Coluna G
      'logradouro',       // Coluna H
      'numero',           // Coluna I
      'bairro',           // Coluna J
      'cidade',           // Coluna K
      'cep',              // Coluna L
      'complemento',      // Coluna M
      'data_prazo',       // Coluna N
      'observacoes'       // Coluna O
    ];

    const exampleData = [
      [
        'Iluminação pública na Rua das Flores',
        'Solicitação de instalação de postes de iluminação na Rua das Flores, trecho entre os números 100 e 200',
        'Maria da Silva Santos',
        'Infraestrutura',
        'João Silva',
        'solicitada',
        'media',
        'Rua das Flores',
        '150',
        'Centro',
        'São Paulo',
        '01234-567',
        'Próximo à escola',
        '2025-12-31',
        'Demanda solicitada pelos moradores locais'
      ],
      [
        'Problema no asfalto da Avenida Principal',
        'Buraco no asfalto causando transtornos para os motoristas',
        'José Santos Oliveira',
        'Obras',
        'Ana Costa',
        'em_producao',
        'alta',
        'Avenida Principal',
        '456',
        'Vila Nova',
        'São Paulo',
        '05678-901',
        '',
        '2025-10-15',
        'Reportado por múltiplos munícipes'
      ]
    ];

    // Criar CSV com separador ; para melhor compatibilidade
    const csvContent = [
      headers.join(';'),
      ...exampleData.map(row => 
        row.map(field => {
          // Escapar aspas duplas e envolver campos com vírgulas/quebras de linha
          const escaped = field.toString().replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(';')
      )
    ].join('\r\n'); // Usar CRLF para melhor compatibilidade

    // Adicionar BOM para UTF-8 (resolve problemas de codificação)
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_importacao_demandas.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Função para resetar o estado quando o modal abrir
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  // Função para voltar ao início do processo
  const handleStartOver = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calcular estatísticas dos resultados
  const successCount = importResults?.filter(r => r.success).length || 0;
  const errorCount = importResults?.filter(r => !r.success).length || 0;
  const totalCount = importResults?.length || 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={isImporting}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isImporting ? 'Importando...' : 'Importar CSV'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Como Importar Demandas via CSV
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Mostrar progresso de importação */}
          {isImporting && (
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <div>
                    <h3 className="font-semibold text-lg">Processando arquivo...</h3>
                    <p className="text-sm text-muted-foreground">
                      Importando as demandas. Aguarde...
                    </p>
                  </div>
                </div>
                <Progress value={undefined} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Mostrar resultados da importação */}
          {importResults && importResults.length > 0 && !isImporting && (
            <Card className={`border-2 ${successCount > 0 ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  {successCount > 0 ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">Importação Concluída!</h3>
                    <p className="text-sm text-muted-foreground">
                      {successCount > 0 
                        ? `${successCount} demandas importadas com sucesso${errorCount > 0 ? `, ${errorCount} com erro` : ''}.`
                        : `Não foi possível importar nenhuma demanda. ${errorCount} erros encontrados.`
                      }
                    </p>
                  </div>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-background rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{totalCount}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{successCount}</div>
                    <div className="text-sm text-muted-foreground">Sucesso</div>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                    <div className="text-sm text-muted-foreground">Erros</div>
                  </div>
                </div>

                {/* Lista de erros se houver */}
                {errorCount > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-red-600">Erros encontrados:</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {importResults
                        .filter(r => !r.success)
                        .slice(0, 5) // Mostrar apenas os primeiros 5 erros
                        .map((result, index) => (
                          <div key={index} className="text-sm bg-red-50 dark:bg-red-950/20 p-2 rounded">
                            <strong>{result.titulo}</strong>: {result.error}
                          </div>
                        ))
                      }
                      {importResults.filter(r => !r.success).length > 5 && (
                        <div className="text-sm text-muted-foreground">
                          ... e mais {importResults.filter(r => !r.success).length - 5} erros
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      handleStartOver();
                      handleImportClick();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Outro Arquivo
                  </Button>
                  <Button onClick={() => setOpen(false)}>
                    Fechar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instruções de importação (mostrar apenas se não estiver importando nem mostrando resultados) */}
          {!isImporting && (!importResults || importResults.length === 0) && (
            <>
              {/* Passo a Passo */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Passo a Passo</h3>
                
                <div className="space-y-3">
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                          1
                        </div>
                        <div>
                          <h4 className="font-medium">Baixe a planilha modelo</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Clique no botão abaixo para baixar um arquivo CSV com o formato correto e exemplos de dados.
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={downloadTemplate}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Baixar Modelo CSV
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-orange-500/20 bg-orange-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                          2
                        </div>
                        <div>
                          <h4 className="font-medium">Preencha seus dados</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Abra o arquivo no Excel, Google Sheets ou similar. Substitua os dados de exemplo pelos seus dados reais.
                            <strong>Importante:</strong> As colunas devem estar na ordem exata (A=Título, B=Descrição, C=Munícipe, etc.).
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-green-500/20 bg-green-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                          3
                        </div>
                        <div>
                          <h4 className="font-medium">Salve como CSV</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Salve o arquivo como CSV (valores separados por vírgula). No Excel: "Salvar Como" → "CSV (separado por vírgulas)".
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                          4
                        </div>
                        <div>
                          <h4 className="font-medium">Importe o arquivo</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Clique em "Selecionar Arquivo CSV" abaixo e escolha o arquivo que você preparou.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Informações sobre os campos */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Ordem das Colunas (OBRIGATÓRIA)</h3>
                <Card>
                  <CardContent className="p-4">
                    <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      <strong>Atenção:</strong> As colunas devem estar exatamente nesta ordem. Não altere a sequência!
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="bg-primary text-primary-foreground rounded w-6 h-6 flex items-center justify-center text-xs font-bold">A</div>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span><strong>Título</strong> (obrigatório)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-primary text-primary-foreground rounded w-6 h-6 flex items-center justify-center text-xs font-bold">B</div>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span><strong>Descrição</strong> (obrigatório)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-primary text-primary-foreground rounded w-6 h-6 flex items-center justify-center text-xs font-bold">C</div>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span><strong>Munícipe_nome</strong> (obrigatório)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">D</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Área</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">E</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Responsável</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">F</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Status</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">G</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Prioridade</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">H</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Logradouro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">I</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Número</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">J</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Bairro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">K</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Cidade</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">L</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>CEP</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">M</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Complemento</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">N</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Prazo da demanda (AAAA-MM-DD)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">O</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Observações</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Dicas importantes */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Dicas Importantes</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Os campos <strong>titulo</strong>, <strong>descricao</strong> e <strong>municipe_nome</strong> são obrigatórios</p>
                  <p>• O <strong>municipe_nome</strong> deve corresponder exatamente ao nome de um munícipe já cadastrado (ex: "Maria Silva Santos", "João Carlos Oliveira")</p>
                  <p>• <strong>responsavel_nome</strong> deve corresponder ao nome de um usuário cadastrado (ex: "João Silva", "Ana Costa")</p>
                  <p>• <strong>area_nome</strong> deve corresponder a uma área existente no sistema</p>
                  <p>• <strong>status</strong> deve ser: aberta, em_andamento, resolvida ou cancelada</p>
                  <p>• <strong>prioridade</strong> deve ser: baixa, media ou alta</p>
                  <p>• <strong>data_prazo</strong> deve estar no formato AAAA-MM-DD (ex: 2025-12-31)</p>
                  <p>• O arquivo modelo usa ponto e vírgula (;) como separador de colunas</p>
                  <p>• Mantenha a codificação UTF-8 ao salvar o arquivo</p>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex justify-between gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo
                  </Button>
                  <Button onClick={handleImportClick}>
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivo CSV
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Input oculto para seleção de arquivo */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={onFileSelect}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
}
