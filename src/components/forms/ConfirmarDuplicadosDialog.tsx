import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Users, ArrowRight, RefreshCw, Plus, Check, Phone, User, MapPin } from "lucide-react";

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

  // Atualizar quando props mudam
  useEffect(() => {
    if (initialDuplicates.length > 0) {
      setDuplicates(initialDuplicates);
    }
  }, [initialDuplicates]);

  const toggleAction = (index: number) => {
    setDuplicates(prev => prev.map((d, i) => 
      i === index 
        ? { ...d, action: d.action === 'atualizar' ? 'criar_novo' : 'atualizar' }
        : d
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
    
    if (!novo && existing) return null; // Se o CSV não tem dado, não mostrar
    
    return (
      <div className="text-xs grid grid-cols-[80px_1fr] gap-1">
        <span className="text-muted-foreground font-medium">{label}:</span>
        <div className="flex items-center gap-1">
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
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            Munícipes Duplicados Encontrados
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <p className="text-sm text-muted-foreground">
            Foram encontrados <strong>{duplicates.length} munícipe{duplicates.length > 1 ? 's' : ''}</strong> na 
            planilha com telefone já cadastrado no sistema. Escolha se deseja <strong>atualizar</strong> o 
            cadastro existente ou <strong>criar um novo</strong> registro.
          </p>

          {/* Ações em massa */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAllAction('atualizar')}
              className="gap-1 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Atualizar Todos
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAllAction('criar_novo')}
              className="gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              Criar Todos como Novos
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

          <ScrollArea className="flex-1 max-h-[400px] pr-4">
            <div className="space-y-3">
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
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{dup.csvData.nome}</span>
                      <Badge variant="outline" className="text-xs gap-1">
                        <Phone className="h-3 w-3" />
                        {dup.csvData.telefone}
                      </Badge>
                    </div>
                    <Button
                      variant={dup.action === 'atualizar' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleAction(index)}
                      className="gap-1 text-xs h-7"
                    >
                      {dup.action === 'atualizar' ? (
                        <>
                          <RefreshCw className="h-3 w-3" />
                          Atualizar
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          Criar Novo
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Comparação de dados */}
                  {dup.action === 'atualizar' && (
                    <div className="space-y-1 bg-background/50 rounded p-2">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Cadastro existente: <strong>{dup.existingMunicipe.nome}</strong>
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
                        Apenas campos com dados novos na planilha serão atualizados.
                      </p>
                    </div>
                  )}

                  {dup.action === 'criar_novo' && (
                    <p className="text-xs text-green-600 dark:text-green-400 italic">
                      Um novo cadastro será criado mesmo com o telefone já existente.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
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
