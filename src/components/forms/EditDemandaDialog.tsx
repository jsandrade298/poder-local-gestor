import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, X, Download, Search, MapPin, Loader2, Eye } from "lucide-react";
import { HumorSelector, HumorType, getHumorLabel, getHumorEmoji } from "./HumorSelector";
import { MunicipeCombobox } from "./MunicipeCombobox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBrasilAPI, geocodificarEndereco } from "@/hooks/useBrasilAPI";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { useDemandaNotification } from "@/contexts/DemandaNotificationContext";
import { AnexoPreviewDialog, StorageAnexoThumbnail, LocalFileThumbnail, isPreviewable } from "@/components/ui/AnexoPreview";

interface EditDemandaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demanda: any;
}

export function EditDemandaDialog({ open, onOpenChange, demanda }: EditDemandaDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previewAnexoIndex, setPreviewAnexoIndex] = useState<number | null>(null);
  const [previewFileIndex, setPreviewFileIndex] = useState<number | null>(null);
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
    cidade: "São Paulo",
    cep: "",
    complemento: "",
    observacoes: "",
    resolucao: "",
    humor: null as HumorType,
    origem: ""
  });

  const queryClient = useQueryClient();
  const { statusList, getStatusLabel, shouldNotify } = useDemandaStatus();
  const { addNotification } = useDemandaNotification();

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

  // Hooks de CEP e Geolocalização
  const { buscarCep, isLoading: isBuscandoCep } = useBrasilAPI();
  const [isGeocodificando, setIsGeocodificando] = useState(false);
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
        logradouro: resultado.logradouro || prev.logradouro,
        bairro: resultado.bairro || prev.bairro,
        cidade: resultado.cidade || prev.cidade
      }));
      
      // Coordenadas serão obtidas ao SALVAR (quando o número estiver preenchido)
      toast.success('Endereço encontrado! Preencha o número para localização precisa no mapa.');
    }
  };

  const handleAtualizarGeolocalizacao = async () => {
    if (!formData.logradouro && !formData.bairro) {
      toast.error('Preencha ao menos o logradouro ou bairro para geocodificar');
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
        toast.success(`Coordenadas atualizadas via ${resultado.fonte}: ${resultado.latitude.toFixed(6)}, ${resultado.longitude.toFixed(6)}`);
      } else {
        toast.error('Não foi possível encontrar as coordenadas para este endereço');
      }
    } finally {
      setIsGeocodificando(false);
    }
  };

  // Função para mapear status antigos para novos (compatibilidade)
  const mapStatusAntigoParaNovo = (status: string): string => {
    const mapeamento: Record<string, string> = {
      'aberta': 'solicitada',
      'em_andamento': 'em_producao',
      'aguardando': 'encaminhado',
      'resolvida': 'atendido',
      'cancelada': 'devolvido',
    };
    return mapeamento[status] || status || 'solicitada';
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
        representante_id: demanda.representante_id || "",
        status: mapStatusAntigoParaNovo(demanda.status || "solicitada"),
        data_prazo: demanda.data_prazo || "",
        logradouro: demanda.logradouro || "",
        numero: demanda.numero || "",
        bairro: demanda.bairro || "",
        cidade: demanda.cidade || "São Paulo",
        cep: demanda.cep || "",
        complemento: demanda.complemento || "",
        observacoes: demanda.observacoes || "",
        resolucao: demanda.resolucao || "",
        humor: demanda.humor || null,
        origem: demanda.origem || ""
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

  const updateDemanda = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Obter usuário atual
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      
      if (!userId) throw new Error('Usuário não autenticado');

      // ========== GEOCODIFICAR ANTES DE SALVAR ==========
      // Usa o endereço completo COM número para precisão máxima
      let latitude: number | null = coordenadas.lat;
      let longitude: number | null = coordenadas.lng;
      let geocodificado = coordenadas.lat !== null && coordenadas.lng !== null;

      // Só regeocodificar se não tiver coordenadas ou se o endereço mudou
      const enderecoMudou = 
        data.logradouro !== demanda?.logradouro ||
        data.numero !== demanda?.numero ||
        data.bairro !== demanda?.bairro ||
        data.cidade !== demanda?.cidade;

      if ((data.logradouro || data.bairro) && (!geocodificado || enderecoMudou)) {
        console.log('🗺️ Geocodificando endereço antes de salvar...');
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

      // Buscar dados anteriores e do editor
      const [demandaAnteriorResponse, editorResponse] = await Promise.all([
        supabase
          .from('demandas')
          .select('status, responsavel_id, protocolo, titulo, municipes(nome, telefone, bairro)')
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

      // Garantir que o status seja válido (mapear status antigos se necessário)
      const statusMapeado = mapStatusAntigoParaNovo(data.status);

      // Atualizar demanda
      const cleanData = {
        ...data,
        status: statusMapeado,
        area_id: data.area_id || null,
        responsavel_id: data.responsavel_id || null,
        representante_id: data.representante_id || null,
        data_prazo: data.data_prazo || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        bairro: data.bairro || null,
        cep: data.cep?.replace(/\D/g, '') || null,
        complemento: data.complemento || null,
        observacoes: data.observacoes || null,
        resolucao: data.resolucao || null,
        humor: data.humor || null,
        origem: data.origem || null,
        // Coordenadas atualizadas pela geocodificação
        latitude,
        longitude,
        geocodificado
      };

      const { error } = await supabase
        .from('demandas')
        .update(cleanData)
        .eq('id', demanda.id);

      if (error) throw error;

      // Regenerar embedding se título, descrição ou bairro foram alterados
      const camposSemanticos = ['titulo', 'descricao', 'bairro'];
      const mudouSemantica = camposSemanticos.some(
        campo => cleanData[campo] !== undefined
      );
      if (mudouSemantica) {
        supabase.functions.invoke('gerar-embedding', { body: { demanda_id: demanda.id } });
      }

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

      // Mapear status anterior para comparação correta
      const statusAnteriorMapeado = mapStatusAntigoParaNovo(statusAnterior || 'solicitada');

      // ========== NOTIFICAÇÃO WHATSAPP DIRETA ==========
      // Dispara notificação diretamente, sem depender de Supabase Realtime
      if (statusAnteriorMapeado !== statusMapeado && municipeData?.telefone && shouldNotify(statusMapeado)) {
        try {
          // Buscar configurações de WhatsApp para demandas
          const { data: whatsConfigs } = await supabase
            .from('configuracoes')
            .select('chave, valor')
            .in('chave', ['whatsapp_instancia_demandas', 'whatsapp_mensagem_demandas', 'whatsapp_demandas_ativo']);

          const whatsConfigMap = (whatsConfigs || []).reduce((acc: any, item: any) => {
            acc[item.chave] = item.valor;
            return acc;
          }, {});

          const whatsAtivo = whatsConfigMap.whatsapp_demandas_ativo === 'true';
          const whatsInstancia = whatsConfigMap.whatsapp_instancia_demandas;
          const whatsMensagem = whatsConfigMap.whatsapp_mensagem_demandas;

          if (whatsAtivo && whatsInstancia && whatsMensagem) {
            // Obter nome amigável do status
            const statusTexto = getStatusLabel(statusMapeado);

            addNotification({
              demanda_id: demanda.id,
              demanda_titulo: data.titulo,
              demanda_protocolo: demandaAnterior?.protocolo || '',
              municipe_nome: municipeData.nome,
              municipe_bairro: (municipeData as any)?.bairro || '',
              telefone: municipeData.telefone,
              novo_status: statusTexto,
              instanceName: whatsInstancia
            });

            console.log('🔔 Notificação WhatsApp adicionada à fila para', municipeData.nome);
            whatsappEnviado = true;
          } else {
            console.log('⚠️ Notificações WhatsApp de demandas não estão ativas ou configuradas');
          }
        } catch (whatsError) {
          console.error('Erro ao verificar/enviar notificação WhatsApp:', whatsError);
          // Não impede o salvamento da demanda
        }
      }

      // ========== REGISTRAR MUDANÇA DE STATUS NO PRONTUÁRIO DO MUNÍCIPE ==========
      if (statusAnteriorMapeado !== statusMapeado && demanda.municipe_id) {
        try {
          console.log('📋 Registrando mudança de status no prontuário do munícipe...');
          
          const { error: prontuarioError } = await supabase
            .from('municipe_atividades')
            .insert({
              municipe_id: demanda.municipe_id,
              created_by: userId,
              tipo_atividade: 'anotacao',
              titulo: `Demanda #${demanda.protocolo} - Status alterado`,
              descricao: `A demanda "${data.titulo}" teve seu status alterado de "${getStatusLabel(statusAnteriorMapeado)}" para "${getStatusLabel(statusMapeado)}".`,
              data_atividade: new Date().toISOString()
            });

          if (prontuarioError) {
            console.error('Erro ao registrar no prontuário:', prontuarioError);
          } else {
            console.log('✅ Mudança de status registrada no prontuário do munícipe');
          }
        } catch (prontuarioErr) {
          console.error('Erro ao registrar atividade no prontuário:', prontuarioErr);
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
      queryClient.invalidateQueries({ queryKey: ['municipe-atividades', demanda?.municipe_id] });
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
                {anexos.map((anexo, index) => (
                  <div key={anexo.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      onClick={() => isPreviewable(anexo.nome_arquivo, anexo.tipo_arquivo) ? setPreviewAnexoIndex(index) : downloadAnexo(anexo)}
                    >
                      <StorageAnexoThumbnail
                        anexo={anexo}
                        onClick={() => isPreviewable(anexo.nome_arquivo, anexo.tipo_arquivo) ? setPreviewAnexoIndex(index) : downloadAnexo(anexo)}
                      />
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{anexo.nome_arquivo}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(anexo.tamanho_arquivo / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      {isPreviewable(anexo.nome_arquivo, anexo.tipo_arquivo) && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setPreviewAnexoIndex(index)} title="Visualizar">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => downloadAnexo(anexo)} title="Baixar">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => deleteAnexo.mutate(anexo.id)} disabled={deleteAnexo.isPending} title="Remover">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview Dialog para anexos existentes */}
              <AnexoPreviewDialog
                open={previewAnexoIndex !== null}
                onOpenChange={(open) => { if (!open) setPreviewAnexoIndex(null); }}
                anexo={previewAnexoIndex !== null ? anexos[previewAnexoIndex] : null}
                hasPrev={previewAnexoIndex !== null && previewAnexoIndex > 0}
                hasNext={previewAnexoIndex !== null && previewAnexoIndex < anexos.length - 1}
                onPrev={() => setPreviewAnexoIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                onNext={() => setPreviewAnexoIndex((i) => (i !== null && i < anexos.length - 1 ? i + 1 : i))}
              />
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
                      <div
                        className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                        onClick={() => isPreviewable(file.name, file.type) ? setPreviewFileIndex(index) : undefined}
                      >
                        <LocalFileThumbnail
                          file={file}
                          onClick={() => isPreviewable(file.name, file.type) ? setPreviewFileIndex(index) : undefined}
                        />
                        <div className="min-w-0">
                          <span className="text-sm truncate block">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        {isPreviewable(file.name, file.type) && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewFileIndex(index)} title="Visualizar">
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview Dialog para novos arquivos */}
                <AnexoPreviewDialog
                  open={previewFileIndex !== null}
                  onOpenChange={(open) => { if (!open) setPreviewFileIndex(null); }}
                  localFile={previewFileIndex !== null ? files[previewFileIndex] : null}
                  hasPrev={previewFileIndex !== null && previewFileIndex > 0}
                  hasNext={previewFileIndex !== null && previewFileIndex < files.length - 1}
                  onPrev={() => setPreviewFileIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  onNext={() => setPreviewFileIndex((i) => (i !== null && i < files.length - 1 ? i + 1 : i))}
                />
              </div>
            )}
          </div>

          {/* Vinculações */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Vinculações</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="municipe">Munícipe *</Label>
                <MunicipeCombobox
                  value={formData.municipe_id}
                  onChange={(id) => setFormData(prev => ({ ...prev, municipe_id: id }))}
                  initialDisplayName={(demanda?.municipes as any)?.nome}
                  placeholder="Buscar por nome, telefone ou bairro..."
                />
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

              {representantes.length > 0 && (
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
