import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileText, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ImportCSVDialogProps {
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isImporting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export function ImportCSVDialog({ onFileSelect, isImporting, fileInputRef }: ImportCSVDialogProps) {
  const [open, setOpen] = useState(false);

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
      'observacoes'
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
        'Munícipe cadastrada em 2024'
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
        'Comerciante local'
      ]
    ];

    const csvContent = [
      headers.join(','),
      ...exampleData.map(row => 
        row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Como Importar Munícipes via CSV
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
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
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>logradouro</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>numero</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>bairro</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>cidade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dicas importantes */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Dicas Importantes</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• O campo <strong>nome</strong> é obrigatório - munícipes sem nome não serão importados</p>
              <p>• Datas devem estar no formato AAAA-MM-DD (ex: 1985-05-15)</p>
              <p>• Se um campo estiver vazio, deixe a célula em branco</p>
              <p>• O sistema mostrará quantos munícipes foram importados com sucesso</p>
              <p>• Campos com erro serão ignorados, mas o munícipe ainda será criado</p>
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