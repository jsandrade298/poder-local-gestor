import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EditAcaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  action: any;
}

export function EditAcaoDialog({ open, onOpenChange, onSubmit, action }: EditAcaoDialogProps) {
  const [acao, setAcao] = useState("");
  const [eixoId, setEixoId] = useState("");
  const [temaId, setTemaId] = useState("");
  const [prioridadeId, setPrioridadeId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [apoio, setApoio] = useState("");
  const [prazo, setPrazo] = useState<Date>();
  const [atualizacao, setAtualizacao] = useState("");

  // Queries para carregar dados
  const { data: eixos = [] } = useQuery({
    queryKey: ['eixos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eixos').select('*').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const { data: temas = [] } = useQuery({
    queryKey: ['temas-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('temas_acao').select('*').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const { data: prioridades = [] } = useQuery({
    queryKey: ['prioridades-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('prioridades_acao').select('*').order('nivel');
      if (error) throw error;
      return data;
    }
  });

  const { data: statusAcao = [] } = useQuery({
    queryKey: ['status-acao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('status_acao').select('*').order('nome');
      if (error) throw error;
      return data;
    }
  });


  // Preencher formulário quando action mudar
  useEffect(() => {
    if (action) {
      setAcao(action.acao || "");
      setEixoId(action.eixo_id || "");
      setTemaId(action.tema_id || "");
      setPrioridadeId(action.prioridade_id || "");
      setStatusId(action.status_id || "");
      setResponsavel(action.responsavel || "");
      setApoio(action.apoio || "");
      setAtualizacao(action.atualizacao || "");
      setPrazo(action.prazo ? new Date(action.prazo) : undefined);
    }
  }, [action]);

  // Temas independentes (sem filtro por eixo)
  const temasFiltrados = temas;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!acao.trim()) {
      return;
    }

    const formData = {
      acao: acao.trim(),
      eixo_id: eixoId || null,
      tema_id: temaId || null,
      prioridade_id: prioridadeId || null,
      status_id: statusId || null,
      responsavel: responsavel.trim() || null,
      apoio: apoio.trim() || null,
      prazo: prazo ? format(prazo, 'yyyy-MM-dd') : null,
      atualizacao: atualizacao.trim() || null,
    };

    onSubmit(formData);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Ação</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eixo">Eixo</Label>
              <Select value={eixoId} onValueChange={setEixoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um eixo" />
                </SelectTrigger>
                <SelectContent>
                  {eixos.map((eixo) => (
                    <SelectItem key={eixo.id} value={eixo.id}>
                      {eixo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tema">Tema</Label>
              <Select value={temaId} onValueChange={setTemaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tema" />
                </SelectTrigger>
                <SelectContent>
                  {temasFiltrados.map((tema) => (
                    <SelectItem key={tema.id} value={tema.id}>
                      {tema.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select value={prioridadeId} onValueChange={setPrioridadeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  {prioridades.map((prioridade) => (
                    <SelectItem key={prioridade.id} value={prioridade.id}>
                      {prioridade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusId} onValueChange={setStatusId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {statusAcao.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável</Label>
              <Input
                id="responsavel"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Nome do responsável"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazo">Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !prazo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {prazo ? format(prazo, "dd/MM/yyyy") : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={prazo}
                    onSelect={setPrazo}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acao">Ação *</Label>
            <Textarea
              id="acao"
              value={acao}
              onChange={(e) => setAcao(e.target.value)}
              placeholder="Descreva a ação a ser realizada..."
              required
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apoio">Apoio</Label>
            <Textarea
              id="apoio"
              value={apoio}
              onChange={(e) => setApoio(e.target.value)}
              placeholder="Descreva o apoio necessário..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="atualizacao">Atualização</Label>
            <Textarea
              id="atualizacao"
              value={atualizacao}
              onChange={(e) => setAtualizacao(e.target.value)}
              placeholder="Informações sobre o andamento..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}