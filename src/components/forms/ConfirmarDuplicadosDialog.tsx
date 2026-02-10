import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, ArrowRight, RefreshCw, Plus, Check, Phone, User } from "lucide-react";

export interface DuplicateMatch {
  csvIndex: number;
  csvData: any; // dados do CSV
  existingMunicipe: any; // dados do banco
  action: 'atualizar' | 'criar_novo';
}

interface ConfirmarDuplicadosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
  onConfirm: (resolved: DuplicateMatch[]) => void;
}

export function ConfirmarDuplicadosDialog({
  open,
  onOpenChange,
  duplicates: initialDuplicates,
  onConfirm
}: ConfirmarDuplicadosDialogProps) {
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>(initialDuplicates);

  useEffect(() => {
    if (initialDuplicates.length > 0) {
      setDuplicates(initialDuplicates);
    }
  }, [initialDuplicates]);

  const setAction = (index: number, action: 'atualizar' | 'criar_novo') => {
    setDuplicates(prev => prev.map((d, i) => 
      i === index ? { ...d, action } : d
    ));
  };

  const setAllAction = (action: 'atualizar' | 'criar_novo') => {
    setDuplicates(prev => prev.map(d => ({ ...d, action })));
  };

  const updateCount = duplicates.filter(d => d.action === 'atualizar').length;
  const createCount = duplicates.filter(d => d.action === 'criar_novo').length;

  const handleConfirm = () => {
    onConfirm(duplicates);
  };

  // Helper para mostrar diferenças de um campo
  const FieldComparison = ({ label, existing, novo }: { label: string; existing?: string | null; novo?: string | null }) => {
    if (!novo && !existing) return null;
    const isDifferent = novo && existing && novo.trim().toLowerCase() !== existing.trim().toLowerCase();
    const isNew = novo && !existing;
    
    if (!novo && existing) return null;
    
    return (
      <div className="text-xs grid grid-cols-[80px_1fr] gap-1">
        <span className="text-muted-foreground font-medium">{label}:</span>
        <div className="flex items-center gap-1 flex-wrap">
          {existing && (
            <span className={isDifferent ? 'line-through text-muted-foreground' : 'text-foreground'}>
              {existing}
            </span>
          )}
          {(isDifferent || isNew) && (
            <>
              {isDifferent && <ArrowRight className="h-3 w-3 text-blue-500 flex-shrink-0" />}
              <span className="text-blue-600 dark:text-blue-400 font-medium">{novo}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            Munícipes Duplicados Encontrados
          </DialogTitle>
        </DialogHeader>

        <div className="flex-shrink-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            Foram encontrados <strong>{duplicates.length} munícipe{duplicates.length > 1 ? 's' : ''}</strong> na 
            planilha com telefone já cadastrado no sistema. Para cada um, escolha a ação desejada:
          </p>

          {/* Ações em massa */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAllAction('atualizar')}
              className="gap-1 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Marcar todos como "Atualizar"
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAllAction('criar_novo')}
              className="gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              Marcar todos como "Criar Novo"
            </Button>
            <div className="ml-auto flex gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                <RefreshCw className="h-3 w-3 mr-1" />
                {updateCount} atualizar
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <Plus className="h-3 w-3 mr-1" />
                {createCount} criar novo
              </Badge>
            </div>
          </div>
        </div>

        <Separator className="flex-shrink-0" />

        {/* Lista scrollável */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
          <div className="space-y-3 pb-2">
            {duplicates.map((dup, index) => (
              <div 
                key={index} 
                className={`border rounded-lg p-4 transition-all ${
                  dup.action === 'atualizar' 
                    ? 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20' 
                    : 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20'
                }`}
              >
                {/* Header com nome e telefone */}
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{dup.csvData.nome}</span>
                  <Badge variant="outline" className="text-xs gap-1 flex-shrink-0">
                    <Phone className="h-3 w-3" />
                    {dup.csvData.telefone}
                  </Badge>
                </div>

                {/* Toggle de ação - segmented control */}
                <div className="flex rounded-lg border overflow-hidden mb-3">
                  <button
                    onClick={() => setAction(index, 'atualizar')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all ${
                      dup.action === 'atualizar'
                        ? 'bg-blue-500 text-white'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Atualizar cadastro existente
                  </button>
                  <button
                    onClick={() => setAction(index, 'criar_novo')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all ${
                      dup.action === 'criar_novo'
                        ? 'bg-green-500 text-white'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Plus className="h-3 w-3" />
                    Criar novo cadastro
                  </button>
                </div>

                {/* Comparação de dados (quando atualizar) */}
                {dup.action === 'atualizar' && (
                  <div className="space-y-1 bg-background/50 rounded p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Cadastro existente: <strong>{dup.existingMunicipe.nome}</strong> — será atualizado com os dados da planilha:
                    </p>
                    <FieldComparison 
                      label="Nome" 
                      existing={dup.existingMunicipe.nome} 
                      novo={dup.csvData.nome} 
                    />
                    <FieldComparison 
                      label="Email" 
                      existing={dup.existingMunicipe.email} 
                      novo={dup.csvData.email} 
                    />
                    <FieldComparison 
                      label="Endereço" 
                      existing={dup.existingMunicipe.endereco} 
                      novo={dup.csvData.logradouro ? `${dup.csvData.logradouro}${dup.csvData.numero ? ', ' + dup.csvData.numero : ''}${dup.csvData.complemento ? ' - ' + dup.csvData.complemento : ''}` : undefined} 
                    />
                    <FieldComparison 
                      label="Bairro" 
                      existing={dup.existingMunicipe.bairro} 
                      novo={dup.csvData.bairro} 
                    />
                    <FieldComparison 
                      label="Cidade" 
                      existing={dup.existingMunicipe.cidade} 
                      novo={dup.csvData.cidade} 
                    />
                    <FieldComparison 
                      label="CEP" 
                      existing={dup.existingMunicipe.cep} 
                      novo={dup.csvData.cep} 
                    />
                    <FieldComparison 
                      label="Nascimento" 
                      existing={dup.existingMunicipe.data_nascimento} 
                      novo={dup.csvData.data_nascimento} 
                    />
                    <FieldComparison 
                      label="Observações" 
                      existing={dup.existingMunicipe.observacoes} 
                      novo={dup.csvData.observacoes} 
                    />
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 italic">
                      Apenas campos com dados novos na planilha serão atualizados. Campos vazios não apagam os existentes.
                    </p>
                  </div>
                )}

                {dup.action === 'criar_novo' && (
                  <p className="text-xs text-green-600 dark:text-green-400 italic">
                    Um novo cadastro será criado, mesmo com o telefone já existente no sistema.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar Importação
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <Check className="h-4 w-4" />
            Confirmar e Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
