import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, X, Search, Loader2, MapPin, Star, Circle, Square, Triangle, Hexagon, Heart, Pentagon, Diamond, Cross, RectangleHorizontal, UserCheck, Copy, RefreshCw, ShieldOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBrasilAPI, geocodificarEndereco } from "@/hooks/useBrasilAPI";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// Mapeamento de ícones de categoria
const categoriaIcons: Record<string, any> = {
  star: Star,
  circle: Circle,
  square: Square,
  triangle: Triangle,
  hexagon: Hexagon,
  pentagon: Pentagon,
  diamond: Diamond,
  rectangle: RectangleHorizontal,
  cross: Cross,
  heart: Heart,
};

interface EditMunicipeDialogProps {
  municipe: any;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditMunicipeDialog({ municipe, trigger, open: externalOpen, onOpenChange: externalOnOpenChange }: EditMunicipeDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Usar controle externo se fornecido, senão usar controle interno
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    instagram: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "São Paulo",
    cep: "",
    complemento: "",
    data_nascimento: "",
    observacoes: "",
    tag_ids: [] as string[],
    categoria_id: "" as string,
    representante_id: "" as string
  });

  // Estados para o painel de acesso de representante
  const [representanteAtivo, setRepresentanteAtivo] = useState(false);
  const [isGerandoConvite, setIsGerandoConvite] = useState(false);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [conviteExpiresAt, setConviteExpiresAt] = useState<string | null>(null);

  // Atualizar formData quando municipe muda
  useEffect(() => {
    if (municipe) {
      setFormData({
        nome: municipe.nome || "",
        telefone: municipe.telefone || "",
        email: municipe.email || "",
        instagram: municipe.instagram || "",
        logradouro: "",
        numero: "",
        bairro: municipe.bairro || "",
        cidade: municipe.cidade || "São Paulo",
        cep: municipe.cep || "",
        complemento: "",
        data_nascimento: municipe.data_nascimento || "",
        observacoes: municipe.observacoes || "",
        tag_ids: [],
        categoria_id: municipe.categoria_id || "",
        representante_id: municipe.representante_id || ""
      });
      setRepresentanteAtivo(municipe.representante_ativo || false);
      setLinkConvite(null);
      setConviteExpiresAt(municipe.invite_expires_at || null);
    }
  }, [municipe]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { buscarCep, isLoading: isBuscandoCep } = useBrasilAPI();
  const [isGeocodificando, setIsGeocodificando] = useState(false);
  const [coordenadas, setCoordenadas] = useState<{ lat: number | null; lng: number | null }>({
    lat: municipe?.latitude || null,
    lng: municipe?.longitude || null
  });

  // Atualizar coordenadas quando municipe muda
  useEffect(() => {
    if (municipe) {
      setCoordenadas({
        lat: municipe.latitude || null,
        lng: municipe.longitude || null
      });
    }
  }, [municipe]);

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
      
      // Coordenadas serão obtidas ao SALVAR (quando o número estiver preenchido)
      toast({
        title: "Endereço encontrado!",
        description: `${resultado.logradouro}, ${resultado.bairro} - ${resultado.cidade}. Preencha o número para localização precisa no mapa.`
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
    if (!formData.logradouro && !formData.bairro) {
      toast({
        title: "Endereço incompleto",
        description: "Preencha ao menos o logradouro ou bairro para geocodificar",
        variant: "destructive"
      });
      return;
    }

    setIsGeocodificando(true);
    try {
      const resultado = await geocodificarEndereco(
        formData.logradouro || '',
        formData.numero || '',
        formData.bairro || '',
        formData.cidade || 'São Paulo',
        'SP'
      );
      
      if (resultado) {
        setCoordenadas({ lat: resultado.latitude, lng: resultado.longitude });
        toast({
          title: "Coordenadas atualizadas!",
          description: `Via ${resultado.fonte}: ${resultado.latitude.toFixed(6)}, ${resultado.longitude.toFixed(6)}`
        });
      } else {
        toast({
          title: "Erro na geocodificação",
          description: "Não foi possível encontrar as coordenadas para este endereço",
          variant: "destructive"
        });
      }
    } finally {
      setIsGeocodificando(false);
    }
  };

  // Processar endereço existente para separar em campos
  useEffect(() => {
    if (municipe?.endereco) {
      const enderecoParts = municipe.endereco.split(',');
      if (enderecoParts.length > 0) {
        const logradouroNumero = enderecoParts[0].trim();
        const numeroMatch = logradouroNumero.match(/(\d+)\s*$/);
        
        if (numeroMatch) {
          const numero = numeroMatch[1];
          const logradouro = logradouroNumero.replace(/\s*\d+\s*$/, '').trim();
          setFormData(prev => ({
            ...prev,
            logradouro,
            numero
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            logradouro: logradouroNumero
          }));
        }
      }
      
      // Verificar se há complemento (após hífen)
      if (enderecoParts.length > 1) {
        const complemento = enderecoParts.slice(1).join(',').replace(/^\s*-\s*/, '').trim();
        setFormData(prev => ({
          ...prev,
          complemento
        }));
      }
    }
  }, [municipe]);

  // Buscar tags disponíveis
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar categorias disponíveis
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipe_categorias')
        .select('id, nome, cor, icone')
        .order('ordem');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar representantes do tenant para o campo "Representante Responsável"
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

  // Buscar tags atuais do munícipe
  const { data: currentTags = [] } = useQuery({
    queryKey: ['municipe-tags', municipe?.id],
    queryFn: async () => {
      if (!municipe?.id) return [];
      
      const { data, error } = await supabase
        .from('municipe_tags')
        .select('tag_id, tags(id, nome, cor)')
        .eq('municipe_id', municipe.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!municipe?.id && open
  });

  // Carregar tags atuais quando currentTags mudar
  useEffect(() => {
    if (currentTags && currentTags.length > 0) {
      setFormData(prev => ({
        ...prev,
        tag_ids: currentTags.map((ct: any) => ct.tag_id)
      }));
    }
  }, [currentTags]);

  const updateMunicipe = useMutation({
    mutationFn: async (data: typeof formData) => {
      console.log('Iniciando atualização do munícipe:', municipe.id, data);
      
      // Montar endereço completo
      let endereco = '';
      if (data.logradouro) {
        endereco = data.logradouro;
        if (data.numero) endereco += `, ${data.numero}`;
        if (data.complemento) endereco += ` - ${data.complemento}`;
      }

      // ========== GEOCODIFICAR ANTES DE SALVAR ==========
      // Usa o endereço completo COM número para precisão máxima
      let latitude: number | null = coordenadas.lat;
      let longitude: number | null = coordenadas.lng;
      let geocodificado = coordenadas.lat !== null && coordenadas.lng !== null;

      // Só regeocodificar se não tiver coordenadas ou se o endereço mudou
      const enderecoMudou = 
        data.logradouro !== '' || // Se preencheu logradouro novo
        data.numero !== '' ||     // Se preencheu número novo
        data.bairro !== municipe?.bairro ||
        data.cidade !== municipe?.cidade;

      if ((data.logradouro || data.bairro) && (!geocodificado || enderecoMudou)) {
        console.log('🗺️ Geocodificando endereço do munícipe antes de salvar...');
        const coordResult = await geocodificarEndereco(
          data.logradouro || '',
          data.numero || '',
          data.bairro || '',
          data.cidade || 'São Paulo',
          'SP'
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

      // Atualizar dados do munícipe
      const { error: updateError, data: updateData } = await supabase
        .from('municipes')
        .update({
          nome: data.nome,
          telefone: data.telefone || null,
          email: data.email || null,
          instagram: data.instagram || null,
          endereco: endereco || null,
          bairro: data.bairro || null,
          cidade: data.cidade,
          cep: data.cep?.replace(/\D/g, '') || null,
          data_nascimento: data.data_nascimento || null,
          observacoes: data.observacoes || null,
          categoria_id: data.categoria_id || null,
          representante_id: data.representante_id || null,
          // Coordenadas atualizadas pela geocodificação
          latitude,
          longitude,
          geocodificado
        })
        .eq('id', municipe.id)
        .select();

      console.log('Resultado da atualização:', { updateError, updateData });

      if (updateError) throw updateError;

      // Gerenciar tags
      // Primeiro, remover todas as tags existentes
      const { error: deleteError } = await supabase
        .from('municipe_tags')
        .delete()
        .eq('municipe_id', municipe.id);

      if (deleteError) {
        console.warn('Erro ao remover tags existentes:', deleteError);
      }

      // Adicionar novas tags
      if (formData.tag_ids.length > 0) {
        const tagInserts = formData.tag_ids.map(tagId => ({
          municipe_id: municipe.id,
          tag_id: tagId
        }));

        const { error: tagError } = await supabase
          .from('municipe_tags')
          .insert(tagInserts);

        if (tagError) {
          console.warn('Erro ao atualizar tags:', tagError);
        }
      }

      return true;
    },
    onSuccess: () => {
      toast({
        title: "Munícipe atualizado com sucesso!",
        description: "As informações foram salvas no sistema."
      });
      queryClient.invalidateQueries({ queryKey: ['municipes-complete'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-select'] });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar munícipe",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // ── Funções de convite de representante ────────────────────────────────
  const handleToggleRepresentante = async (ativo: boolean) => {
    if (ativo) {
      await handleGerarConvite();
    } else {
      try {
        await supabase.rpc('revogar_acesso_representante', { p_municipe_id: municipe.id });
        setRepresentanteAtivo(false);
        setLinkConvite(null);
        setConviteExpiresAt(null);
        queryClient.invalidateQueries({ queryKey: ['municipes-complete'] });
        toast({ title: "Acesso de representante revogado." });
      } catch {
        toast({ title: "Erro ao revogar acesso", variant: "destructive" });
      }
    }
  };

  const handleGerarConvite = async () => {
    setIsGerandoConvite(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('representante-invite', {
        body: { municipe_id: municipe.id },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (error || !data?.success) throw new Error(data?.error || 'Erro ao gerar convite');
      setRepresentanteAtivo(true);
      setLinkConvite(data.link_convite);
      setConviteExpiresAt(data.expires_at);
      queryClient.invalidateQueries({ queryKey: ['municipes-complete'] });
      toast({
        title: data.whatsapp_enviado ? "Convite enviado por WhatsApp!" : "Convite gerado!",
        description: data.whatsapp_enviado ? "O link foi enviado ao representante." : "Copie o link e envie manualmente."
      });
    } catch (err: any) {
      toast({ title: "Erro ao gerar convite", description: err.message, variant: "destructive" });
    } finally {
      setIsGerandoConvite(false);
    }
  };

  const handleCopiarLink = () => {
    if (linkConvite) {
      navigator.clipboard.writeText(linkConvite);
      toast({ title: "Link copiado!" });
    }
  };

  const conviteExpirado = conviteExpiresAt ? new Date(conviteExpiresAt) < new Date() : false;
  const conviteUsado = municipe?.invite_token_usado === true;
  const temProfile = !!municipe?.representante_id && conviteUsado;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) {
      toast({
        title: "Campo obrigatório",
        description: "O nome é obrigatório.",
        variant: "destructive"
      });
      return;
    }
    updateMunicipe.mutate(formData);
  };

  // Funções para gerenciar tags múltiplas
  const handleTagToggle = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId]
    }));
  };

  const removeTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.filter(id => id !== tagId)
    }));
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm">
      <Edit className="h-4 w-4 mr-2" />
      Editar
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Munícipe</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Pessoais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informações Pessoais</h3>
            
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={formData.instagram}
                onChange={(e) => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                placeholder="@usuario"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento</Label>
              <Input
                id="data_nascimento"
                type="date"
                value={formData.data_nascimento}
                onChange={(e) => setFormData(prev => ({ ...prev, data_nascimento: e.target.value }))}
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Endereço</h3>
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
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
                  placeholder="123"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
                  placeholder="Centro, Vila Nova, etc."
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
                <p className="text-xs text-green-600">
                  📍 Coordenadas: {coordenadas.lat.toFixed(6)}, {coordenadas.lng.toFixed(6)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem coordenadas. Clique em "Atualizar Coordenadas" após preencher o endereço.
                </p>
              )}
            </div>
          </div>

          {/* Categoria, Tags e Observações */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informações Adicionais</h3>
            
            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={formData.categoria_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, categoria_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Sem categoria</span>
                  </SelectItem>
                  {categorias.map((categoria: any) => {
                    const IconComponent = categoriaIcons[categoria.icone] || Circle;
                    return (
                      <SelectItem key={categoria.id} value={categoria.id}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" style={{ color: categoria.cor }} />
                          {categoria.nome}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A categoria define o ícone do munícipe no mapa
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Tags</Label>
              
              {/* Tags selecionadas */}
              {formData.tag_ids.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                  {formData.tag_ids.map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    return tag ? (
                      <Badge 
                        key={tag.id} 
                        variant="secondary"
                        className="flex items-center gap-1"
                        style={{ 
                          backgroundColor: `${tag.cor}20`,
                          borderColor: tag.cor,
                          color: tag.cor
                        }}
                      >
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: tag.cor }}
                        />
                        {tag.nome}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:bg-white/20 rounded-full" 
                          onClick={() => removeTag(tag.id)}
                        />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              
              {/* Seletor de tags */}
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-tag-${tag.id}`}
                      checked={formData.tag_ids.includes(tag.id)}
                      onCheckedChange={() => handleTagToggle(tag.id)}
                    />
                    <label
                      htmlFor={`edit-tag-${tag.id}`}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tag.cor }}
                      />
                      {tag.nome}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações adicionais sobre o munícipe"
                rows={3}
              />
            </div>

            {/* Representante Responsável */}
            <div className="space-y-2">
              <Label>Representante Responsável</Label>
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
              <p className="text-xs text-muted-foreground">
                O representante designado poderá ver este munícipe e suas demandas vinculadas.
              </p>
            </div>
          </div>

          {/* Acesso de Representante */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Acesso de Representante</h3>
              </div>
              <Switch
                checked={representanteAtivo}
                onCheckedChange={handleToggleRepresentante}
                disabled={isGerandoConvite}
              />
            </div>

            {representanteAtivo && (
              <div className="space-y-3">
                {temProfile ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <UserCheck className="h-4 w-4" />
                    <span>Acesso ativo — conta criada com sucesso.</span>
                  </div>
                ) : linkConvite ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Convite gerado. Envie o link abaixo ao representante:
                    </p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={linkConvite}
                        className="flex-1 text-xs bg-background border rounded px-2 py-1.5 truncate"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={handleCopiarLink}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {conviteExpiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Expira em: {new Date(conviteExpiresAt).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                ) : conviteExpirado ? (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-600">Convite expirado.</p>
                    <Button type="button" size="sm" variant="outline" onClick={handleGerarConvite} disabled={isGerandoConvite}>
                      {isGerandoConvite ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                      Gerar novo convite
                    </Button>
                  </div>
                ) : conviteExpiresAt && !conviteUsado ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Convite enviado. Aguardando aceitação até {new Date(conviteExpiresAt).toLocaleDateString('pt-BR')}.
                    </p>
                    <Button type="button" size="sm" variant="outline" onClick={handleGerarConvite} disabled={isGerandoConvite}>
                      {isGerandoConvite ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                      Reenviar convite
                    </Button>
                  </div>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={handleGerarConvite} disabled={isGerandoConvite}>
                    {isGerandoConvite ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
                    Gerar link de convite
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive w-full"
                  onClick={() => handleToggleRepresentante(false)}
                >
                  <ShieldOff className="h-3.5 w-3.5 mr-1" />
                  Revogar acesso
                </Button>
              </div>
            )}

            {!representanteAtivo && (
              <p className="text-xs text-muted-foreground">
                Ative para gerar um link de convite e dar acesso de Representante a este munícipe.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMunicipe.isPending}>
              {updateMunicipe.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
