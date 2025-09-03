import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, MapPin, Phone, User, Tag as TagIcon, FileText } from "lucide-react";
import { formatDateOnly } from "@/lib/dateUtils";

interface MunicipeDetailsDialogProps {
  municipe: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MunicipeDetailsDialog({ municipe, open, onOpenChange }: MunicipeDetailsDialogProps) {
  if (!municipe) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalhes do Munícipe
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Informações Pessoais</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome Completo</label>
                <p className="text-base font-medium">{municipe.nome}</p>
              </div>

              {municipe.data_nascimento && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Data de Nascimento</label>
                    <p className="text-sm">{formatDateOnly(municipe.data_nascimento)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Contato</h3>
            
            <div className="space-y-3">
              {municipe.telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                    <p className="text-sm">{municipe.telefone}</p>
                  </div>
                </div>
              )}

              {municipe.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">E-mail</label>
                    <p className="text-sm">{municipe.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Endereço */}
          {(municipe.endereco || municipe.bairro || municipe.cidade || municipe.cep) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Endereço</h3>
              
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <div className="space-y-1">
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
                </div>
              </div>
            </div>
          )}

          {/* Tags */}
          {municipe.municipe_tags && municipe.municipe_tags.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                <TagIcon className="h-4 w-4" />
                Tags
              </h3>
              
              <div className="flex flex-wrap gap-2">
                {municipe.municipe_tags.map((mt: any) => (
                  mt.tags && (
                    <Badge 
                      key={mt.tags.id} 
                      variant="secondary"
                      style={{ 
                        backgroundColor: `${mt.tags.cor}20`,
                        borderColor: mt.tags.cor,
                        color: mt.tags.cor
                      }}
                    >
                      {mt.tags.nome}
                    </Badge>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          {municipe.observacoes && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Observações
              </h3>
              
              <p className="text-sm text-muted-foreground leading-relaxed">
                {municipe.observacoes}
              </p>
            </div>
          )}

          {/* Metadados */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Informações do Sistema</h3>
            
            <div className="grid grid-cols-1 gap-4 text-sm">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Cadastrado em</label>
                <p className="text-sm">
                  {municipe.created_at ? formatDateOnly(municipe.created_at) : 'Não informado'}
                </p>
              </div>
              
              {municipe.updated_at && municipe.updated_at !== municipe.created_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Última atualização</label>
                  <p className="text-sm">{formatDateOnly(municipe.updated_at)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}