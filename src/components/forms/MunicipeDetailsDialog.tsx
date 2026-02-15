import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Calendar, 
  Mail, 
  MapPin, 
  Phone, 
  User, 
  FileText, 
  Edit,
  Clock,
  ClipboardList,
  ChevronRight,
  Instagram,
  ExternalLink
} from "lucide-react";
import { formatDateOnly, formatDateTime } from "@/lib/dateUtils";
import { MunicipeProntuarioTab } from "./MunicipeProntuarioTab";
import { EditMunicipeDialog } from "./EditMunicipeDialog";
import { MunicipeDemandasDialog } from "./MunicipeDemandasDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MunicipeDetailsDialogProps {
  municipe: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MunicipeDetailsDialog({ municipe, open, onOpenChange }: MunicipeDetailsDialogProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [demandasDialogOpen, setDemandasDialogOpen] = useState(false);

  // Buscar contagem de demandas do munícipe
  const { data: demandasCount = 0 } = useQuery({
    queryKey: ['municipe-demandas-count', municipe?.id],
    queryFn: async () => {
      if (!municipe?.id) return 0;
      const { count, error } = await supabase
        .from('demandas')
        .select('*', { count: 'exact', head: true })
        .eq('municipe_id', municipe.id);
      
      if (error) return 0;
      return count || 0;
    },
    enabled: !!municipe?.id && open
  });

  // Buscar contagem de atividades do prontuário
  const { data: atividadesCount = 0 } = useQuery({
    queryKey: ['municipe-atividades-count', municipe?.id],
    queryFn: async () => {
      if (!municipe?.id) return 0;
      const { count, error } = await supabase
        .from('municipe_atividades')
        .select('*', { count: 'exact', head: true })
        .eq('municipe_id', municipe.id);
      
      if (error) return 0;
      return count || 0;
    },
    enabled: !!municipe?.id && open
  });

  if (!municipe) return null;

  // Processar tags - pode vir como municipe_tags ou tags
  const tags = municipe.municipe_tags?.map((mt: any) => mt.tags).filter(Boolean) || 
               municipe.tags || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {municipe.nome}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="dados" className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="prontuario">
                Prontuário ({atividadesCount})
              </TabsTrigger>
            </TabsList>

            {/* Aba de Dados */}
            <TabsContent value="dados" className="space-y-4 overflow-y-auto max-h-[calc(90vh-200px)] pr-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{municipe.nome}</CardTitle>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {tags.map((tag: any) => (
                            <Badge 
                              key={tag.id} 
                              variant="secondary"
                              style={{ 
                                backgroundColor: `${tag.cor}20`,
                                borderColor: tag.cor,
                                color: tag.cor
                              }}
                            >
                              {tag.nome}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditDialogOpen(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Grid de informações principais */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Coluna 1 - Informações Pessoais e Contato */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                          <User className="h-4 w-4" />
                          Informações Pessoais
                        </h4>
                        <div className="space-y-3 pl-6">
                          {municipe.data_nascimento && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                <strong>Nascimento:</strong> {formatDateOnly(municipe.data_nascimento)}
                              </span>
                            </div>
                          )}
                          {!municipe.data_nascimento && (
                            <p className="text-sm text-muted-foreground">Nenhuma informação adicional</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                          <Phone className="h-4 w-4" />
                          Contato
                        </h4>
                        <div className="space-y-3 pl-6">
                          {municipe.telefone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                <strong>Telefone:</strong> {municipe.telefone}
                              </span>
                            </div>
                          )}
                          {municipe.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                <strong>E-mail:</strong> {municipe.email}
                              </span>
                            </div>
                          )}
                          {municipe.instagram && (
                            <div className="flex items-center gap-2">
                              <Instagram className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                <strong>Instagram:</strong>{" "}
                                <a
                                  href={`https://instagram.com/${municipe.instagram.replace(/^@/, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  {municipe.instagram.startsWith('@') ? municipe.instagram : `@${municipe.instagram}`}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </span>
                            </div>
                          )}
                          {!municipe.telefone && !municipe.email && !municipe.instagram && (
                            <p className="text-sm text-muted-foreground">Nenhum contato cadastrado</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Coluna 2 - Endereço e Estatísticas */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                          <MapPin className="h-4 w-4" />
                          Endereço
                        </h4>
                        <div className="space-y-1 pl-6">
                          {(municipe.endereco || municipe.bairro || municipe.cidade || municipe.cep) ? (
                            <>
                              {municipe.endereco && (
                                <p className="text-sm">{municipe.endereco}</p>
                              )}
                              <div className="flex flex-wrap gap-1 text-sm text-muted-foreground">
                                {municipe.bairro && <span>{municipe.bairro}</span>}
                                {municipe.bairro && municipe.cidade && <span>•</span>}
                                {municipe.cidade && <span>{municipe.cidade}</span>}
                              </div>
                              {municipe.cep && (
                                <p className="text-sm text-muted-foreground">CEP: {municipe.cep}</p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                          <ClipboardList className="h-4 w-4" />
                          Estatísticas
                        </h4>
                        <div className="grid grid-cols-2 gap-3 pl-6">
                          <div 
                            className="bg-muted/50 rounded-lg p-3 text-center cursor-pointer hover:bg-muted/80 transition-colors group"
                            onClick={() => setDemandasDialogOpen(true)}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <p className="text-2xl font-bold text-primary">{demandasCount}</p>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-xs text-muted-foreground">Demandas</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-primary">{atividadesCount}</p>
                            <p className="text-xs text-muted-foreground">Interações</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observações */}
                  {municipe.observacoes && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                        <FileText className="h-4 w-4" />
                        Observações
                      </h4>
                      <div className="bg-muted/30 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {municipe.observacoes}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Metadados do Sistema */}
                  {municipe.updated_at && municipe.updated_at !== municipe.created_at && (
                    <div className="border-t pt-4">
                      <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Atualizado em: {formatDateTime(municipe.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aba de Prontuário */}
            <TabsContent value="prontuario" className="overflow-y-auto max-h-[calc(90vh-200px)] pr-2">
              <MunicipeProntuarioTab municipeId={municipe.id} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <EditMunicipeDialog 
        municipe={municipe}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Dialog de Demandas */}
      <MunicipeDemandasDialog
        municipe={municipe}
        open={demandasDialogOpen}
        onOpenChange={setDemandasDialogOpen}
      />
    </>
  );
}
