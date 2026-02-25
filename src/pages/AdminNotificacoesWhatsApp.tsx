import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Bell,
  Bot,
  CheckCircle2,
  ListChecks,
  Loader2,
  MessageCircle,
  Phone,
  Save,
  Send,
  Settings2,
  Shield,
  Smartphone,
  Wifi,
  WifiOff,
  XCircle,
  AlertTriangle,
  Info,
  BarChart3,
} from "lucide-react";

// ============================================================
// Tipos
// ============================================================

interface NotificationConfig {
  id?: string;
  // Z-API
  zapi_instance_id: string;
  zapi_token: string;
  zapi_client_token: string;
  zapi_phone_number: string;
  // IA Notificações
  openai_api_key: string;
  usar_ia: boolean;
  tom_mensagem: string;
  mensagem_fallback: string;
  tipos_ativos: string[];
  // Supabase trigger
  supabase_url: string;
  supabase_anon_key: string;
  ativo: boolean;
  // Assessor Virtual
  assessor_ativo: boolean;
  assessor_nome: string;
  assessor_system_prompt_extra: string;
  assessor_funcoes_ativas: string[];
  assessor_saudacao_inicial: string;
  assessor_saudacao_desconhecido: string;
  assessor_mensagem_encerramento: string;
  assessor_kanban_type_padrao: string;
}

const EMPTY_CONFIG: NotificationConfig = {
  zapi_instance_id: "",
  zapi_token: "",
  zapi_client_token: "",
  zapi_phone_number: "",
  openai_api_key: "",
  usar_ia: true,
  tom_mensagem: "profissional_leve",
  mensagem_fallback:
    "🔔 Olá {primeiro_nome}!\n\n📋 {tipo}: {mensagem}\n\n💡 Acesse o Poder Local Gestor para ver todos os detalhes e próximas ações.\n\n✅ Confirme o recebimento respondendo OK.",
  tipos_ativos: [
    "atribuicao",
    "mencao",
    "tarefa_atribuida",
    "agenda_solicitada",
    "agenda_acompanhante",
    "agenda_status",
    "agenda_mensagem",
  ],
  supabase_url: "",
  supabase_anon_key: "",
  ativo: false,
  // Assessor
  assessor_ativo: false,
  assessor_nome: "Assessor Virtual",
  assessor_system_prompt_extra: "",
  assessor_funcoes_ativas: [
    "solicitar_agenda",
    "cadastrar_demanda",
    "consultar_demandas",
    "atualizar_demanda",
    "cadastrar_municipe",
    "atualizar_municipe_prontuario",
    "consultar_municipe",
    "criar_tarefa_kanban",
  ],
  assessor_saudacao_inicial:
    "Olá, {nome}! 👋 Sou o Assessor Virtual do gabinete.\n\nComo posso te ajudar?\n\n📅 Solicitar Agenda\n📋 Cadastrar Demanda\n🔍 Consultar Demandas\n👤 Gerenciar Munícipes\n✅ Criar Tarefa no Kanban",
  assessor_saudacao_desconhecido:
    "Olá! 👋 Seu número não está cadastrado no sistema.\n\nPor favor, peça ao administrador do seu gabinete para cadastrar seu número de telefone.",
  assessor_mensagem_encerramento: "Fico à disposição! Até mais. 😊",
  assessor_kanban_type_padrao: "Pessoal",
};

const TIPOS_NOTIFICACAO = [
  { id: "atribuicao", label: "Atribuição de demanda", desc: "Quando um responsável é atribuído a uma demanda", icon: "📋" },
  { id: "mencao", label: "Menção em atividade", desc: "Quando um usuário é mencionado em uma atividade de demanda", icon: "💬" },
  { id: "tarefa_atribuida", label: "Tarefa atribuída", desc: "Quando um colaborador é adicionado a uma tarefa do Kanban", icon: "✅" },
  { id: "agenda_solicitada", label: "Solicitação de agenda", desc: "Quando uma nova agenda é solicitada para validação", icon: "📅" },
  { id: "agenda_acompanhante", label: "Acompanhante de agenda", desc: "Quando um usuário é adicionado como acompanhante", icon: "👥" },
  { id: "agenda_status", label: "Atualização de agenda", desc: "Quando o status da agenda muda ou há edições importantes", icon: "🔄" },
  { id: "agenda_mensagem", label: "Mensagem na agenda", desc: "Quando uma mensagem é postada em uma agenda", icon: "✉️" },
];

