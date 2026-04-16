import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Search, Loader2, MapPin, Star, Circle, Square, Triangle, Hexagon, Heart, Pentagon, Diamond, Cross, RectangleHorizontal } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateOnly } from "@/lib/dateUtils";
import { CriarDemandaAposCadastroDialog } from "./CriarDemandaAposCadastroDialog";
import { useBrasilAPI, geocodificarEndereco } from "@/hooks/useBrasilAPI";
import { useAuth } from "@/contexts/AuthContext";
import { maskPhoneInput, normalizePhone } from "@/lib/phoneUtils";

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

export function NovoMunicipeDialog() {
  const { user, roleNoTenant } = useAuth();
  const isRepresentante = roleNoTenant === "representante";

  const [open, setOpen] = useState(false);
  const [demandaDialogOpen, setDemandaDialogOpen] = useState(false);
  const [createdMunicipe, setCreatedMunicipe] = useState<{ id: string; nome: string } | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    instagram: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "SP",
    cep: "",
    complemento: "",
    data_nascimento: "",
    observacoes: "",
    tag_ids: [] as string[],
    categoria_id: "" as string,
    representante_id: "" as string
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { buscarCep, isLoading: isBuscandoCep } = useBrasilAPI();
  const [isGeocodificando, setIsGeocodificando] = useState(false);
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
        cidade: resultado.cidade || prev.cidade,
        estado: resultado.estado || prev.estado
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

  // Buscar representantes do tenant
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

  const createMunicipe = useMutation({
    mutationFn: async (data: typeof formData) => {
      // ========== GEOCODIFICAR ANTES DE SALVAR ==========
      // Usa o endereço completo COM número para precisão máxima
      let latitude: number | null = null;
      let longitude: number | null = null;
      let geocodificado = false;

      if (data.logradouro || data.bairro) {
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

      const { data: municipe, error } = await supabase
        .from('municipes')
        .insert({
          nome: data.nome,
          telefone: normalizePhone(data.telefone) || null,
          email: data.email || null,
          instagram: data.instagram || null,
          endereco: `${data.logradouro}${data.numero ? ', ' + data.numero : ''}${data.complemento ? ' - ' + data.complemento : ''}`,
          bairro: data.bairro,
          cidade: data.cidade,
          estado: data.estado || null,
          cep: data.cep?.replace(/\D/g, '') || null,
          data_nascimento: data.data_nascimento || null,
          observacoes: data.observacoes || null,
          categoria_id: data.categoria_id || null,
          // FIX: Se o usuário é representante, forçar representante_id = user.id
          representante_id: isRepresentante ? user?.id : (data.representante_id || null),
          // Coordenadas obtidas pela geocodificação
          latitude,
          longitude,
          geocodificado
        })
        .select('id, nome')
        .single();

      if (error) throw error;

      // Se tags foram selecionadas, criar as relações
      if (data.tag_ids.length > 0 && municipe) {
        const tagInserts = data.tag_ids.map(tagId => ({
          municipe_id: municipe.id,
          tag_id: tagId
        }));

        const { error: tagError } = await supabase
          .from('municipe_tags')
          .insert(tagInserts);

        if (tagError) {
          console.warn('Erro ao vincular tags:', tagError);
          // Não vamos falhar a criação do munícipe por causa das tags
        }
      }

      return municipe;
    },
    onSuccess: (municipe) => {
      queryClient.invalidateQueries({ queryKey: ['municipes-complete'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['municipes-select'] });
      // FIX: Invalidar queries do portal do representante
      queryClient.invalidateQueries({ queryKey: ['rep-municipes'] });
      queryClient.invalidateQueries({ queryKey: ['rep-dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['rep-dashboard-aniversarios'] });
      setOpen(false);
      setFormData({
        nome: "",
        telefone: "",
        email: "",
        instagram: "",
        logradouro: "",
        numero: "",
        bairro: "",
        cidade: "",
        estado: "SP",
        cep: "",
        complemento: "",
        data_nascimento: "",
        observacoes: "",
        tag_ids: [],
        categoria_id: "",
        representante_id: ""
      });
      
      // Abrir dialog para criar demanda
      setCreatedMunicipe(municipe);
      setDemandaDialogOpen(true);
    },
    onError: (error) => {
      toast({
        title: "Erro ao cadastrar munícipe",
        description: error.message,
        variant: "destructive"
      });
    }
  });

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
    createMunicipe.mutate(formData);
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

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Munícipe
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Munícipe</DialogTitle>
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
                    onChange={(e) => setFormData(prev => ({ ...prev, telefone: maskPhoneInput(e.target.value) }))}
                    placeholder="(11) 99999-1111"
                    inputMode="tel"
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
                    {isBuscandoCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    placeholder="Digite a cidade"
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
                    {isGeocodificando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
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

            {/* Informações Adicionais */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informações Adicionais</h3>

              {/* Representante Responsável */}
              {/* FIX: Representante logado não vê o seletor — é auto-preenchido */}
              {isRepresentante ? (
                <div className="space-y-2">
                  <Label>Representante Responsável</Label>
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50 text-sm text-muted-foreground">
                    Vinculado automaticamente a você
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este munícipe ficará vinculado ao seu acesso de representante.
                  </p>
                </div>
              ) : (
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
              )}

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
                {formData.tag_ids.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                    {formData.tag_ids.map(tagId => {
                      const tag = tags.find(t => t.id === tagId);
                      return tag ? (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          className="flex items-center gap-1"
                          style={{ backgroundColor: `${tag.cor}20`, borderColor: tag.cor, color: tag.cor }}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.cor }} />
                          {tag.nome}
                          <X className="h-3 w-3 cursor-pointer hover:bg-white/20 rounded-full" onClick={() => removeTag(tag.id)} />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag.id}`}
                        checked={formData.tag_ids.includes(tag.id)}
                        onCheckedChange={() => handleTagToggle(tag.id)}
                      />
                      <label htmlFor={`tag-${tag.id}`} className="flex items-center gap-2 text-sm cursor-pointer">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.cor }} />
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
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMunicipe.isPending}>
                {createMunicipe.isPending ? "Cadastrando..." : "Cadastrar Munícipe"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para criar demanda após cadastro do munícipe */}
      {createdMunicipe && (
        <CriarDemandaAposCadastroDialog
          open={demandaDialogOpen}
          onOpenChange={setDemandaDialogOpen}
          municipeId={createdMunicipe.id}
          municipeName={createdMunicipe.nome}
        />
      )}
    </>
  );
}
