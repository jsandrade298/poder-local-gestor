import { useState, useRef, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Vote, 
  Upload, 
  Loader2, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  X,
  Download,
  Layers,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useDadosEleitorais, encontrarMelhorMatch } from '@/hooks/useDadosEleitorais';

// Interface para camada geográfica
interface CamadaGeografica {
  id: string;
  nome: string;
  geojson: {
    features: Array<{
      properties: Record<string, any>;
    }>;
  };
}

interface VotosUploadProps {
  camadas: CamadaGeografica[];
  getFeatureName: (properties: Record<string, any>) => string;
  onComplete?: () => void;
}

interface DadoPreview {
  nome: string;
  votos: number;
  status: 'encontrado' | 'sugestao' | 'nao_encontrado';
  sugestao?: string;
  similaridade?: number;
}

// Anos de eleição para seleção
const ANOS_ELEICAO = ['2024', '2022', '2020', '2018', '2016', '2014', '2012'];

// Cargos disponíveis
const CARGOS = [
  { value: 'vereador', label: 'Vereador(a)' },
  { value: 'prefeito', label: 'Prefeito(a)' },
  { value: 'deputado_estadual', label: 'Deputado(a) Estadual' },
  { value: 'deputado_federal', label: 'Deputado(a) Federal' },
  { value: 'senador', label: 'Senador(a)' },
  { value: 'governador', label: 'Governador(a)' },
  { value: 'presidente', label: 'Presidente' },
];

