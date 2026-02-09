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
  nome: string;
  error?: string;
  id?: string;
  geocodificado?: boolean;
}

interface ImportCSVDialogProps {
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

export function ImportCSVDialog({ 
  onFileSelect, 
  isImporting, 
  fileInputRef, 
  importResults,
  importProgress 
}: ImportCSVDialogProps) {
  const [open, setOpen] = useState(false);
  const [showingResults, setShowingResults] = useState(false);

  const downloadTemplate = () => {
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
      'observacoes',
      'tag'
    ];

    const exampleData = [
      [
        'Maria da Silva Santos',
        '(11) 99999-1111',
        'maria.silva@email.com',
        'Rua das Flores',
        '123',
        'Centro',
        'São Paulo',
        '01234-567',
        'Apt 45',
        '1985-05-15',
        'Munícipe cadastrada em 2024',
        'Família, Idoso'
      ],
      [
        'José Santos Oliveira',
        '(11) 98888-2222',
        'jose.santos@email.com',
        'Avenida Principal',
        '456',
        'Vila Nova',
        'São Paulo',
        '05678-901',
        '',
        '1978-12-03',
        'Comerciante local',
         'Comerciante, Empresário'
       ],
       [
         'Ana Costa Silva',
         '(11) 97777-3333',
         'ana.costa@email.com',
         'Rua São Paulo',
         '789',
         'Jardim Paulista',
         'São Paulo',
         '04567-890',
         'Casa',
         '1990-08-20',
         'Professora',
         'Educação, Cultura'
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
    link.setAttribute('download', 'modelo_importacao_municipes.csv');
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
    if (newOpen) {
      setShowingResults(false);
    }
  };

  // Função para voltar ao início do processo
  const handleStartOver = () => {
    setShowingResults(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calcular estatísticas dos resultados
  const successCount = importResults?.filter(r => r.success).length || 0;
  const errorCount = importResults?.filter(r => !r.success).length || 0;
  const totalCount = importResults?.length || 0;
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
            Como Importar Munícipes via CSV
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
                        : 'Importando munícipes...'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {importProgress?.fase === 'geocodificando' 
                        ? `Buscando coordenadas GPS: ${importProgress?.atual || 0} de ${importProgress?.total || 0}`
                        : `Processando: ${importProgress?.atual || 0} de ${importProgress?.total || 0} munícipes`
                      }
                    </p>
                  </div>
                </div>
                {importProgress && (
                  <div className="space-y-2">
                    <Progress 
                      value={(importProgress.atual / importProgress.total) * 100} 
                      className="h-2" 
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {importProgress.fase === 'geocodificando' ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Fase 2: Geocodificação
                          </span>
                        ) : (
                          'Fase 1: Importação'
                        )}
                      </span>
                      <span>{Math.round((importProgress.atual / importProgress.total) * 100)}%</span>
                    </div>
                  </div>
                )}
                {!importProgress && <Progress value={undefined} className="h-2" />}
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
                        ? `${successCount} munícipes importados com sucesso${errorCount > 0 ? `, ${errorCount} com erro` : ''}.`
                        : `Nenhum munícipe importado. ${errorCount} erros encontrados.`
                      }
                    </p>
                  </div>
                </div>
                
                {/* Badges de resumo */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    ✅ {successCount} importados
                  </Badge>
                  {geocodificadosCount > 0 && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      📍 {geocodificadosCount} geocodificados
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                      ❌ {errorCount} erros
                    </Badge>
                  )}
                </div>

                {/* Detalhes dos resultados (limitado a 10 itens) */}
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {importResults.slice(0, 10).map((result, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                      {result.success ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                          <span className="truncate">{result.nome}</span>
                          {result.geocodificado && (
                            <Badge variant="outline" className="text-xs ml-auto flex-shrink-0">
                              <MapPin className="h-3 w-3 mr-1" />
                              GPS
                            </Badge>
                          )}
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                          <span className="truncate">{result.nome}</span>
                          <span className="text-red-500 text-xs ml-auto flex-shrink-0">{result.error}</span>
                        </>
                      )}
                    </div>
                  ))}
                  {(importResults?.length || 0) > 10 && (
                    <p className="text-xs text-muted-foreground pt-2">
                      ... e mais {(importResults?.length || 0) - 10} registros
                    </p>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleStartOver}>
                    Importar Outro Arquivo
                  </Button>
                  <Button size="sm" onClick={() => setOpen(false)}>
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
                            Mantenha os cabeçalhos da primeira linha.
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

              {/* Info sobre geocodificação */}
              <Card className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">Georeferenciamento Automático</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Após a importação, o sistema buscará automaticamente as coordenadas GPS de cada munícipe 
                        usando o endereço informado, permitindo visualizá-los no mapa. Para melhores resultados:
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
                <h3 className="text-lg font-semibold">Campos Disponíveis</h3>
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span><strong>nome</strong> (obrigatório)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>telefone</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>email</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span>logradouro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span>numero</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span>bairro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span>cidade</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span>cep</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>complemento</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>data_nascimento (AAAA-MM-DD)</span>
                      </div>
                      <div className="flex items-center gap-2 md:col-span-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>observacoes</span>
                      </div>
                       <div className="flex items-center gap-2 md:col-span-2">
                         <FileText className="h-4 w-4 text-muted-foreground" />
                         <span>tag (use vírgula para múltiplas tags: "Tag1, Tag2")</span>
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
                  <p>• O campo <strong>nome</strong> é obrigatório - munícipes sem nome não serão importados</p>
                  <p>• Datas devem estar no formato DD/MM/AAAA (ex: 15/05/1985) ou DD/MM/AA (ex: 15/05/85)</p>
                  <p>• Se um campo estiver vazio, deixe a célula em branco</p>
                   <p>• O campo <strong>tag</strong> deve conter o nome exato de uma tag já cadastrada no sistema</p>
                   <p>• Para múltiplas tags, separe-as com vírgula: "Tag1, Tag2, Tag3"</p>
                   <p>• Exemplo de múltiplas tags: "Família, Idoso" ou "Empresário, Comércio"</p>
                   <p>• O arquivo modelo usa ponto e vírgula (;) como separador de colunas</p>
                   <p>• Mantenha a codificação UTF-8 ao salvar o arquivo</p>
                   <p>• O sistema mostrará quantos munícipes foram importados e geocodificados</p>
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
