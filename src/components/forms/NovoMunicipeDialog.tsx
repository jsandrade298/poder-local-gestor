import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useMunicipes } from "@/hooks/useMunicipes";
import { useToast } from "@/hooks/use-toast";

interface NovoMunicipeDialogProps {
  onSuccess?: () => void;
}

export function NovoMunicipeDialog({ onSuccess }: NovoMunicipeDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { createMunicipe } = useMunicipes();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    nome_completo: "",
    email: "",
    telefone: "",
    data_nascimento: "",
    end_logradouro: "",
    end_numero: "",
    end_complemento: "",
    end_bairro: "",
    end_cidade: "",
    end_cep: "",
    observacoes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await createMunicipe(formData);
      
      if (error) {
        toast({
          title: "Erro ao criar munícipe",
          description: error,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Munícipe criado com sucesso",
          description: "O novo munícipe foi cadastrado no sistema."
        });
        setOpen(false);
        setFormData({
          nome_completo: "",
          email: "",
          telefone: "",
          data_nascimento: "",
          end_logradouro: "",
          end_numero: "",
          end_complemento: "",
          end_bairro: "",
          end_cidade: "",
          end_cep: "",
          observacoes: ""
        });
        onSuccess?.();
      }
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao criar o munícipe.",
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
          Novo Munícipe
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Munícipe</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informações Pessoais */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Informações Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome_completo">Nome Completo *</Label>
                <Input
                  id="nome_completo"
                  value={formData.nome_completo}
                  onChange={(e) => handleInputChange("nome_completo", e.target.value)}
                  placeholder="Nome completo do munícipe"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleInputChange("telefone", e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                <Input
                  id="data_nascimento"
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) => handleInputChange("data_nascimento", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Endereço</h3>
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
            
            <div className="space-y-2">
              <Label htmlFor="end_cidade">Cidade</Label>
              <Input
                id="end_cidade"
                value={formData.end_cidade}
                onChange={(e) => handleInputChange("end_cidade", e.target.value)}
                placeholder="São Paulo"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => handleInputChange("observacoes", e.target.value)}
              placeholder="Observações adicionais sobre o munícipe"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.nome_completo.trim() || !formData.email.trim()}>
              {loading ? "Cadastrando..." : "Cadastrar Munícipe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}