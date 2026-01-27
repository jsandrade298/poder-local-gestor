import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, X, Download, Search, MapPin, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMunicipesSelect } from "@/hooks/useMunicipesSelect";
import { useBrasilAPI } from "@/hooks/useBrasilAPI";
import { useGeocoding } from "@/hooks/useGeocoding";

interface EditDemandaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demanda: any;
}

export function EditDemandaDialog({ open, onOpenChange, demanda }: EditDemandaDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    municipe_id: "",
    area_id: "",
    prioridade: "media" as "baixa" | "media" | "alta" | "urgente",
    responsavel_id: "",
    status: "solicitada" as "solicitada" | "em_producao" | "encaminhado" | "devolvido" | "visitado" | "atendido",
    data_prazo: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "São Paulo",
    cep: "",
    complemento: "",
    observacoes: "",
    resolucao: ""
  });

  const queryClient = useQueryClient();

  // Buscar anexos existentes
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
    enabled: !!demanda?.id
  });

  const { data: municipes = [] } = useMunicipesSelect();

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Hooks de CEP e Geolocalização
  const { buscarCep, isLoading: isBuscandoCep } = useBrasilAPI();
  const { geocodificarEndereco, isLoading: isGeocodificando } = useGeocoding();
  const [coordenadas, setCoordenadas] = useState<{ lat: number | null; lng: number | null }>({
    lat: demanda?.latitude || null,
    lng: demanda?.longitude || null
  });

  // Atualizar coordenadas quando demanda mudar
  useEffect(() => {
    if (demanda) {
      setCoordenadas({
        lat: demanda.latitude || null,
        lng: demanda.longitude || null
      });
    }
  }, [demanda]);

  // Funções de CEP
  const validarCep = (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    return cepLimpo.length === 8;
  };

  const handleCepChange = (value: string) => {
    // Formatar CEP automaticamente (99999-999)
    const cepLimpo = value.replace(/\D/g, '');
    let cepFormatado = cepLimpo;
    if (cepLimpo.length > 5) {
      cepFormatado = `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5, 8)}`;
    }
    setFormData(prev => ({ ...prev, cep: cepFormatado }));
  };

  const handleBuscarCep = async () => {
    const cepLimpo = formData.cep.replace(/\D/g, '');
    if (!validarCep(formData.cep)) {
      toast.error('CEP inválido');
      return;
    }

    const resultado = await buscarCep(cepLimpo);
    if (resultado) {
      setFormData(prev => ({
        ...prev,
        logradouro: resultado.street || prev.logradouro,
        bairro: resultado.neighborhood || prev.bairro,
        cidade: resultado.city || prev.cidade
      }));
      toast.success('Endereço encontrado!');
    }
  };

  const handleAtualizarGeolocalizacao = async () => {
    const enderecoCompleto = [
      formData.logradouro,
      formData.numero,
      formData.bairro,
      formData.cidade,
      'SP',
      'Brasil'
    ].filter(Boolean).join(', ');

    if (!formData.logradouro || !formData.cidade) {
      toast.error('Preencha ao menos o logradouro e a cidade para geocodificar');
      return;
    }

    const resultado = await geocodificarEndereco(enderecoCompleto);
    if (resultado) {
      setCoordenadas({ lat: resultado.lat, lng: resultado.lng });
      toast.success(`Coordenadas atualizadas: ${resultado.lat.toFixed(6)}, ${resultado.lng.toFixed(6)}`);
    } else {
      toast.error('Não foi possível encontrar as coordenadas para este endereço');
    }
  };

  // Função para mapear status antigos para novos
  const mapStatusAntigoParaNovo = (status: string): "solicitada" | "em_producao" | "encaminhado" | "devolvido" | "visitado" | "atendido" => {
    const mapeamento: Record<string, "solicitada" | "em_producao" | "encaminhado" | "devolvido" | "visitado" | "atendido"> = {
      'aberta': 'solicitada',
      'em_andamento': 'em_producao',
      'aguardando': 'encaminhado',
      'resolvida': 'atendido',
      'cancelada': 'devolvido',
      // Novos valores já mapeados para si mesmos
      'solicitada': 'solicitada',
      'em_producao': 'em_producao',
      'encaminhado': 'encaminhado',
      'devolvido': 'devolvido',
      'visitado': 'visitado',
      'atendido': 'atendido'
    };
    return mapeamento[status] || 'solicitada';
  };

  // Preencher formulário quando demanda mudar
  useEffect(() => {
    if (demanda) {
      setFormData({
        titulo: demanda.titulo || "",
        descricao: demanda.descricao || "",
        municipe_id: demanda.municipe_id || "",
        area_id: demanda.area_id || "",
        prioridade: demanda.prioridade || "media",
        responsavel_id: demanda.responsavel_id || "",
        status: mapStatusAntigoParaNovo(demanda.status || "solicitada"),
        data_prazo: demanda.data_prazo || "",
        logradouro: demanda.logradouro || "",
        numero: demanda.numero || "",
        bairro: demanda.bairro || "",
        cidade: demanda.cidade || "São Paulo",
        cep: demanda.cep || "",
        complemento: demanda.complemento || "",
        observacoes: demanda.observacoes || "",
        resolucao: demanda.resolucao || ""
      });
    }
  }, [demanda]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => 
        file.type === 'application/pdf' || 
        file.type === 'image/jpeg' || 
        file.type === 'image/png' || 
        file.type === 'image/jpg'
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (demandaId: string) => {
    for (const file of files) {
      const sanitizedFileName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_');
      
      const fileName = `${demandaId}/${sanitizedFileName}`;
      const { error } = await supabase.storage
        .from('demanda-anexos')
        .upload(fileName, file);
      
      if (error) throw error;

      const { error: anexoError } = await supabase
        .from('anexos')
        .insert({
          demanda_id: demandaId,
          nome_arquivo: file.name,
          tipo_arquivo: file.type,
          tamanho_arquivo: file.size,
          url_arquivo: fileName,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id
        });
      
      if (anexoError) throw anexoError;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'solicitada': return 'Solicitada';
      case 'em_producao': return 'Em Produção';
      case 'atendido': return 'Atendido';
      case 'devolvido': return 'Devolvido';
      case 'visitado': return 'Visitado';
      case 'encaminhado': return 'Encaminhado';
      default: return status;
    }
  };

  const updateDemanda = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Obter usuário atual
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      
      if (!userId) throw new Error('Usuário não autenticado');

      // Buscar dados anteriores e do editor
      const [demandaAnteriorResponse, editorResponse] = await Promise.all([
        supabase
          .from('demandas')
          .select('status, responsavel_id, protocolo, titulo, municipes(nome, telefone)')
          .eq('id', demanda.id)
          .single(),
        supabase
          .from('profiles')
          .select('nome')
          .eq('id', userId)
          .maybeSingle()
      ]);

      const demandaAnterior = demandaAnteriorResponse.data;
      const editor = editorResponse.data;
      const statusAnterior = demandaAnterior?.status;
      const responsavelAnterior = demandaAnterior?.responsavel_id;
      const municipeData = demandaAnterior?.municipes as any;
      let whatsappEnviado = false;

      // Atualizar demanda
      const cleanData = {
        ...data,
        area_id: data.area_id || null,
        responsavel_id: data.responsavel_id || null,
        data_prazo: data.data_prazo || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        bairro: data.bairro || null,
        cep: data.cep?.replace(/\D/g, '') || null,
        complemento: data.complemento || null,
        observacoes: data.observacoes || null,
        resolucao: data.resolucao || null,
        latitude: coordenadas.lat,
        longitude: coordenadas.lng,
        geocodificado: coordenadas.lat !== null && coordenadas.lng !== null
      };

      const { error } = await supabase
        .from('demandas')
        .update(cleanData)
        .eq('id', demanda.id);

      if (error) throw error;

      // Criar notificação se o responsável mudou
      if (data.responsavel_id && 
          data.responsavel_id !== responsavelAnterior && 
          data.responsavel_id !== userId) {
        const { error: notificacaoError } = await supabase
          .from('notificacoes')
          .insert({
            remetente_id: userId,
            destinatario_id: data.responsavel_id,
            tipo: 'atribuicao',
            titulo: 'Demanda atribuída a você',
            mensagem: `${editor?.nome || 'Usuário'} atribuiu você à demanda #${demandaAnterior?.protocolo}: "${demandaAnterior?.titulo}"`,
            url_destino: `/demandas?id=${demanda.id}`,
            lida: false
          });

        if (notificacaoError) {
          console.error('Erro ao criar notificação de atribuição:', notificacaoError);
          // Não falha a operação por causa da notificação
        }
      }

      // Notificar se status mudou
      if (statusAnterior !== data.status && municipeData?.telefone) {
        try {
          console.log('🔔 Enviando notificação WhatsApp...');
          const response = await supabase.functions.invoke('whatsapp-notificar-demanda', {
            body: {
              demanda_id: demanda.id,
              municipe_nome: municipeData.nome,
              municipe_telefone: municipeData.telefone,
              status: getStatusLabel(data.status),
              status_anterior: getStatusLabel(statusAnterior),
              titulo_demanda: data.titulo,
              protocolo: demanda.protocolo
            }
          });
          
          console.log('📱 Resposta da notificação:', response);
          
          if (response.data?.success) {
            whatsappEnviado = true;
          }
        } catch (notifError) {
          console.error('Erro ao enviar notificação:', notifError);
        }
      }

      if (files.length > 0) {
        await uploadFiles(demanda.id);
      }

      return { whatsappEnviado, municipeNome: municipeData?.nome };
    },
    onSuccess: (result) => {
      if (result?.whatsappEnviado) {
        toast.success(`✅ Demanda atualizada e WhatsApp enviado para ${result.municipeNome}!`);
      } else {
        toast.success("Demanda atualizada com sucesso!");
      }
      
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      queryClient.invalidateQueries({ queryKey: ['anexos', demanda.id] });
      onOpenChange(false);
      setFiles([]);
    },
    onError: (error) => {
      console.error('Erro ao atualizar demanda:', error);
      toast.error("Erro ao atualizar demanda");
    }
  });

  const deleteAnexo = useMutation({
    mutationFn: async (anexoId: string) => {
      const anexo = anexos.find(a => a.id === anexoId);
      if (!anexo) return;

      // Deletar arquivo do storage
      const { error: storageError } = await supabase.storage
        .from('demanda-anexos')
        .remove([anexo.url_arquivo]);

      if (storageError) throw storageError;

      // Deletar registro da tabela
      const { error } = await supabase
        .from('anexos')
        .delete()
        .eq('id', anexoId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anexo removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['anexos', demanda.id] });
    },
    onError: (error) => {
      console.error('Erro ao remover anexo:', error);
      toast.error("Erro ao remover anexo");
    }
  });

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
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.descricao || !formData.municipe_id) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    updateDemanda.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Demanda</DialogTitle>
          <DialogDescription>
            Edite os dados da demanda e gerencie seus anexos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informações Básicas</h3>
            
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Digite o título da demanda"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva detalhadamente a demanda"
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações adicionais"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolucao">Resolução</Label>
              <Textarea
                id="resolucao"
                value={formData.resolucao}
                onChange={(e) => setFormData(prev => ({ ...prev, resolucao: e.target.value }))}
                placeholder="Descreva a resolução da demanda"
                rows={3}
              />
            </div>
          </div>

          {/* Anexos Existentes */}
          {anexos.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Anexos Existentes</h3>
              <div className="space-y-2">
                {anexos.map((anexo) => (
                  <div key={anexo.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{anexo.nome_arquivo}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(anexo.tamanho_arquivo / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => downloadAnexo(anexo)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAnexo.mutate(anexo.id)}
                        disabled={deleteAnexo.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload de Novos Arquivos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Adicionar Novos Anexos</h3>
            
            <div className="space-y-2">
              <Label htmlFor="files">Arquivos (PDF, JPG, PNG)</Label>
              <Input
                id="files"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <Label>Novos arquivos selecionados:</Label>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Vinculações */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Vinculações</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="municipe">Munícipe *</Label>
                <Select
                  value={formData.municipe_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, municipe_id: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o munícipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {municipes.map((municipe) => (
                      <SelectItem key={municipe.id} value={municipe.id}>
                        {municipe.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="area">Área</Label>
                <Select
                  value={formData.area_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, area_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável</Label>
                <Select
                  value={formData.responsavel_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, responsavel_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios.map((usuario) => (
                      <SelectItem key={usuario.id} value={usuario.id}>
                        {usuario.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "solicitada" | "em_producao" | "encaminhado" | "devolvido" | "visitado" | "atendido") => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solicitada">Solicitada</SelectItem>
                    <SelectItem value="em_producao">Em Produção</SelectItem>
                    <SelectItem value="encaminhado">Encaminhado</SelectItem>
                    <SelectItem value="atendido">Atendido</SelectItem>
                    <SelectItem value="devolvido">Devolvido</SelectItem>
                    <SelectItem value="visitado">Visitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Endereço da Demanda</h3>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Campo CEP com busca */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <div className="flex gap-2">
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={handleBuscarCep}
                    disabled={isBuscandoCep || !validarCep(formData.cep)}
                  >
                    {isBuscandoCep ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input
                  id="logradouro"
                  value={formData.logradouro}
                  onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
                  placeholder="Rua, Avenida, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  value={formData.numero}
                  onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                  placeholder="Número"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
                  placeholder="Bairro"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                  placeholder="Cidade"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={formData.complemento}
                  onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
                  placeholder="Apt, Bloco, etc."
                />
              </div>
            </div>

            {/* Geolocalização */}
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Geolocalização</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAtualizarGeolocalizacao}
                  disabled={isGeocodificando || !formData.logradouro}
                >
                  {isGeocodificando ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <MapPin className="h-4 w-4 mr-2" />
                  )}
                  Atualizar Coordenadas
                </Button>
              </div>
              {coordenadas.lat && coordenadas.lng ? (
                <p className="text-xs text-muted-foreground">
                  📍 Coordenadas: {coordenadas.lat.toFixed(6)}, {coordenadas.lng.toFixed(6)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem coordenadas. Clique em "Atualizar Coordenadas" após preencher o endereço.
                </p>
              )}
            </div>
          </div>

          {/* Configurações */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Configurações</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select
                  value={formData.prioridade}
                  onValueChange={(value: "baixa" | "media" | "alta" | "urgente") => 
                    setFormData(prev => ({ ...prev, prioridade: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_prazo">Prazo de Entrega</Label>
                <Input
                  id="data_prazo"
                  type="date"
                  value={formData.data_prazo}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_prazo: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateDemanda.isPending}>
              {updateDemanda.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
