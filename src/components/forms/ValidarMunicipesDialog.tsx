import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Plus, ArrowRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MunicipeNaoEncontrado {
  nome: string;
  demandasCount: number;
  demandas: string[];
}

interface DecisaoMunicipe {
  nomeOriginal: string;
  tipo: 'existente' | 'novo';
  municipeId?: string;
  novoNome?: string;
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
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar munícipes existentes baseado na busca
  const municipesFiltrados = municipesExistentes.filter(m =>
    m.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      if (d.tipo === 'existente' && !d.municipeId) return true;
      if (d.tipo === 'novo' && !d.novoNome?.trim()) return true;
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
          {/* Busca de munícipes existentes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar Munícipes Existentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Digite o nome para buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-2"
              />
              {searchTerm && (
                <div className="max-h-40 overflow-auto space-y-1">
                  {municipesFiltrados.slice(0, 10).map(m => (
                    <div key={m.id} className="text-sm p-2 bg-muted rounded">
                      {m.nome}
                    </div>
                  ))}
                  {municipesFiltrados.length > 10 && (
                    <div className="text-xs text-muted-foreground p-2">
                      ... e mais {municipesFiltrados.length - 10} resultados
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

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
                      <Badge variant="secondary">
                        {municipe.demandasCount} demanda{municipe.demandasCount > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Demandas: {municipe.demandas.slice(0, 2).join(', ')}
                      {municipe.demandas.length > 2 && ` e mais ${municipe.demandas.length - 2}...`}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Opção 1: Munícipe Existente */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Vincular a munícipe existente:</Label>
                        <Select
                          value={decisao?.tipo === 'existente' ? decisao.municipeId : ''}
                          onValueChange={(value) => handleDecisao(municipe.nome, {
                            tipo: 'existente',
                            municipeId: value
                          })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecionar munícipe existente..." />
                          </SelectTrigger>
                          <SelectContent>
                            {municipesFiltrados.slice(0, 50).map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Opção 2: Criar Novo */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Ou criar novo munícipe:</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Nome do novo munícipe"
                            value={decisao?.tipo === 'novo' ? decisao.novoNome || municipe.nome : municipe.nome}
                            onChange={(e) => handleDecisao(municipe.nome, {
                              tipo: 'novo',
                              novoNome: e.target.value
                            })}
                            className="h-8"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDecisao(municipe.nome, {
                              tipo: 'novo',
                              novoNome: municipe.nome
                            })}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Indicador de decisão */}
                    {decisao && (
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