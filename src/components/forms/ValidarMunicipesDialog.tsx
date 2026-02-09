import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Users, Plus, ArrowRight, Check, ChevronsUpDown, UserPlus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useMunicipesSelect } from '@/hooks/useMunicipesSelect';
import { cn } from '@/lib/utils';

interface MunicipeNaoEncontrado {
  nome: string;
  demandasCount: number;
  demandas: string[];
}

interface DecisaoMunicipe {
  nomeOriginal: string;
  tipo: 'existente' | 'novo' | 'descartar';
  municipeId?: string;
  novoNome?: string;
  // Campos expandidos para criação completa
  telefone?: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  data_nascimento?: string;
  observacoes?: string;
}

interface ValidarMunicipesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  municipesNaoEncontrados: MunicipeNaoEncontrado[];
  municipesExistentes: Array<{ id: string; nome: string }>;
  onDecisoes: (decisoes: DecisaoMunicipe[]) => void;
}

export function ValidarMunicipesDialog({
  open,
  onOpenChange,
  municipesNaoEncontrados,
  municipesExistentes,
  onDecisoes
}: ValidarMunicipesDialogProps) {
  const [decisoes, setDecisoes] = useState<Record<string, DecisaoMunicipe>>({});
  const [expandedForms, setExpandedForms] = useState<Record<string, boolean>>({});
  const [openComboboxes, setOpenComboboxes] = useState<Record<string, boolean>>({});
  
  // Hook para carregar todos os munícipes em lotes
  const { data: allMunicipes = [], isLoading } = useMunicipesSelect();

  const handleDecisao = (nomeOriginal: string, decisao: Partial<DecisaoMunicipe>) => {
    setDecisoes(prev => ({
      ...prev,
      [nomeOriginal]: {
        ...prev[nomeOriginal],
        nomeOriginal,
        ...decisao
      }
    }));
  };

  const toggleExpandedForm = (nomeOriginal: string) => {
    setExpandedForms(prev => ({
      ...prev,
      [nomeOriginal]: !prev[nomeOriginal]
    }));
  };

  const setComboboxOpen = (nomeOriginal: string, open: boolean) => {
    setOpenComboboxes(prev => ({
      ...prev,
      [nomeOriginal]: open
    }));
  };

  const handleConfirmar = () => {
    const decisoesList = municipesNaoEncontrados.map(m => {
      const decisao = decisoes[m.nome];
      if (!decisao) {
        // Se não foi decidido, criar novo munícipe por padrão
        return {
          nomeOriginal: m.nome,
          tipo: 'novo' as const,
          novoNome: m.nome
        };
      }
      return decisao;
    });

    // Validar se todas as decisões estão completas
    const invalidas = decisoesList.filter(d => {
      // Priorizar vinculação: só aceitar "novo" se não há munícipe selecionado
      if (d.tipo === 'existente' && !d.municipeId) return true;
      if (d.tipo === 'novo' && !d.novoNome?.trim()) return true;
      if (d.tipo === 'descartar') return false; // Descarte é sempre válido
      return false;
    });

    if (invalidas.length > 0) {
      toast({
        title: "Erro",
        description: "Por favor, complete todas as decisões antes de continuar.",
        variant: "destructive"
      });
      return;
    }

    onDecisoes(decisoesList);
    onOpenChange(false);
  };

  const handleCriarTodos = () => {
    const decisoesList = municipesNaoEncontrados.map(m => ({
      nomeOriginal: m.nome,
      tipo: 'novo' as const,
      novoNome: m.nome
    }));
    onDecisoes(decisoesList);
    onOpenChange(false);
  };

  if (municipesNaoEncontrados.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Validar Munícipes Não Encontrados
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {municipesNaoEncontrados.length} munícipes não foram encontrados no sistema. 
            Revise e decida se deseja vincular a munícipes existentes ou criar novos.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Lista de munícipes não encontrados */}
          <div className="space-y-3">
            {municipesNaoEncontrados.map((municipe, index) => {
              const decisao = decisoes[municipe.nome];
              
              return (
                <Card key={index} className="border-l-4 border-l-orange-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {municipe.nome}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {municipe.demandasCount} demanda{municipe.demandasCount > 1 ? 's' : ''}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDecisao(municipe.nome, { tipo: 'descartar' })}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          title="Descartar demandas deste munícipe"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Demandas: {municipe.demandas.slice(0, 2).join(', ')}
                      {municipe.demandas.length > 2 && ` e mais ${municipe.demandas.length - 2}...`}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Mostrar se foi descartado */}
                      {decisao?.tipo === 'descartar' ? (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                          <div className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-4 w-4" />
                            <span className="text-sm font-medium">Demandas descartadas</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            As {municipe.demandasCount} demandas deste munícipe serão ignoradas na importação.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDecisoes(prev => {
                              const newDecisoes = {...prev};
                              delete newDecisoes[municipe.nome];
                              return newDecisoes;
                            })}
                            className="mt-2 h-6 text-xs"
                          >
                            Desfazer descarte
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Combobox para vincular a munícipe existente */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Vincular a munícipe existente:</Label>
                        <Popover 
                          open={openComboboxes[municipe.nome]} 
                          onOpenChange={(open) => setComboboxOpen(municipe.nome, open)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openComboboxes[municipe.nome]}
                              className="w-full justify-between h-9"
                            >
                              {decisao?.tipo === 'existente' && decisao.municipeId
                                ? allMunicipes.find(m => m.id === decisao.municipeId)?.nome
                                : "Buscar e selecionar munícipe..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" side="bottom" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Digite para buscar munícipe..." 
                                className="h-9"
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {isLoading ? "Carregando..." : "Nenhum munícipe encontrado."}
                                </CommandEmpty>
                                <CommandGroup>
                                  {allMunicipes.map((m) => (
                                    <CommandItem
                                      key={m.id}
                                      value={m.nome}
                                      onSelect={() => {
                                        handleDecisao(municipe.nome, {
                                          tipo: 'existente',
                                          municipeId: m.id
                                        });
                                        setComboboxOpen(municipe.nome, false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          decisao?.municipeId === m.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {m.nome}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Opção criar novo munícipe */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Ou criar novo munícipe:</Label>
                          {decisao?.tipo === 'novo' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleExpandedForm(municipe.nome)}
                              className="h-6 px-2 text-xs"
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              {expandedForms[municipe.nome] ? 'Ocultar' : 'Expandir'} formulário
                            </Button>
                          )}
                        </div>
                        <Input
                          placeholder="Nome do novo munícipe"
                          value={decisao?.tipo === 'novo' ? decisao.novoNome || '' : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value.trim()) {
                              handleDecisao(municipe.nome, {
                                tipo: 'novo',
                                novoNome: value
                              });
                            }
                          }}
                          onFocus={() => {
                            if (!decisao || decisao.tipo !== 'novo') {
                              handleDecisao(municipe.nome, {
                                tipo: 'novo',
                                novoNome: municipe.nome
                              });
                            }
                          }}
                          className="h-9"
                        />
                      </div>

                      {/* Formulário expandido para criação completa */}
                      {decisao?.tipo === 'novo' && expandedForms[municipe.nome] && (
                        <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Dados completos do munícipe:
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Telefone</Label>
                              <Input
                                placeholder="(11) 99999-9999"
                                value={decisao.telefone || ''}
                                onChange={(e) => handleDecisao(municipe.nome, {
                                  ...decisao,
                                  telefone: e.target.value
                                })}
                                className="h-8"
                              />
                            </div>
                            
                            <div>
                              <Label className="text-xs">Email</Label>
                              <Input
                                type="email"
                                placeholder="email@exemplo.com"
                                value={decisao.email || ''}
                                onChange={(e) => handleDecisao(municipe.nome, {
                                  ...decisao,
                                  email: e.target.value
                                })}
                                className="h-8"
                              />
                            </div>
                            
                            <div className="md:col-span-2">
                              <Label className="text-xs">Endereço (com número)</Label>
                              <Input
                                placeholder="Rua, Avenida..., 123"
                                value={decisao.endereco || ''}
                                onChange={(e) => handleDecisao(municipe.nome, {
                                  ...decisao,
                                  endereco: e.target.value
                                })}
                                className="h-8"
                              />
                            </div>
                            
                            <div>
                              <Label className="text-xs">Bairro</Label>
                              <Input
                                placeholder="Nome do bairro"
                                value={decisao.bairro || ''}
                                onChange={(e) => handleDecisao(municipe.nome, {
                                  ...decisao,
                                  bairro: e.target.value
                                })}
                                className="h-8"
                              />
                            </div>
                            
                            <div>
                              <Label className="text-xs">Cidade</Label>
                              <Input
                                placeholder="Cidade"
                                value={decisao.cidade || ''}
                                onChange={(e) => handleDecisao(municipe.nome, {
                                  ...decisao,
                                  cidade: e.target.value
                                })}
                                className="h-8"
                              />
                            </div>
                            
                            <div>
                              <Label className="text-xs">CEP</Label>
                              <Input
                                placeholder="09000-000"
                                value={decisao.cep || ''}
                                onChange={(e) => handleDecisao(municipe.nome, {
                                  ...decisao,
                                  cep: e.target.value
                                })}
                                className="h-8"
                              />
                            </div>
                            
                            <div>
                              <Label className="text-xs">Data de Nascimento</Label>
                              <Input
                                type="date"
                                value={decisao.data_nascimento || ''}
                                onChange={(e) => handleDecisao(municipe.nome, {
                                  ...decisao,
                                  data_nascimento: e.target.value
                                })}
                                className="h-8"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-xs">Observações</Label>
                            <Textarea
                              placeholder="Observações adicionais..."
                              value={decisao.observacoes || ''}
                              onChange={(e) => handleDecisao(municipe.nome, {
                                ...decisao,
                                observacoes: e.target.value
                              })}
                              className="h-16 resize-none"
                            />
                          </div>
                        </div>
                      )}
                        </>
                      )}
                    </div>

                    {/* Indicador de decisão */}
                    {decisao && decisao.tipo !== 'descartar' && (
                      <div className="mt-3 p-2 bg-muted rounded text-xs flex items-center gap-2">
                        <ArrowRight className="h-3 w-3" />
                        {decisao.tipo === 'existente' ? (
                          <span>Será vinculado ao munícipe existente</span>
                        ) : (
                          <span>Será criado como: "{decisao.novoNome}"</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleCriarTodos}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Todos Como Novos
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar}>
              Confirmar Decisões
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
