import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileText, CheckCircle, Loader2, AlertCircle, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ImportResult {
  success: boolean;
  titulo: string;
  error?: string;
  id?: string;
  geocodificado?: boolean;
}

interface ImportCSVDialogDemandasProps {
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isImporting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  importResults?: ImportResult[];
  importProgress?: {
    fase: 'importando' | 'geocodificando';
    atual: number;
    total: number;
  };
}

export function ImportCSVDialogDemandas({ 
  onFileSelect, 
  isImporting, 
  fileInputRef, 
  importResults,
  importProgress 
}: ImportCSVDialogDemandasProps) {
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
        'Sua Cidade',
        '00000-000',
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
        'Avenida Industrial',
        '456',
        'Vila Nova',
        'Sua Cidade',
        '00000-000',
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

  // Calcular estatísticas dos resultados
  const successCount = importResults?.filter(r => r.success).length || 0;
  const errorCount = importResults?.filter(r => !r.success).length || 0;
  const geocodificadosCount = importResults?.filter(r => r.success && r.geocodificado).length || 0;

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
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
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
                    <h3 className="font-semibold text-lg">
                      {importProgress?.fase === 'geocodificando' 
                        ? 'Geocodificando endereços...' 
                        : 'Importando demandas...'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {importProgress 
                        ? `Processando ${importProgress.atual} de ${importProgress.total}`
                        : 'Aguarde enquanto processamos o arquivo...'}
                    </p>
                  </div>
                </div>
                {importProgress && (
                  <Progress 
                    value={(importProgress.atual / importProgress.total) * 100} 
                    className="h-2" 
                  />
                )}
                {importProgress?.fase === 'geocodificando' && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Obtendo coordenadas GPS dos endereços para exibir no mapa
                  </p>
                )}
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
                    <h3 className="font-semibold text-lg">Importação Concluída</h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="secondary" className="text-green-700 bg-green-100">
                        {successCount} importadas
                      </Badge>
                      {errorCount > 0 && (
                        <Badge variant="secondary" className="text-red-700 bg-red-100">
                          {errorCount} erros
                        </Badge>
                      )}
                      {geocodificadosCount > 0 && (
                        <Badge variant="secondary" className="text-blue-700 bg-blue-100">
                          <MapPin className="h-3 w-3 mr-1" />
                          {geocodificadosCount} geocodificadas
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Lista de resultados */}
                <div className="max-h-[200px] overflow-y-auto space-y-1 mt-4">
                  {importResults.map((result, index) => (
                    <div 
                      key={index}
                      className={`text-sm p-2 rounded flex items-center gap-2 ${
                        result.success 
                          ? 'bg-green-100/50 text-green-800' 
                          : 'bg-red-100/50 text-red-800'
                      }`}
                    >
                      {result.success ? (
                        <>
                          <CheckCircle className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{result.titulo}</span>
                          {result.geocodificado && (
                            <MapPin className="h-3 w-3 text-blue-600 flex-shrink-0" title="Geocodificado" />
                          )}
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{result.titulo}: {result.error}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Fechar
                  </Button>
                  <Button onClick={handleImportClick}>
                    Importar Mais
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conteúdo principal - mostrar apenas se não está importando e não há resultados */}
          {!isImporting && (!importResults || importResults.length === 0) && (
            <>
              {/* Passo a passo */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Passo a Passo</h3>
                <div className="space-y-2">
                  <Card className="border-green-500/20 bg-green-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          1
                        </div>
                        <div>
                          <h4 className="font-medium">Baixe o modelo</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Use o botão abaixo para baixar um arquivo CSV de exemplo com a estrutura correta.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-green-500/20 bg-green-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          2
                        </div>
                        <div>
                          <h4 className="font-medium">Preencha os dados</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Abra o modelo no Excel ou Google Sheets e preencha com suas demandas. 
                            <strong> Preencha o endereço completo para melhor localização no mapa.</strong>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-green-500/20 bg-green-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
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
                        <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          4
                        </div>
                        <div>
                          <h4 className="font-medium">Importe o arquivo</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Clique em "Selecionar Arquivo CSV" abaixo. O sistema irá importar as demandas e 
                            <strong className="text-blue-700"> automaticamente geocodificar os endereços</strong> para exibição no mapa.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Info sobre geocodificação */}
              <Card className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">Georeferenciamento Automático</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Após a importação, o sistema buscará automaticamente as coordenadas GPS de cada demanda 
                        usando o endereço informado. Para melhores resultados:
                      </p>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                        <li>Preencha o <strong>logradouro</strong> completo (ex: "Rua das Flores")</li>
                        <li>Inclua o <strong>número</strong> do endereço quando possível</li>
                        <li>Informe o <strong>bairro</strong> e a <strong>cidade</strong></li>
                        <li>O <strong>CEP</strong> ajuda na precisão</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Informações sobre os campos */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Ordem das Colunas (OBRIGATÓRIA)</h3>
                <Card>
                  <CardContent className="p-4">
                    <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Atenção:</strong> As colunas devem estar exatamente nesta ordem. Não altere a sequência!
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {/* Campos obrigatórios */}
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
                      
                      {/* Campos opcionais */}
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
                      
                      {/* Campos de endereço - destacados */}
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">H</div>
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span>Logradouro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">I</div>
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span>Número</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">J</div>
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span>Bairro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">K</div>
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span>Cidade</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">L</div>
                        <MapPin className="h-4 w-4 text-blue-500" />
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
                        <span>Data Prazo (AAAA-MM-DD)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-500 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">O</div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Observações</span>
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Campos em azul são usados para geocodificação (localização no mapa)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Dicas importantes */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Dicas Importantes</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Os campos <strong>titulo</strong>, <strong>descricao</strong> e <strong>municipe_nome</strong> são obrigatórios</p>
                  <p>• O <strong>municipe_nome</strong> deve corresponder exatamente ao nome de um munícipe já cadastrado (ex: "Maria Silva Santos")</p>
                  <p>• <strong>responsavel_nome</strong> deve corresponder ao nome de um usuário cadastrado</p>
                  <p>• <strong>area_nome</strong> deve corresponder a uma área existente no sistema</p>
                  <p>• <strong>status</strong> deve ser: solicitada, em_producao, encaminhado, atendido ou devolvido</p>
                  <p>• <strong>prioridade</strong> deve ser: baixa, media, alta ou urgente</p>
                  <p>• <strong>data_prazo</strong> deve estar no formato AAAA-MM-DD (ex: 2025-12-31)</p>
                  <p>• O arquivo modelo usa ponto e vírgula (;) como separador de colunas</p>
                  <p>• Mantenha a codificação UTF-8 ao salvar o arquivo</p>
                </div>
              </div>

              <Separator />

              {/* Botões de ação */}
              <div className="flex justify-between gap-3">
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
