import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText, UserCheck, Search, Loader2, MapPin } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBrasilAPI } from "@/hooks/useBrasilAPI";
import { useGeocoding } from "@/hooks/useGeocoding";

interface CriarDemandaAposCadastroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  municipeId: string;
  municipeName: string;
}

export function CriarDemandaAposCadastroDialog({ 
  open, 
  onOpenChange, 
  municipeId, 
  municipeName 
}: CriarDemandaAposCadastroDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    area_id: "",
    prioridade: "media" as "baixa" | "media" | "alta" | "urgente",
    responsavel_id: "",
    status: "solicitada" as "solicitada" | "em_producao" | "encaminhado" | "devolvido" | "visitado" | "atendido",
    data_prazo: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "Santo André",
    cep: "",
    complemento: "",
    observacoes: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { buscarCep, isLoading: isBuscandoCep } = useBrasilAPI();
  const { geocodificarEndereco, isLoading: isGeocodificando } = useGeocoding();
  const [coordenadas, setCoordenadas] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null
  });

  // Funções de CEP
  const validarCep = (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    return cepLimpo.length === 8;
  };

  const handleCepChange = (value: string) => {
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
      toast({
        title: "CEP inválido",
        description: "Digite um CEP válido com 8 dígitos",
        variant: "destructive"
      });
      return;
    }

    const resultado = await buscarCep(cepLimpo);
    if (resultado) {
      setFormData(prev => ({
        ...prev,
        logradouro: resultado.logradouro || prev.logradouro,
        bairro: resultado.bairro || prev.bairro,
        cidade: resultado.cidade || prev.cidade
      }));
      
      // Atualizar coordenadas se disponíveis
      if (resultado.latitude && resultado.longitude) {
        setCoordenadas({ lat: resultado.latitude, lng: resultado.longitude });
      }
      
      toast({
        title: "Endereço encontrado!",
        description: `${resultado.logradouro}, ${resultado.bairro} - ${resultado.cidade}`
      });
    } else {
      toast({
        title: "CEP não encontrado",
        description: "Verifique o CEP digitado",
        variant: "destructive"
      });
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
      toast({
        title: "Endereço incompleto",
        description: "Preencha ao menos o logradouro e a cidade para geocodificar",
        variant: "destructive"
      });
      return;
    }

    const resultado = await geocodificarEndereco(enderecoCompleto);
    if (resultado) {
      setCoordenadas({ lat: resultado.lat, lng: resultado.lng });
      toast({
        title: "Coordenadas atualizadas!",
        description: `Lat: ${resultado.lat.toFixed(6)}, Lng: ${resultado.lng.toFixed(6)}`
      });
    } else {
      toast({
        title: "Erro na geocodificação",
        description: "Não foi possível encontrar as coordenadas para este endereço",
        variant: "destructive"
      });
    }
  };

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

  const createDemanda = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const cleanData = {
        ...data,
        municipe_id: municipeId,
        area_id: data.area_id || null,
        responsavel_id: data.responsavel_id || null,
        data_prazo: data.data_prazo || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        bairro: data.bairro || null,
        cep: data.cep?.replace(/\D/g, '') || null,
        complemento: data.complemento || null,
        observacoes: data.observacoes || null,
        criado_por: user.user.id,
        latitude: coordenadas.lat,
        longitude: coordenadas.lng,
        geocodificado: coordenadas.lat !== null && coordenadas.lng !== null
      };

      const { data: demanda, error } = await supabase
        .from('demandas')
        .insert(cleanData)
        .select('id, protocolo')
        .single();

      if (error) throw error;

      if (files.length > 0) {
        await uploadFiles(demanda.id);
      }

      return demanda;
    },
    onSuccess: (demanda) => {
      toast({
        title: "Demanda criada com sucesso!",
        description: `Demanda ${demanda.protocolo} vinculada ao munícipe ${municipeName}.`
      });
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar demanda",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleClose = () => {
    onOpenChange(false);
    setFiles([]);
    setCoordenadas({ lat: null, lng: null });
    setFormData({
      titulo: "",
      descricao: "",
      area_id: "",
      prioridade: "media",
      responsavel_id: "",
      status: "solicitada",
      data_prazo: "",
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "Santo André",
      cep: "",
      complemento: "",
      observacoes: ""
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.descricao) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o título e a descrição da demanda.",
        variant: "destructive"
      });
      return;
    }
    createDemanda.mutate(formData);
  };

  const handleSkip = () => {
    toast({
      title: "Munícipe cadastrado",
      description: `${municipeName} foi cadastrado com sucesso.`
    });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-600" />
            Munícipe cadastrado com sucesso!
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Deseja criar uma demanda para <strong>{municipeName}</strong>?
          </div>
        </DialogHeader>

        <div className="flex gap-3 mb-6">
          <Button variant="outline" onClick={handleSkip} className="flex-1">
            Não, apenas finalizar
          </Button>
          <Button 
            onClick={() => {/* Formulário já está visível */}} 
            className="flex-1 bg-gradient-to-r from-primary to-primary/80"
          >
            <FileText className="h-4 w-4 mr-2" />
            Sim, criar demanda
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informações da Demanda</h3>
            
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
          </div>

          {/* Upload de Arquivos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Anexos</h3>
            
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
                <Label>Arquivos selecionados:</Label>
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
            <h3 className="text-lg font-semibold">Configurações</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Endereço */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Endereço da Demanda</h3>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Campo CEP com busca */}
            <div className="space-y-2">
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
              <p className="text-xs text-muted-foreground">
                Digite o CEP e clique na lupa para buscar o endereço automaticamente
              </p>
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
                  placeholder="Santo André"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
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
                  Obter Coordenadas
                </Button>
              </div>
              {coordenadas.lat && coordenadas.lng ? (
                <p className="text-xs text-green-600">
                  📍 Coordenadas: {coordenadas.lat.toFixed(6)}, {coordenadas.lng.toFixed(6)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Preencha o endereço e clique em "Obter Coordenadas" para localizar no mapa.
                </p>
              )}
            </div>
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

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createDemanda.isPending}>
              {createDemanda.isPending ? "Criando..." : "Criar Demanda"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
