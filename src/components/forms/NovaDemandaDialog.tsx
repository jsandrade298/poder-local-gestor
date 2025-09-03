import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useDemandas } from "@/hooks/useDemandas";
import { useToast } from "@/hooks/use-toast";

interface NovaKemandaDialogProps {
  onSuccess?: () => void;
}

export function NovaDemandaDialog({ onSuccess }: NovaKemandaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { createDemanda } = useDemandas();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    area_id: "",
    end_logradouro: "",
    end_numero: "",
    end_complemento: "",
    end_bairro: "",
    end_cidade: "",
    end_cep: "",
    responsavel_id: "",
    status: "solicitado" as const,
    municipe_id: "",
    prazo_entrega: "",
    observacoes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await createDemanda(formData);
      
      if (error) {
        toast({
          title: "Erro ao criar demanda",
          description: error,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Demanda criada com sucesso",
          description: "A nova demanda foi cadastrada no sistema."
        });
        setOpen(false);
        setFormData({
          titulo: "",
          descricao: "",
          area_id: "",
          end_logradouro: "",
          end_numero: "",
          end_complemento: "",
          end_bairro: "",
          end_cidade: "",
          end_cep: "",
          responsavel_id: "",
          status: "solicitado",
          municipe_id: "",
          prazo_entrega: "",
          observacoes: ""
        });
        onSuccess?.();
      }
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao criar a demanda.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Demanda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Nova Demanda</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => handleInputChange("titulo", e.target.value)}
                placeholder="Título da demanda"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solicitado">Solicitado</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="nao_atendido">Não Atendido</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleInputChange("descricao", e.target.value)}
              placeholder="Descrição detalhada da demanda"
              rows={3}
            />
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Endereço da Demanda</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="end_logradouro">Logradouro</Label>
                <Input
                  id="end_logradouro"
                  value={formData.end_logradouro}
                  onChange={(e) => handleInputChange("end_logradouro", e.target.value)}
                  placeholder="Rua, Avenida, etc."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="end_numero">Número</Label>
                <Input
                  id="end_numero"
                  value={formData.end_numero}
                  onChange={(e) => handleInputChange("end_numero", e.target.value)}
                  placeholder="123"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="end_complemento">Complemento</Label>
                <Input
                  id="end_complemento"
                  value={formData.end_complemento}
                  onChange={(e) => handleInputChange("end_complemento", e.target.value)}
                  placeholder="Apto, Bloco, etc."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="end_bairro">Bairro</Label>
                <Input
                  id="end_bairro"
                  value={formData.end_bairro}
                  onChange={(e) => handleInputChange("end_bairro", e.target.value)}
                  placeholder="Nome do bairro"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="end_cep">CEP</Label>
                <Input
                  id="end_cep"
                  value={formData.end_cep}
                  onChange={(e) => handleInputChange("end_cep", e.target.value)}
                  placeholder="00000-000"
                />
              </div>
            </div>
          </div>

          {/* Outros campos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prazo_entrega">Prazo de Entrega</Label>
              <Input
                id="prazo_entrega"
                type="date"
                value={formData.prazo_entrega}
                onChange={(e) => handleInputChange("prazo_entrega", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => handleInputChange("observacoes", e.target.value)}
              placeholder="Observações adicionais"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.titulo.trim()}>
              {loading ? "Criando..." : "Criar Demanda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}