const VARIAVEIS_TEMPLATE = [
  { var: "{nome}", desc: "Nome completo do destinatário" },
  { var: "{primeiro_nome}", desc: "Primeiro nome do destinatário" },
  { var: "{tipo}", desc: "Tipo da notificação (texto amigável)" },
  { var: "{titulo}", desc: "Título da notificação" },
  { var: "{mensagem}", desc: "Mensagem completa da notificação" },
  { var: "{data}", desc: "Data atual (dd/mm/aaaa)" },
  { var: "{hora}", desc: "Hora atual (hh:mm)" },
];

const TODAS_FUNCOES_ASSESSOR = [
  { id: "solicitar_agenda", label: "📅 Solicitar Agenda" },
  { id: "cadastrar_demanda", label: "📋 Cadastrar Demanda" },
  { id: "consultar_demandas", label: "🔍 Consultar Demandas" },
  { id: "atualizar_demanda", label: "✏️ Atualizar Demanda" },
  { id: "cadastrar_municipe", label: "👤 Cadastrar Munícipe" },
  { id: "atualizar_municipe_prontuario", label: "📝 Atualizar Prontuário" },
  { id: "consultar_municipe", label: "🔎 Consultar Munícipe" },
  { id: "criar_tarefa_kanban", label: "✅ Criar Tarefa no Kanban" },
];

// ============================================================
// Componente principal
// ============================================================

