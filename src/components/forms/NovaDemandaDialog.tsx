import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Upload, X, MapPin, Loader2, Search, CheckCircle2, Eye } from "lucide-react";
import { HumorSelector, HumorType } from "./HumorSelector";
import { MunicipeCombobox } from "./MunicipeCombobox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBrasilAPI, formatarCep, validarCep, geocodificarEndereco } from "@/hooks/useBrasilAPI";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { AnexoPreviewDialog, LocalFileThumbnail, isPreviewable } from "@/components/ui/AnexoPreview";
import { useAuth } from "@/contexts/AuthContext";

export function NovaDemandaDialog() {
  const { user, roleNoTenant } = useAuth();
  const isRepresentante = roleNoTenant === "representante";
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [coordenadas, setCoordenadas] = useState<{ lat: number | null; lng: number | null; fonte: string | null }>({ lat: null, lng: null, fonte: null });
  const [enderecoPreenchido, setEnderecoPreenchido] = useState(false);
  
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    municipe_id: "",
    area_id: "",
    prioridade: "media" as "baixa" | "media" | "alta" | "urgente",
    responsavel_id: "",
    representante_id: "",
    status: "solicitada",
    data_prazo: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "SP",
    cep: "",
    complemento: "",
    observacoes: "",
    humor: null as HumorType,
    origem: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { buscarCep, isLoading: isBuscandoCep } = useBrasilAPI();
  const { statusList } = useDemandaStatus();

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
    queryKey: ['usuarios-gabinete'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .neq('role_no_tenant', 'representante')
        .order('nome');
      if (error) throw error;
      return data;
    }
  });

  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('role_no_tenant', 'representante')
        .order('nome');
      if (error) throw error;
      return data;
    }
  });

  // Função para buscar CEP e preencher endereço automaticamente (SEM geocodificar)
  // A geocodificação será feita no momento de salvar, quando o número já estiver preenchido
  const handleBuscarCep = async () => {
    if (!validarCep(formData.cep)) {
      toast({
        title: "CEP inválido",
        description: "Digite um CEP válido com 8 dígitos.",
        variant: "destructive"
      });
      return;
    }

    const resultado = await buscarCep(formData.cep);

    if (resultado) {
      setFormData(prev => ({
        ...prev,
        logradouro: resultado.logradouro || prev.logradouro,
        bairro: resultado.bairro || prev.bairro,
        cidade: resultado.cidade || prev.cidade,
        estado: resultado.estado || prev.estado
      }));

      // Não salvar coordenadas aqui - será feito ao salvar com o número preenchido
      setEnderecoPreenchido(true);
      toast({
        title: "Endereço encontrado!",
        description: `${resultado.logradouro}, ${resultado.bairro} - ${resultado.cidade}/${resultado.estado}. Preencha o número para localização precisa.`,
      });
    } else {
      toast({
        title: "CEP não encontrado",
        description: "Verifique o CEP digitado e tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Buscar CEP automaticamente quando tiver 8 dígitos
  const handleCepChange = (value: string) => {
    const cepFormatado = formatarCep(value);
    setFormData(prev => ({ ...prev, cep: cepFormatado }));
    setEnderecoPreenchido(false);
    setCoordenadas({ lat: null, lng: null, fonte: null });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => 
        file.type === 'application/pdf' || 
        file.type.startsWith('image/') || 
        file.type.startsWith('video/')
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

      const { data: criador } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.user.id)
        .maybeSingle();

      // ========== GEOCODIFICAR ANTES DE SALVAR ==========
      // Usa o endereço completo COM número para precisão máxima
      let latitude: number | null = null;
      let longitude: number | null = null;
      let geocodificado = false;

      if (data.logradouro || data.bairro) {
        console.log('🗺️ Geocodificando endereço antes de salvar...');
        const coordResult = await geocodificarEndereco(
          data.logradouro || '',
          data.numero || '',
          data.bairro || '',
          data.cidade || 'São Paulo',
          data.estado || 'SP'
        );

        if (coordResult) {
          latitude = coordResult.latitude;
          longitude = coordResult.longitude;
          geocodificado = true;
          console.log(`✅ Coordenadas obtidas via ${coordResult.fonte}:`, latitude, longitude);
        } else {
          console.log('⚠️ Não foi possível geocodificar o endereço');
        }
      }

      const cleanData = {
        ...data,
        area_id: data.area_id || null,
        responsavel_id: data.responsavel_id || null,
        // FIX: Se o usuário é representante, forçar representante_id = user.id
        representante_id: isRepresentante ? user?.id : (data.representante_id || null),
        data_prazo: data.data_prazo || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        bairro: data.bairro || null,
        cep: data.cep?.replace(/\D/g, '') || null,
        complemento: data.complemento || null,
        observacoes: data.observacoes || null,
        humor: data.humor || null,
        origem: data.origem || null,
        criado_por: user.user.id,
        // Campos de geolocalização - preenchidos pela geocodificação acima
        latitude,
        longitude,
        geocodificado
      };

      // Remover campo estado que não existe na tabela
      const { estado, ...dataToInsert } = cleanData;

      const { data: demanda, error } = await supabase
        .from('demandas')
        .insert(dataToInsert)
        .select('id, protocolo, titulo')
        .single();

      if (error) throw error;

      // Gerar embedding em background (sem await — não bloqueia o usuário)
      supabase.functions.invoke('gerar-embedding', { body: { demanda_id: demanda.id } });

      if (files.length > 0) {
        await uploadFiles(demanda.id);
      }

      if (data.responsavel_id && data.responsavel_id !== user.user.id) {
        const { error: notificacaoError } = await supabase
          .from('notificacoes')
          .insert({
            remetente_id: user.user.id,
            destinatario_id: data.responsavel_id,
            tipo: 'atribuicao',
            titulo: 'Nova demanda atribuída',
            mensagem: `${criador?.nome || 'Usuário'} atribuiu você à demanda #${demanda.protocolo}: "${demanda.titulo}"`,
            url_destino: `/demandas?id=${demanda.id}`,
            lida: false
          });

        if (notificacaoError) {
          console.error('Erro ao criar notificação:', notificacaoError);
        }
      }

      return { demanda, geocodificado: coordenadas.lat !== null };
    },
    onSuccess: (result) => {
      const geoMsg = result.geocodificado 
        ? " Localização mapeada automaticamente!" 
        : "";
      
      toast({
        title: "Demanda criada com sucesso!",
        description: `A nova demanda foi registrada no sistema.${geoMsg}`
      });
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      queryClient.invalidateQueries({ queryKey: ['demandas-mapa-all'] });
      // FIX: Invalidar queries do portal do representante
      queryClient.invalidateQueries({ queryKey: ['rep-demandas'] });
      queryClient.invalidateQueries({ queryKey: ['rep-dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['rep-dashboard-chart-data'] });
      queryClient.invalidateQueries({ queryKey: ['rep-dashboard-recentes'] });
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar demanda",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFiles([]);
    setCoordenadas({ lat: null, lng: null, fonte: null });
    setEnderecoPreenchido(false);
    setFormData({
      titulo: "",
      descricao: "",
      municipe_id: "",
      area_id: "",
      prioridade: "media",
      responsavel_id: "",
      representante_id: "",
      status: "solicitada",
      data_prazo: "",
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: "SP",
      cep: "",
      complemento: "",
      observacoes: "",
      humor: null,
      origem: ""
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.descricao || !formData.municipe_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o título, descrição e selecione um munícipe.",
        variant: "destructive"
      });
      return;
    }
    createDemanda.mutate(formData);
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
          <DialogTitle>Nova Demanda</DialogTitle>
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
                placeholder="Título da demanda"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva a demanda em detalhes"
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="municipe">Munícipe *</Label>
                <MunicipeCombobox
                  value={formData.municipe_id}
                  onChange={(id) => setFormData(prev => ({ ...prev, municipe_id: id }))}
                  placeholder="Buscar por nome, telefone ou bairro..."
                  representanteId={isRepresentante ? user?.id : undefined}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="area">Área</Label>
                <Select
                  value={formData.area_id}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, area_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma área" />
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

              {/* Humorômetro - Humor do Munícipe */}
              <div className="md:col-span-2">
                <HumorSelector
                  value={formData.humor}
                  onChange={(value) => setFormData(prev => ({ ...prev, humor: value }))}
                  label="Como o munícipe está se sentindo?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável</Label>
                <Select
                  value={formData.responsavel_id}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, responsavel_id: value }))
                  }
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

              {/* FIX: Representante logado não vê o seletor — é auto-preenchido */}
              {isRepresentante ? (
                <div className="space-y-2">
                  <Label>Representante</Label>
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50 text-sm text-muted-foreground">
                    Vinculada automaticamente a você
                  </div>
                </div>
              ) : (
              <div className="space-y-2">
                <Label>Representante</Label>
                <Select
                  value={formData.representante_id || "none"}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, representante_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum representante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Nenhum representante</span>
                    </SelectItem>
                    {representantes.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusList.map((status) => (
                      <SelectItem key={status.slug} value={status.slug}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: status.cor }}
                          />
                          {status.nome}
                        </div>
                      </SelectItem>
                    ))}
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
                    <span className="ml-2 hidden sm:inline">Buscar</span>
                  </Button>
                </div>
              </div>
            </div>

           {/* Indicador de coordenadas */}
            {coordenadas.lat && coordenadas.lng && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-md">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Localização mapeada: {coordenadas.lat.toFixed(6)}, {coordenadas.lng.toFixed(6)}
                  {coordenadas.fonte && (
                    <span className="text-xs text-green-500 ml-2">
                      (via {coordenadas.fonte === 'brasilapi' ? 'BrasilAPI' : coordenadas.fonte === 'mapbox' ? 'Mapbox' : 'OpenStreetMap'})
                    </span>
                  )}
                </span>
              </div>
            )}
            
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
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={formData.estado}
                  onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                  placeholder="SP"
                  maxLength={2}
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

            <div className="space-y-2">
              <Label htmlFor="origem">Origem da Demanda</Label>
              <Select
                value={formData.origem}
                onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, origem: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp_mandato">WhatsApp Mandato</SelectItem>
                  <SelectItem value="whatsapp_assessoria">WhatsApp Assessoria</SelectItem>
                  <SelectItem value="whatsapp_parlamentar">WhatsApp Parlamentar</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="tiktok">Tiktok</SelectItem>
                  <SelectItem value="gabinete">Gabinete</SelectItem>
                  <SelectItem value="em_agenda">Em Agenda</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
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
          </div>

          {/* Anexos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Anexos</h3>
            
            <div className="flex items-center gap-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">Adicionar arquivo</span>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.ogg,.mov,.avi,.mkv,.m4v"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-muted-foreground">PDF, imagens e vídeos (máx. 50MB cada)</span>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-accent rounded-md">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <LocalFileThumbnail
                        file={file}
                        onClick={() => isPreviewable(file.name, file.type) ? setPreviewIndex(index) : undefined}
                      />
                      <div className="min-w-0">
                        <span className="text-sm truncate block">{file.name}</span>
                        <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      {isPreviewable(file.name, file.type) && (
                        <Eye
                          className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground"
                          onClick={() => setPreviewIndex(index)}
                        />
                      )}
                      <X 
                        className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" 
                        onClick={() => removeFile(index)}
                      />
                    </div>
                  </div>
                ))}

                {/* Preview Dialog */}
                <AnexoPreviewDialog
                  open={previewIndex !== null}
                  onOpenChange={(open) => { if (!open) setPreviewIndex(null); }}
                  localFile={previewIndex !== null ? files[previewIndex] : null}
                  hasPrev={previewIndex !== null && previewIndex > 0}
                  hasNext={previewIndex !== null && previewIndex < files.length - 1}
                  onPrev={() => setPreviewIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  onNext={() => setPreviewIndex((i) => (i !== null && i < files.length - 1 ? i + 1 : i))}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createDemanda.isPending}>
              {createDemanda.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Demanda"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