export function VotosUpload({ 
  camadas,
  getFeatureName,
  onComplete 
}: VotosUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [camadaSelecionada, setCamadaSelecionada] = useState<string>('');
  const [eleicao, setEleicao] = useState(ANOS_ELEICAO[0]);
  const [cargo, setCargo] = useState('vereador');
  const [dadosPreview, setDadosPreview] = useState<DadoPreview[]>([]);
  const [fileName, setFileName] = useState('');
  const [etapa, setEtapa] = useState<'selecao' | 'upload'>('selecao');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hook para importar dados (usa camada selecionada)
  const { importarDados } = useDadosEleitorais(camadaSelecionada || undefined);

  // Obter regiões da camada selecionada
  const regioesDisponiveis = useMemo(() => {
    if (!camadaSelecionada) return [];
    const camada = camadas.find(c => c.id === camadaSelecionada);
    if (!camada?.geojson?.features) return [];
    
    return camada.geojson.features
      .map(f => getFeatureName(f.properties))
      .filter(nome => nome && nome.trim() !== '')
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [camadaSelecionada, camadas, getFeatureName]);

  // Nome da camada selecionada
  const camadaNome = useMemo(() => {
    if (!camadaSelecionada) return '';
    return camadas.find(c => c.id === camadaSelecionada)?.nome || '';
  }, [camadaSelecionada, camadas]);

  // Estatísticas do preview
  const estatisticas = useMemo(() => {
    const encontrados = dadosPreview.filter(d => d.status === 'encontrado').length;
    const sugestoes = dadosPreview.filter(d => d.status === 'sugestao').length;
    const naoEncontrados = dadosPreview.filter(d => d.status === 'nao_encontrado').length;
    const totalVotos = dadosPreview.reduce((sum, d) => sum + d.votos, 0);

    return { encontrados, sugestoes, naoEncontrados, totalVotos };
  }, [dadosPreview]);

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setEtapa('selecao');
      setCamadaSelecionada('');
      setDadosPreview([]);
      setFileName('');
      setEleicao(ANOS_ELEICAO[0]);
      setCargo('vereador');
    }
  }, [isOpen]);

  const resetForm = () => {
    setDadosPreview([]);
    setFileName('');
    setEleicao(ANOS_ELEICAO[0]);
    setCargo('vereador');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
      setEtapa('selecao');
      setCamadaSelecionada('');
    }
  };

  // Gerar e baixar template CSV
  const handleDownloadTemplate = () => {
    if (regioesDisponiveis.length === 0) {
      toast.error('Nenhuma região disponível nesta camada');
      return;
    }

    // Criar conteúdo CSV com BOM para UTF-8
    const bom = '\uFEFF';
    const header = 'Região;Votos';
    const rows = regioesDisponiveis.map(regiao => `${regiao};`);
    const csvContent = bom + [header, ...rows].join('\n');

    // Criar blob e download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Nome do arquivo baseado na camada
    const nomeArquivo = `template_votos_${camadaNome.toLowerCase().replace(/\s+/g, '_')}.csv`;
    link.download = nomeArquivo;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Template baixado com ${regioesDisponiveis.length} regiões`);
  };

  // Avançar para etapa de upload
  const handleAvancar = () => {
    if (!camadaSelecionada) {
      toast.error('Selecione uma camada');
      return;
    }
    setEtapa('upload');
  };

  // Voltar para seleção
  const handleVoltar = () => {
    setEtapa('selecao');
    resetForm();
  };

  // Processar arquivo CSV/Excel
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.csv', '.xlsx', '.xls', '.txt'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(extension)) {
      toast.error('Por favor, envie um arquivo CSV ou Excel (.csv, .xlsx, .xls)');
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    try {
      let dados: Array<{ nome: string; votos: number }> = [];

      if (extension === '.csv' || extension === '.txt') {
        // Processar CSV
        const text = await file.text();
        dados = parseCSV(text);
      } else {
        // Processar Excel usando SheetJS (import dinâmico)
        try {
          const XLSX = await import('xlsx');
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer);
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];
          
          dados = parseExcelData(jsonData);
        } catch (xlsxError) {
          console.error('Erro ao carregar xlsx:', xlsxError);
          throw new Error('Para arquivos Excel, instale a dependência xlsx (npm install xlsx). Ou use um arquivo CSV.');
        }
      }

      if (dados.length === 0) {
        throw new Error('Nenhum dado encontrado no arquivo');
      }

      // Fazer match com regiões disponíveis
      const preview: DadoPreview[] = dados.map(item => {
        // Verificar match exato (normalizado)
        const matchExato = regioesDisponiveis.find(
          r => normalizarNome(r) === normalizarNome(item.nome)
        );

        if (matchExato) {
          return {
            nome: item.nome,
            votos: item.votos,
            status: 'encontrado' as const,
            sugestao: matchExato
          };
        }

        // Tentar match fuzzy
        const { match, similaridade } = encontrarMelhorMatch(item.nome, regioesDisponiveis);

        if (match) {
          return {
            nome: item.nome,
            votos: item.votos,
            status: 'sugestao' as const,
            sugestao: match,
            similaridade
          };
        }

        return {
          nome: item.nome,
          votos: item.votos,
          status: 'nao_encontrado' as const
        };
      });

      setDadosPreview(preview);
      toast.success(`${dados.length} linhas processadas`);

    } catch (error: any) {
      console.error('Erro ao processar arquivo:', error);
      toast.error(error.message || 'Erro ao processar arquivo');
      setDadosPreview([]);
      setFileName('');
    } finally {
      setIsLoading(false);
    }
  };

  // Aceitar sugestão de match
  const aceitarSugestao = (index: number) => {
    setDadosPreview(prev => prev.map((item, i) => {
      if (i === index && item.sugestao) {
        return { ...item, status: 'encontrado' as const };
      }
      return item;
    }));
  };

  // Rejeitar item
  const rejeitarItem = (index: number) => {
    setDadosPreview(prev => prev.filter((_, i) => i !== index));
  };

  // Confirmar importação
  const handleConfirm = async () => {
    const dadosValidos = dadosPreview
      .filter(d => d.status === 'encontrado' && d.sugestao)
      .map(d => ({
        nome: d.sugestao!,
        votos: d.votos
      }));

    if (dadosValidos.length === 0) {
      toast.error('Nenhum dado válido para importar');
      return;
    }

    try {
      await importarDados.mutateAsync({
        camadaId: camadaSelecionada,
        dados: dadosValidos,
        eleicao,
        cargo,
        regioesDisponiveis
      });

      setIsOpen(false);
      resetForm();
      setEtapa('selecao');
      setCamadaSelecionada('');
      onComplete?.();

    } catch (error) {
      console.error('Erro ao importar:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Vote className="h-3 w-3" />
          Importar Votos
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5" />
            Importar Dados Eleitorais
          </DialogTitle>
          <DialogDescription>
            {etapa === 'selecao' 
              ? 'Selecione a camada geográfica e baixe o template para preenchimento'
              : `Importando votos para: ${camadaNome}`
            }
          </DialogDescription>
        </DialogHeader>

        {/* ETAPA 1: Seleção de Camada */}
        {etapa === 'selecao' && (
          <div className="flex-1 space-y-4 py-4">
            {/* Seletor de Camada */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Camada Geográfica
              </Label>
              <Select value={camadaSelecionada} onValueChange={setCamadaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a camada..." />
                </SelectTrigger>
                <SelectContent>
                  {camadas.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      Nenhuma camada disponível
                    </SelectItem>
                  ) : (
                    camadas.map(camada => (
                      <SelectItem key={camada.id} value={camada.id}>
                        {camada.nome} ({camada.geojson?.features?.length || 0} regiões)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Info da camada selecionada */}
            {camadaSelecionada && regioesDisponiveis.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  A camada <strong>{camadaNome}</strong> possui{' '}
                  <strong>{regioesDisponiveis.length} regiões</strong>.
                  Baixe o template abaixo para garantir que os nomes estejam corretos.
                </AlertDescription>
              </Alert>
            )}

            {/* Configurações de Eleição */}
            {camadaSelecionada && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ano da Eleição</Label>
                  <Select value={eleicao} onValueChange={setEleicao}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANOS_ELEICAO.map(ano => (
                        <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select value={cargo} onValueChange={setCargo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARGOS.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Botão Download Template */}
            {camadaSelecionada && regioesDisponiveis.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Template para Preenchimento</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Baixe a planilha com os nomes das regiões já preenchidos. 
                      Você só precisa adicionar os votos na segunda coluna.
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="h-4 w-4" />
                  Baixar Template CSV ({regioesDisponiveis.length} regiões)
                </Button>
              </div>
            )}

            {/* Lista de regiões (preview) */}
            {camadaSelecionada && regioesDisponiveis.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Regiões na camada (primeiras 10):
                </Label>
                <div className="flex flex-wrap gap-1">
                  {regioesDisponiveis.slice(0, 10).map((regiao, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {regiao}
                    </Badge>
                  ))}
                  {regioesDisponiveis.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{regioesDisponiveis.length - 10} mais
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ETAPA 2: Upload */}
        {etapa === 'upload' && (
          <div className="flex-1 space-y-4 py-4 flex flex-col min-h-0">
            {/* Info resumida */}
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline" className="gap-1">
                <Layers className="h-3 w-3" />
                {camadaNome}
              </Badge>
              <Badge variant="outline">{eleicao}</Badge>
              <Badge variant="outline">
                {CARGOS.find(c => c.value === cargo)?.label}
              </Badge>
            </div>

            {/* Upload de arquivo */}
            <div className="space-y-2">
              <Label>Arquivo de Votos</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileChange}
                disabled={isLoading}
                className="hidden"
                id="votos-file-input"
              />
              <label
                htmlFor="votos-file-input"
                className={`
                  flex flex-col items-center justify-center w-full h-24
                  border-2 border-dashed rounded-lg cursor-pointer
                  ${isLoading ? 'bg-muted' : 'hover:bg-muted/50'}
                  ${fileName ? 'border-green-500 bg-green-50' : 'border-muted-foreground/25'}
                `}
              >
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : fileName ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-green-600 mb-1" />
                    <span className="text-sm font-medium">{fileName}</span>
                    <span className="text-xs text-muted-foreground">
                      Clique para trocar
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-sm text-muted-foreground">
                      Clique para enviar arquivo
                    </span>
                    <span className="text-xs text-muted-foreground">
                      CSV ou Excel
                    </span>
                  </>
                )}
              </label>
            </div>

            {/* Estatísticas do Preview */}
            {dadosPreview.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {estatisticas.encontrados} encontrados
                </Badge>
                {estatisticas.sugestoes > 0 && (
                  <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800">
                    <AlertTriangle className="h-3 w-3" />
                    {estatisticas.sugestoes} sugestões
                  </Badge>
                )}
                {estatisticas.naoEncontrados > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {estatisticas.naoEncontrados} não encontrados
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1 ml-auto">
                  🗳️ {estatisticas.totalVotos.toLocaleString('pt-BR')} votos
                </Badge>
              </div>
            )}

            {/* Tabela de Preview */}
            {dadosPreview.length > 0 && (
              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Região (Planilha)</TableHead>
                      <TableHead className="w-[30%]">Match</TableHead>
                      <TableHead className="text-right">Votos</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dadosPreview.map((item, index) => (
                      <TableRow key={index} className={
                        item.status === 'nao_encontrado' ? 'bg-red-50' :
                        item.status === 'sugestao' ? 'bg-yellow-50' : ''
                      }>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell>
                          {item.status === 'encontrado' && (
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {item.sugestao}
                            </span>
                          )}
                          {item.status === 'sugestao' && (
                            <span className="text-yellow-700 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {item.sugestao}
                              <span className="text-xs text-muted-foreground">
                                ({Math.round((item.similaridade || 0) * 100)}%)
                              </span>
                            </span>
                          )}
                          {item.status === 'nao_encontrado' && (
                            <span className="text-red-600 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Não encontrado
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.votos.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {item.status === 'sugestao' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-green-600"
                                onClick={() => aceitarSugestao(index)}
                                title="Aceitar sugestão"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-600"
                              onClick={() => rejeitarItem(index)}
                              title="Remover"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            {/* Dica */}
            {dadosPreview.length === 0 && (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Dica:</strong> Use o template baixado na etapa anterior 
                  para garantir que os nomes das regiões estejam corretos.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {etapa === 'selecao' ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAvancar} 
                disabled={!camadaSelecionada || regioesDisponiveis.length === 0}
              >
                Avançar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleVoltar}>
                Voltar
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={
                  dadosPreview.filter(d => d.status === 'encontrado').length === 0 || 
                  importarDados.isPending
                }
              >
                {importarDados.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Vote className="h-4 w-4 mr-2" />
                    Importar {estatisticas.encontrados} regiões
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

/**
 * Normaliza nome para matching
 */
function normalizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Parse CSV text para array de dados
 */
function parseCSV(text: string): Array<{ nome: string; votos: number }> {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const result: Array<{ nome: string; votos: number }> = [];
  
  // Detectar separador (vírgula, ponto-e-vírgula ou tab)
  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : 
                   firstLine.includes('\t') ? '\t' : ',';

  // Pular header
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''));
    
    if (cols.length >= 2) {
      const nome = cols[0];
      // Tentar encontrar coluna numérica para votos
      let votos = 0;
      for (let j = 1; j < cols.length; j++) {
        const num = parseInt(cols[j].replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) {
          votos = num;
          break;
        }
      }

      if (nome && votos > 0) {
        result.push({ nome, votos });
      }
    }
  }

  return result;
}

/**
 * Parse dados do Excel para array de dados
 */
function parseExcelData(jsonData: any[]): Array<{ nome: string; votos: number }> {
  if (!jsonData.length) return [];

  const result: Array<{ nome: string; votos: number }> = [];
  
  // Detectar colunas (procurar por nome e votos)
  const primeiraLinha = jsonData[0];
  const colunas = Object.keys(primeiraLinha);
  
  // Encontrar coluna de nome
  const colunaRegiao = colunas.find(c => 
    /nome|região|regiao|bairro|municipio|município|cidade|local|zona|seção|secao/i.test(c)
  ) || colunas[0];

  // Encontrar coluna de votos
  const colunaVotos = colunas.find(c => 
    /voto|votos|qtd|quantidade|total|eleitores/i.test(c)
  ) || colunas.find(c => {
    // Se não encontrar por nome, procurar primeira coluna numérica
    const valor = primeiraLinha[c];
    return typeof valor === 'number' || /^\d+$/.test(String(valor));
  }) || colunas[1];

  for (const row of jsonData) {
    const nome = String(row[colunaRegiao] || '').trim();
    const votosRaw = row[colunaVotos];
    const votos = typeof votosRaw === 'number' 
      ? votosRaw 
      : parseInt(String(votosRaw).replace(/\D/g, ''), 10);

    if (nome && !isNaN(votos) && votos > 0) {
      result.push({ nome, votos });
    }
  }

  return result;
}
