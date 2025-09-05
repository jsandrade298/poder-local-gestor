import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

const formSchema = z.object({
  solicitante_id: z.string().min(1, "Selecione um solicitante"),
  data_pedido: z.string().min(1, "Data do pedido é obrigatória"),
  data_hora_proposta: z.string().min(1, "Data e hora da reunião são obrigatórias"),
  duracao_prevista: z.string().min(1, "Informe a duração prevista"),
  participantes: z.string().min(1, "Informe os participantes"),
  local_endereco: z.string().min(1, "Informe o local ou link da reunião"),
  descricao_objetivo: z.string().min(1, "Descreva o objetivo da reunião"),
  pauta_sugerida: z.string().min(1, "Informe a pauta sugerida"),
  acompanha_mandato_id: z.string().min(1, "Selecione quem acompanha pelo mandato"),
  material_apoio: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const SolicitarAgenda = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      data_pedido: (() => {
        const now = new Date();
        return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      })(),
      material_apoio: "",
      observacoes: "",
    },
  });

  // Buscar usuários para os selects
  const { data: usuarios, isLoading: loadingUsuarios } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Aqui você pode implementar a lógica de salvamento
      // Por enquanto, apenas mostramos um toast de sucesso
      console.log("Dados da solicitação:", data);
      
      toast({
        title: "Solicitação de agenda enviada!",
        description: "Sua solicitação foi registrada com sucesso.",
      });

      form.reset({
        data_pedido: (() => {
          const now = new Date();
          return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        })(),
        material_apoio: "",
        observacoes: "",
      });
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao enviar a solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Solicitar Agenda</h1>
        <p className="text-muted-foreground">
          Preencha o formulário para solicitar uma reunião ou evento na agenda.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Solicitação</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Solicitante */}
                <FormField
                  control={form.control}
                  name="solicitante_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solicitante *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o solicitante" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loadingUsuarios ? (
                            <SelectItem value="loading" disabled>
                              Carregando usuários...
                            </SelectItem>
                          ) : (
                            usuarios?.map((usuario) => (
                              <SelectItem key={usuario.id} value={usuario.id}>
                                {usuario.nome}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Data do Pedido */}
                <FormField
                  control={form.control}
                  name="data_pedido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data do Pedido *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Data/Hora Proposta */}
                <FormField
                  control={form.control}
                  name="data_hora_proposta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data/Hora Proposta para Reunião *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Duração Prevista */}
                <FormField
                  control={form.control}
                  name="duracao_prevista"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração Prevista *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 1 hora, 2h30min, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Quem Acompanha pelo Mandato */}
                <FormField
                  control={form.control}
                  name="acompanha_mandato_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quem Acompanha pelo Mandato *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o responsável" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loadingUsuarios ? (
                            <SelectItem value="loading" disabled>
                              Carregando usuários...
                            </SelectItem>
                          ) : (
                            usuarios?.map((usuario) => (
                              <SelectItem key={usuario.id} value={usuario.id}>
                                {usuario.nome}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Participantes */}
              <FormField
                control={form.control}
                name="participantes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participantes Confirmados/Convidados *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Liste os participantes confirmados e convidados..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Local/Endereço */}
              <FormField
                control={form.control}
                name="local_endereco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local / Endereço / Link de Reunião *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informe o local, endereço ou link para reunião online..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descrição/Objetivo */}
              <FormField
                control={form.control}
                name="descricao_objetivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição / Objetivo da Reunião *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva o objetivo e contexto da reunião..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Pauta Sugerida */}
              <FormField
                control={form.control}
                name="pauta_sugerida"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pauta Sugerida *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Lista dos tópicos a serem abordados na reunião..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Material de Apoio */}
              <FormField
                control={form.control}
                name="material_apoio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material de Apoio Necessário</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informe os materiais necessários para a reunião (opcional)..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Observações */}
              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações / Informações Adicionais</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informações adicionais relevantes (opcional)..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const now = new Date();
                    const localDateTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    form.reset({
                      data_pedido: localDateTime,
                      material_apoio: "",
                      observacoes: "",
                    });
                  }}
                >
                  Limpar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SolicitarAgenda;