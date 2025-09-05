import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, User, FileText, Clock, AlertTriangle, Edit, Bot } from "lucide-react";
import { formatDateTime, formatDateOnly } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DemandaAtividadesTab } from "./DemandaAtividadesTab";
import { useNavigate } from "react-router-dom";

interface ViewDemandaDialogProps {
  demanda: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (demanda: any) => void;
}

export function ViewDemandaDialog({ demanda, open, onOpenChange, onEdit }: ViewDemandaDialogProps) {
  const navigate = useNavigate();
  const { data: responsaveis = [] } = useQuery({
    queryKey: ['responsaveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ['anexos', demanda?.id],
    queryFn: async () => {
      if (!demanda?.id) return [];
      const { data, error } = await supabase
        .from('anexos')
        .select('*')
        .eq('demanda_id', demanda.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!demanda?.id && open
  });

  if (!demanda) return null;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberta': return 'Aberta';
      case 'em_andamento': return 'Em Andamento';
      case 'aguardando': return 'Aguardando';
      case 'resolvida': return 'Resolvida';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'aberta': return 'default';
      case 'em_andamento': return 'secondary';
      case 'aguardando': return 'outline';
      case 'resolvida': return 'default';
      case 'cancelada': return 'destructive';
      default: return 'secondary';
    }
  };

  const getPrioridadeLabel = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'Baixa';
      case 'media': return 'Média';
      case 'alta': return 'Alta';
      case 'urgente': return 'Urgente';
      default: return prioridade;
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'hsl(var(--chart-4))';
      case 'media': return 'hsl(var(--chart-2))';
      case 'alta': return 'hsl(var(--chart-1))';
      case 'urgente': return 'hsl(var(--chart-5))';
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  const isOverdue = (dataPrazo: string | null) => {
    if (!dataPrazo) return false;
    const today = new Date();
    const prazo = new Date(dataPrazo);
    return today > prazo;
  };

  const getResponsavelNome = (responsavelId: string | undefined) => {
    if (!responsavelId) return 'Não definido';
    const responsavel = responsaveis.find(r => r.id === responsavelId);
    return responsavel?.nome || 'Não definido';
  };

  const downloadAnexo = async (anexo: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('demanda-anexos')
        .download(anexo.url_arquivo);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = anexo.nome_arquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
    }
  };

  const openAssessorIA = () => {
    // Construir endereço completo
    const enderecoCompleto = [
      demanda.logradouro && `${demanda.logradouro}${demanda.numero ? `, ${demanda.numero}` : ''}`,
      demanda.bairro,
      demanda.cidade && `${demanda.cidade}${demanda.cep ? ` - ${demanda.cep}` : ''}`,
      demanda.complemento
    ].filter(Boolean).join(', ');

    // Construir prompt pré-estruturado
    const promptData = {
      titulo: demanda.titulo,
      descricao: demanda.descricao,
      endereco: enderecoCompleto,
      area: demanda.areas?.nome,
      municipe: demanda.municipes?.nome,
      protocolo: demanda.protocolo,
      observacoes: demanda.observacoes
    };

    // Navegar para o Assessor IA com os dados
    navigate('/assessor-ia', { state: { promptData } });
    onOpenChange(false); // Fechar modal
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <style>{`
          .mention-input__suggestions {
            position: fixed !important;
            z-index: 10000 !important;
          }
        `}</style>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Demanda #{demanda.protocolo}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detalhes" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
            <TabsTrigger value="anexos">Anexos ({anexos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{demanda.titulo}</CardTitle>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant={getStatusVariant(demanda.status)}>
                        {getStatusLabel(demanda.status)}
                      </Badge>
                      <Badge 
                        variant="outline"
                        style={{ 
                          borderColor: getPrioridadeColor(demanda.prioridade),
                          color: getPrioridadeColor(demanda.prioridade)
                        }}
                      >
                        {getPrioridadeLabel(demanda.prioridade)}
                      </Badge>
                      {isOverdue(demanda.data_prazo) && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Atrasada
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openAssessorIA}
                      className="bg-primary/10 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Assessor IA
                    </Button>
                    {onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(demanda)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Descrição</h4>
                  <p className="text-muted-foreground">{demanda.descricao}</p>
                </div>

                {demanda.observacoes && (
                  <div>
                    <h4 className="font-medium mb-2">Observações</h4>
                    <p className="text-muted-foreground">{demanda.observacoes}</p>
                  </div>
                )}

                {demanda.resolucao && (
                  <div>
                    <h4 className="font-medium mb-2">Resolução</h4>
                    <p className="text-muted-foreground">{demanda.resolucao}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Munícipe:</strong> {demanda.municipes?.nome || 'N/A'}
                      </span>
                    </div>

                    {demanda.areas?.nome && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          <strong>Área:</strong> {demanda.areas.nome}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Responsável:</strong> {getResponsavelNome(demanda.responsavel_id)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Criada em:</strong> {formatDateTime(demanda.created_at)}
                      </span>
                    </div>

                    {demanda.data_prazo && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          <strong>Prazo:</strong> {formatDateOnly(demanda.data_prazo)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {(demanda.logradouro || demanda.bairro || demanda.cidade) && (
                  <div>
                    <h4 className="font-medium mb-2">Endereço</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {demanda.logradouro && (
                        <p>{demanda.logradouro}{demanda.numero ? `, ${demanda.numero}` : ''}</p>
                      )}
                      {demanda.bairro && <p>{demanda.bairro}</p>}
                      {demanda.cidade && <p>{demanda.cidade}{demanda.cep ? ` - ${demanda.cep}` : ''}</p>}
                      {demanda.complemento && <p>{demanda.complemento}</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="atividades" className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <DemandaAtividadesTab demandaId={demanda.id} />
            </div>
          </TabsContent>

          <TabsContent value="anexos" className="space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
            {anexos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum anexo encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {anexos.map((anexo) => (
                  <Card key={anexo.id} className="cursor-pointer hover:bg-muted/50" onClick={() => downloadAnexo(anexo)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{anexo.nome_arquivo}</p>
                            <p className="text-sm text-muted-foreground">
                              {(anexo.tamanho_arquivo / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(anexo.created_at)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}