export default function AdminNotificacoesWhatsApp() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<NotificationConfig>(EMPTY_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [testando, setTestando] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Carregar configuração existente
  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["notification-whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_whatsapp_config" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) { console.error("Erro ao carregar config:", error); return null; }
      return data;
    },
  });

  // Estatísticas de notificações
  const { data: stats } = useQuery({
    queryKey: ["notification-whatsapp-stats"],
    queryFn: async () => {
      const { count: totalEnviadas } = await supabase
        .from("notificacoes").select("*", { count: "exact", head: true }).eq("whatsapp_enviado", true);
      const { count: totalConfirmadas } = await supabase
        .from("notificacoes").select("*", { count: "exact", head: true })
        .eq("whatsapp_enviado", true).not("whatsapp_confirmado_em", "is", null);
      const { count: ultimaSemana } = await supabase
        .from("notificacoes").select("*", { count: "exact", head: true })
        .eq("whatsapp_enviado", true)
        .gte("whatsapp_enviado_em", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      return {
        totalEnviadas: totalEnviadas || 0,
        totalConfirmadas: totalConfirmadas || 0,
        ultimaSemana: ultimaSemana || 0,
        taxaConfirmacao: totalEnviadas && totalEnviadas > 0
          ? Math.round(((totalConfirmadas || 0) / totalEnviadas) * 100) : 0,
      };
    },
  });

  // Estatísticas do assessor
  const { data: assessorStats } = useQuery({
    queryKey: ["assessor-stats"],
    queryFn: async () => {
      const { count: totalInteracoes } = await supabase
        .from("whatsapp_assessor_logs").select("*", { count: "exact", head: true });
      const { data: tokens } = await supabase
        .from("whatsapp_assessor_logs").select("tokens_input, tokens_output");
      const tokensUsados = (tokens || []).reduce(
        (acc: number, r: { tokens_input: number; tokens_output: number }) =>
          acc + (r.tokens_input || 0) + (r.tokens_output || 0), 0
      );
      const { count: sessoesAtivas } = await supabase
        .from("whatsapp_assessor_sessoes").select("*", { count: "exact", head: true }).eq("ativa", true);
      return {
        totalInteracoes: totalInteracoes || 0,
        tokensUsados,
        sessoesAtivas: sessoesAtivas || 0,
      };
    },
  });

  // Popular form quando dados carregam
  useEffect(() => {
    if (savedConfig) {
      setConfig({
        id: savedConfig.id,
        zapi_instance_id: savedConfig.zapi_instance_id || "",
        zapi_token: savedConfig.zapi_token || "",
        zapi_client_token: savedConfig.zapi_client_token || "",
        zapi_phone_number: savedConfig.zapi_phone_number || "",
        openai_api_key: savedConfig.openai_api_key || "",
        usar_ia: savedConfig.usar_ia ?? true,
        tom_mensagem: savedConfig.tom_mensagem || "profissional_leve",
        mensagem_fallback: savedConfig.mensagem_fallback || EMPTY_CONFIG.mensagem_fallback,
        tipos_ativos: savedConfig.tipos_ativos || EMPTY_CONFIG.tipos_ativos,
        supabase_url: savedConfig.supabase_url || "",
        supabase_anon_key: savedConfig.supabase_anon_key || "",
        ativo: savedConfig.ativo ?? false,
        // Assessor
        assessor_ativo: savedConfig.assessor_ativo ?? false,
        assessor_nome: savedConfig.assessor_nome || "Assessor Virtual",
        assessor_system_prompt_extra: savedConfig.assessor_system_prompt_extra || "",
        assessor_funcoes_ativas: savedConfig.assessor_funcoes_ativas || EMPTY_CONFIG.assessor_funcoes_ativas,
        assessor_saudacao_inicial: savedConfig.assessor_saudacao_inicial || EMPTY_CONFIG.assessor_saudacao_inicial,
        assessor_saudacao_desconhecido: savedConfig.assessor_saudacao_desconhecido || EMPTY_CONFIG.assessor_saudacao_desconhecido,
        assessor_mensagem_encerramento: savedConfig.assessor_mensagem_encerramento || EMPTY_CONFIG.assessor_mensagem_encerramento,
        assessor_kanban_type_padrao: savedConfig.assessor_kanban_type_padrao || "Pessoal",
      });
    }
  }, [savedConfig]);

  const updateField = (field: keyof NotificationConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleTipo = (tipo: string) => {
    setConfig((prev) => {
      const tipos = prev.tipos_ativos.includes(tipo)
        ? prev.tipos_ativos.filter((t) => t !== tipo)
        : [...prev.tipos_ativos, tipo];
      return { ...prev, tipos_ativos: tipos };
    });
    setHasChanges(true);
  };

  const toggleFuncaoAssessor = (id: string) => {
    setConfig((prev) => {
      const fns = prev.assessor_funcoes_ativas.includes(id)
        ? prev.assessor_funcoes_ativas.filter((f) => f !== id)
        : [...prev.assessor_funcoes_ativas, id];
      return { ...prev, assessor_funcoes_ativas: fns };
    });
    setHasChanges(true);
  };

  // Salvar tudo (notificações + assessor juntos)
  const salvarMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        zapi_instance_id: config.zapi_instance_id || null,
        zapi_token: config.zapi_token || null,
        zapi_client_token: config.zapi_client_token || null,
        zapi_phone_number: config.zapi_phone_number || null,
        openai_api_key: config.openai_api_key || null,
        usar_ia: config.usar_ia,
        tom_mensagem: config.tom_mensagem,
        mensagem_fallback: config.mensagem_fallback,
        tipos_ativos: config.tipos_ativos,
        supabase_url: config.supabase_url || null,
        supabase_anon_key: config.supabase_anon_key || null,
        ativo: config.ativo,
        // Assessor
        assessor_ativo: config.assessor_ativo,
        assessor_nome: config.assessor_nome,
        assessor_system_prompt_extra: config.assessor_system_prompt_extra || null,
        assessor_funcoes_ativas: config.assessor_funcoes_ativas,
        assessor_saudacao_inicial: config.assessor_saudacao_inicial,
        assessor_saudacao_desconhecido: config.assessor_saudacao_desconhecido,
        assessor_mensagem_encerramento: config.assessor_mensagem_encerramento,
        assessor_kanban_type_padrao: config.assessor_kanban_type_padrao,
        updated_at: new Date().toISOString(),
      };

      if (config.id) {
        const { error } = await supabase
          .from("notification_whatsapp_config" as any).update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("notification_whatsapp_config" as any).insert(payload).select().single();
        if (error) throw error;
        setConfig((prev) => ({ ...prev, id: data.id }));
      }
    },
    onSuccess: () => {
      toast({ title: "Configuração salva!", description: "As alterações foram aplicadas." });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["notification-whatsapp-config"] });
      queryClient.invalidateQueries({ queryKey: ["assessor-stats"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  // Testar envio
  const testarEnvio = async () => {
    setTestando(true);
    setTestResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data: profile } = await supabase.from("profiles").select("nome, telefone").eq("id", user.id).single();
      if (!profile?.telefone) {
        setTestResult({ ok: false, msg: "Seu perfil não tem telefone cadastrado." });
        return;
      }
      const { data, error } = await supabase.functions.invoke("notificar-usuario-whatsapp", {
        body: {
          notificacao_id: "test-" + Date.now(),
          destinatario_id: user.id,
          destinatario_nome: profile.nome || "Teste",
          destinatario_telefone: profile.telefone,
          tipo: "atribuicao",
          titulo: "Teste de notificação",
          mensagem: "Esta é uma mensagem de teste do sistema de notificações WhatsApp.",
          url_destino: "/demandas",
          tenant_id: "",
        },
      });
      if (error) throw error;
      setTestResult({
        ok: data?.success,
        msg: data?.success
          ? `Enviado! Método: ${data.method}${data.ia_usada ? " (com IA)" : " (template)"}`
          : `Falha: ${data?.reason || data?.error || "Erro desconhecido"}`,
      });
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTestando(false);
    }
  };

  const configCompleta =
    config.zapi_instance_id && config.zapi_token &&
    config.zapi_client_token && config.supabase_url && config.supabase_anon_key;

  const assessorPronto =
    configCompleta && config.openai_api_key && config.ativo;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-[900px]">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6" />
            WhatsApp — Notificações &amp; Assessor Virtual
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configuração global — acesso restrito ao super-admin
          </p>
        </div>
        <Button onClick={() => salvarMutation.mutate()} disabled={!hasChanges || salvarMutation.isPending}>
          {salvarMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="notificacoes">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="notificacoes">
            <Bell className="h-4 w-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="assessor">
            <Bot className="h-4 w-4 mr-2" />
            Assessor Virtual
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════ */}
        {/* ABA NOTIFICAÇÕES (conteúdo original preservado)   */}
        {/* ══════════════════════════════════════════════════ */}
        <TabsContent value="notificacoes" className="space-y-6 mt-4">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {config.ativo
                        ? <Badge className="bg-green-500 text-white">Ativo</Badge>
                        : <Badge variant="secondary">Inativo</Badge>}
                    </div>
                  </div>
                  {config.ativo
                    ? <Wifi className="h-5 w-5 text-green-500" />
                    : <WifiOff className="h-5 w-5 text-muted-foreground" />}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">Enviadas</p>
                <p className="text-2xl font-bold mt-1">{stats?.totalEnviadas || 0}</p>
                <p className="text-xs text-muted-foreground">{stats?.ultimaSemana || 0} na última semana</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">Confirmadas</p>
                <p className="text-2xl font-bold mt-1">{stats?.totalConfirmadas || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">Taxa Confirmação</p>
                <p className="text-2xl font-bold mt-1">{stats?.taxaConfirmacao || 0}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Ativar */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-semibold">Sistema de Notificações WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativado, toda notificação interna (sino) também será enviada via WhatsApp
                  </p>
                </div>
                <Switch
                  checked={config.ativo}
                  onCheckedChange={(v) => updateField("ativo", v)}
                  disabled={!configCompleta && !config.ativo}
                />
              </div>
              {!configCompleta && !config.ativo && (
                <div className="flex items-center gap-2 mt-3 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>Preencha as credenciais Z-API e a conexão Supabase antes de ativar.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Z-API */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4" />Instância Z-API
              </CardTitle>
              <CardDescription>
                Instância dedicada para enviar as notificações do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Instance ID</Label>
                  <Input placeholder="Ex: 3C4A7E8B..." value={config.zapi_instance_id} onChange={(e) => updateField("zapi_instance_id", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Token</Label>
                  <Input type="password" placeholder="Token da instância" value={config.zapi_token} onChange={(e) => updateField("zapi_token", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Client Token</Label>
                  <Input type="password" placeholder="Client Token da conta Z-API" value={config.zapi_client_token} onChange={(e) => updateField("zapi_client_token", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Número do WhatsApp</Label>
                  <Input placeholder="Ex: 11999999999" value={config.zapi_phone_number} onChange={(e) => updateField("zapi_phone_number", e.target.value)} />
                  <p className="text-xs text-muted-foreground">Apenas para referência visual</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* IA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" />Inteligência Artificial
              </CardTitle>
              <CardDescription>
                Usa GPT para gerar mensagens variadas e naturais. Reduz risco de banimento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Usar IA para gerar mensagens</Label>
                  <p className="text-xs text-muted-foreground">Se desativado ou falhar, usa o template de fallback</p>
                </div>
                <Switch checked={config.usar_ia} onCheckedChange={(v) => updateField("usar_ia", v)} />
              </div>
              {config.usar_ia && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Chave OpenAI API</Label>
                    <Input type="password" placeholder="sk-..." value={config.openai_api_key} onChange={(e) => updateField("openai_api_key", e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                      Modelo: gpt-4o-mini (~$0.15/1M tokens). Esta chave também é usada pelo Assessor Virtual.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Tom das mensagens</Label>
                    <Select value={config.tom_mensagem} onValueChange={(v) => updateField("tom_mensagem", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profissional">Profissional — Formal, sem emojis</SelectItem>
                        <SelectItem value="profissional_leve">Profissional leve — Amigável, com emojis (recomendado)</SelectItem>
                        <SelectItem value="humoristico">Humorístico — Criativo, com humor sutil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Fallback */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />Mensagem de Fallback
              </CardTitle>
              <CardDescription>Template usado quando a IA está desativada ou falha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea rows={6} value={config.mensagem_fallback} onChange={(e) => updateField("mensagem_fallback", e.target.value)} className="font-mono text-sm" />
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Variáveis disponíveis:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {VARIAVEIS_TEMPLATE.map((v) => (
                    <div key={v.var} className="text-xs">
                      <code className="bg-muted px-1 py-0.5 rounded font-mono text-primary">{v.var}</code>{" "}
                      <span className="text-muted-foreground">— {v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tipos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" />Tipos de Notificação
              </CardTitle>
              <CardDescription>Quais notificações internas também serão enviadas por WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {TIPOS_NOTIFICACAO.map((tipo) => (
                  <div key={tipo.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{tipo.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{tipo.label}</p>
                        <p className="text-xs text-muted-foreground">{tipo.desc}</p>
                      </div>
                    </div>
                    <Switch checked={config.tipos_ativos.includes(tipo.id)} onCheckedChange={() => toggleTipo(tipo.id)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Supabase */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />Conexão do Trigger
              </CardTitle>
              <CardDescription>URL e chave anônima do Supabase para o trigger chamar a Edge Function.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Supabase URL</Label>
                <Input placeholder="https://xxxxx.supabase.co" value={config.supabase_url} onChange={(e) => updateField("supabase_url", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Supabase Anon Key</Label>
                <Input placeholder="eyJhbGciOiJIUzI1NiIs..." value={config.supabase_anon_key} onChange={(e) => updateField("supabase_anon_key", e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="flex items-start gap-2 text-sm bg-blue-50 text-blue-700 rounded-lg p-3">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Onde encontrar?</p>
                  <p className="text-xs mt-1">Dashboard Supabase → Settings → API (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Teste */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" />Teste de Envio
              </CardTitle>
              <CardDescription>Envia uma notificação de teste para o seu WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" onClick={testarEnvio} disabled={testando || !configCompleta}>
                {testando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Phone className="h-4 w-4 mr-2" />}
                Enviar teste para meu WhatsApp
              </Button>
              {testResult && (
                <div className={`flex items-center gap-2 text-sm rounded-lg p-3 ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {testResult.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <XCircle className="h-4 w-4 flex-shrink-0" />}
                  <span>{testResult.msg}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook */}
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />Configuração do Webhook Z-API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Configure o webhook da instância Z-API para apontar para:</p>
              <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all">
                {config.supabase_url
                  ? `${config.supabase_url}/functions/v1/whatsapp-webhook`
                  : "https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-webhook"}
              </div>
              <p className="text-muted-foreground text-xs">
                Habilite os eventos <strong>ReceivedCallback</strong> e <strong>MessageStatusCallback</strong>.
              </p>
            </CardContent>
          </Card>

          {/* pg_net */}
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                <Info className="h-4 w-4" />Extensão pg_net
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>O sistema usa <code className="bg-muted px-1 rounded">pg_net</code> para o trigger chamar a Edge Function assincronamente.</p>
              <p className="text-muted-foreground text-xs">
                Se não funcionar: Dashboard Supabase → Database → Extensions → pg_net → Enable.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════ */}
        {/* ABA ASSESSOR VIRTUAL                              */}
        {/* ══════════════════════════════════════════════════ */}
        <TabsContent value="assessor" className="space-y-6 mt-4">

          {/* Pré-requisitos */}
          {!assessorPronto && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-800 space-y-1">
                    <p className="font-medium">Pré-requisitos para ativar o Assessor</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className={configCompleta ? "border-green-500 text-green-700" : "border-red-400 text-red-700"}>
                        {configCompleta ? "✅" : "❌"} Z-API configurada
                      </Badge>
                      <Badge variant="outline" className={config.ativo ? "border-green-500 text-green-700" : "border-red-400 text-red-700"}>
                        {config.ativo ? "✅" : "❌"} Canal de notificações ativo
                      </Badge>
                      <Badge variant="outline" className={config.openai_api_key ? "border-green-500 text-green-700" : "border-red-400 text-red-700"}>
                        {config.openai_api_key ? "✅" : "❌"} Chave OpenAI preenchida
                      </Badge>
                    </div>
                    <p className="text-xs mt-1">Configure os itens ausentes na aba <strong>Notificações</strong>.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats do assessor */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Interações</span>
                </div>
                <p className="text-2xl font-bold">{assessorStats?.totalInteracoes?.toLocaleString() || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Tokens usados</span>
                </div>
                <p className="text-2xl font-bold">{assessorStats?.tokensUsados?.toLocaleString() || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Sessões ativas</span>
                </div>
                <p className="text-2xl font-bold">{assessorStats?.sessoesAtivas || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Ativar Assessor */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-semibold">Assessor Virtual WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativado, membros da equipe podem conversar com a IA via WhatsApp para cadastrar demandas, munícipes, agendas e tarefas.
                  </p>
                </div>
                <Switch
                  checked={config.assessor_ativo}
                  onCheckedChange={(v) => updateField("assessor_ativo", v)}
                  disabled={!assessorPronto && !config.assessor_ativo}
                />
              </div>
              {config.assessor_ativo && (
                <div className="flex items-center gap-2 mt-3 text-sm text-green-700 bg-green-50 rounded-lg p-3">
                  <Wifi className="h-4 w-4 flex-shrink-0" />
                  <span>Assessor ativo — aguardando mensagens no número <strong>{config.zapi_phone_number || "configurado"}</strong></span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personalização */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" />Personalização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Assessor</Label>
                  <Input
                    value={config.assessor_nome}
                    onChange={(e) => updateField("assessor_nome", e.target.value)}
                    placeholder="Assessor Virtual"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Board padrão do Kanban</Label>
                  <Input
                    value={config.assessor_kanban_type_padrao}
                    onChange={(e) => updateField("assessor_kanban_type_padrao", e.target.value)}
                    placeholder="Pessoal"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nome exato do board onde tarefas criadas pelo assessor serão inseridas.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Instruções adicionais <span className="text-xs text-muted-foreground font-normal">(complementam o prompt padrão)</span></Label>
                <Textarea
                  value={config.assessor_system_prompt_extra}
                  onChange={(e) => updateField("assessor_system_prompt_extra", e.target.value)}
                  placeholder="Ex: Use sempre linguagem formal. Não discuta assuntos fora da política municipal."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Mensagens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />Mensagens Padrão
              </CardTitle>
              <CardDescription>Use {"{nome}"} para o primeiro nome do usuário na saudação inicial.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Saudação inicial (usuário cadastrado)</Label>
                <Textarea
                  value={config.assessor_saudacao_inicial}
                  onChange={(e) => updateField("assessor_saudacao_inicial", e.target.value)}
                  rows={6}
                />
              </div>
              <div className="space-y-2">
                <Label>Saudação para número desconhecido</Label>
                <Textarea
                  value={config.assessor_saudacao_desconhecido}
                  onChange={(e) => updateField("assessor_saudacao_desconhecido", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Mensagem de encerramento</Label>
                <Input
                  value={config.assessor_mensagem_encerramento}
                  onChange={(e) => updateField("assessor_mensagem_encerramento", e.target.value)}
                  placeholder="Fico à disposição! Até mais. 😊"
                />
              </div>
            </CardContent>
          </Card>

          {/* Funções */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4" />Funções habilitadas
              </CardTitle>
              <CardDescription>Quais ações o Assessor pode realizar no sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {TODAS_FUNCOES_ASSESSOR.map((f) => {
                  const ativa = config.assessor_funcoes_ativas.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => toggleFuncaoAssessor(f.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        ativa ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                      }`}
                    >
                      <span className="text-sm font-medium">{f.label}</span>
                      <Switch
                        checked={ativa}
                        onCheckedChange={() => toggleFuncaoAssessor(f.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Funções de lookup (buscar áreas, tags, usuários, munícipes) são sempre incluídas automaticamente.
              </p>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}
