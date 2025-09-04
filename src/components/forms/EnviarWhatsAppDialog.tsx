import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquare, Send, Loader2, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EnviarWhatsAppDialogProps {
  municipesSelecionados?: string[];
}

export function EnviarWhatsAppDialog({ municipesSelecionados = [] }: EnviarWhatsAppDialogProps) {
  const [open, setOpen] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [incluirTodos, setIncluirTodos] = useState(false);
  const [selectedMunicipes, setSelectedMunicipes] = useState<string[]>(municipesSelecionados);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const { toast } = useToast();

  // Buscar munícipes com telefone
  const { data: municipes } = useQuery({
    queryKey: ["municipes-whatsapp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipes")
        .select("id, nome, telefone")
        .not("telefone", "is", null)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  // Buscar instâncias WhatsApp conectadas
  const { data: instances, isLoading: loadingInstances } = useQuery({
    queryKey: ["whatsapp-instances-connected"],
    queryFn: async () => {
      // Primeiro buscar as instâncias do banco
      const { data: dbInstances, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("active", true);

      if (error) throw error;

      // Verificar status de cada instância via edge function
      const instancesWithStatus = await Promise.all(
        dbInstances.map(async (instance) => {
          try {
            const { data: statusData } = await supabase.functions.invoke("configurar-evolution", {
              body: {
                action: "instance_status",
                instanceName: instance.instance_name
              }
            });

            return {
              ...instance,
              connected: statusData?.status === "connected",
              profileName: statusData?.profileName,
              phoneNumber: statusData?.phoneNumber
            };
          } catch (error) {
            console.error(`Erro ao verificar status da instância ${instance.instance_name}:`, error);
            return {
              ...instance,
              connected: false
            };
          }
        })
      );

      // Retornar apenas instâncias conectadas
      return instancesWithStatus.filter(instance => instance.connected);
    },
    enabled: open, // Só executa quando o dialog está aberto
  });

  const enviarWhatsApp = useMutation({
    mutationFn: async ({ telefones, mensagem, incluirTodos, instanceName }: {
      telefones: string[];
      mensagem: string;
      incluirTodos: boolean;
      instanceName: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("enviar-whatsapp-zapi", {
        body: { telefones, mensagem, incluirTodos, instanceName },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Mensagens enviadas!",
        description: `${data.resumo.sucessos} mensagens enviadas com sucesso. ${data.resumo.erros} erros.`,
      });
      setOpen(false);
      setMensagem("");
      setSelectedMunicipes([]);
      setIncluirTodos(false);
      setSelectedInstance("");
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar mensagens",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEnviar = () => {
    if (!mensagem.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma mensagem para enviar",
        variant: "destructive",
      });
      return;
    }

    if (!selectedInstance) {
      toast({
        title: "Erro",
        description: "Selecione uma instância WhatsApp conectada",
        variant: "destructive",
      });
      return;
    }

    if (!incluirTodos && selectedMunicipes.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione ao menos um munícipe ou marque 'Enviar para todos'",
        variant: "destructive",
      });
      return;
    }

    const telefones = incluirTodos 
      ? [] 
      : selectedMunicipes
          .map(id => municipes?.find(m => m.id === id)?.telefone)
          .filter(Boolean) as string[];

    const selectedInstanceData = instances?.find(i => i.instance_name === selectedInstance);
    
    enviarWhatsApp.mutate({ 
      telefones, 
      mensagem, 
      incluirTodos, 
      instanceName: selectedInstance
    });
  };

  const toggleMunicipe = (municipeId: string) => {
    setSelectedMunicipes(prev => 
      prev.includes(municipeId)
        ? prev.filter(id => id !== municipeId)
        : [...prev, municipeId]
    );
  };

  const totalSelecionados = incluirTodos 
    ? municipes?.length || 0
    : selectedMunicipes.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Enviar WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar Mensagem WhatsApp</DialogTitle>
          <DialogDescription>
            Envie mensagens WhatsApp para munícipes selecionados ou todos os cadastrados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="instancia">Instância WhatsApp</Label>
            {loadingInstances ? (
              <div className="flex items-center gap-2 mt-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Verificando instâncias conectadas...</span>
              </div>
            ) : instances && instances.length > 0 ? (
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma instância WhatsApp conectada" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.instance_name}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <Smartphone className="h-4 w-4" />
                        <span>{instance.display_name}</span>
                        {instance.phoneNumber && (
                          <span className="text-muted-foreground">({instance.phoneNumber})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 p-3 border border-destructive/50 rounded-md bg-destructive/10">
                <p className="text-sm text-destructive">
                  Nenhuma instância WhatsApp conectada encontrada. 
                  Vá para Configurações → WhatsApp para conectar uma instância.
                </p>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea
              id="mensagem"
              placeholder="Digite sua mensagem aqui..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              className="mt-1"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="incluir-todos"
              checked={incluirTodos}
              onCheckedChange={(checked) => {
                setIncluirTodos(checked as boolean);
                if (checked) {
                  setSelectedMunicipes([]);
                }
              }}
            />
            <Label htmlFor="incluir-todos">
              Enviar para todos os munícipes cadastrados ({municipes?.length || 0})
            </Label>
          </div>

          {!incluirTodos && (
            <div>
              <Label>Selecionar Munícipes</Label>
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedMunicipes.map(id => {
                    const municipe = municipes?.find(m => m.id === id);
                    return municipe ? (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {municipe.nome}
                        <button
                          onClick={() => toggleMunicipe(id)}
                          className="ml-1 hover:bg-red-200 rounded-full p-0.5"
                        >
                          ×
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>

                <Select onValueChange={toggleMunicipe}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um munícipe para adicionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {municipes
                      ?.filter(m => !selectedMunicipes.includes(m.id))
                      .map((municipe) => (
                      <SelectItem key={municipe.id} value={municipe.id}>
                        {municipe.nome} - {municipe.telefone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-muted-foreground">
              {totalSelecionados} destinatário{totalSelecionados !== 1 ? 's' : ''} selecionado{totalSelecionados !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleEnviar}
                disabled={enviarWhatsApp.isPending || !selectedInstance || (instances && instances.length === 0)}
                className="gap-2"
              >
                {enviarWhatsApp.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar Mensagem
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}