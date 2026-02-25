// ============================================================
// ARQUIVO: src/pages/AssessorWhatsApp.tsx
//
// Configuração do Assessor Virtual por gabinete.
// Instância Z-API e chave OpenAI são globais (Admin SaaS →
// Notificações WhatsApp). Aqui ficam as configurações
// específicas de cada gabinete: ativo, prompts, funções.
// ============================================================

import { useState, useEffect } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Bot, Save, Zap, MessageCircle, Settings, ListChecks, Info, BarChart3,
} from "lucide-react";

// ── tipos ────────────────────────────────────────────────────

interface AssessorConfig {
  id?: string;
  tenant_id?: string;
  ativo: boolean;
  nome_assessor: string;
  system_prompt_extra: string;
  funcoes_ativas: string[];
  saudacao_inicial: string;
  saudacao_desconhecido: string;
  mensagem_encerramento: string;
  kanban_type_padrao: string;
}

interface LogEntry {
  id: string;
  created_at: string;
  telefone: string;
  mensagem_usuario: string;
  resposta_assessor: string;
  funcao_chamada: string | null;
  tokens_input: number;
  tokens_output: number;
  profiles?: { nome: string } | null;
}

interface NotifConfigStatus {
  configurado: boolean;
  ativo: boolean;
  tem_openai: boolean;
  phone_number?: string;
}

// ── constantes ───────────────────────────────────────────────

const TODAS_FUNCOES = [
  { id: "solicitar_agenda", label: "📅 Solicitar Agenda" },
  { id: "cadastrar_demanda", label: "📋 Cadastrar Demanda" },
  { id: "consultar_demandas", label: "🔍 Consultar Demandas" },
  { id: "atualizar_demanda", label: "✏️ Atualizar Demanda" },
  { id: "cadastrar_municipe", label: "👤 Cadastrar Munícipe" },
  { id: "atualizar_municipe_prontuario", label: "📝 Atualizar Prontuário" },
  { id: "consultar_municipe", label: "🔎 Consultar Munícipe" },
  { id: "criar_tarefa_kanban", label: "✅ Criar Tarefa no Kanban" },
];

const CONFIG_DEFAULT: AssessorConfig = {
  ativo: false,
  nome_assessor: "Assessor Virtual",
  system_prompt_extra: "",
  funcoes_ativas: TODAS_FUNCOES.map((f) => f.id),
  saudacao_inicial:
    "Olá, {nome}! 👋 Sou o Assessor Virtual do gabinete.\n\nComo posso te ajudar?\n\n📅 Solicitar Agenda\n📋 Cadastrar Demanda\n🔍 Consultar Demandas\n👤 Gerenciar Munícipes\n✅ Criar Tarefa no Kanban",
  saudacao_desconhecido:
    "Olá! 👋 Seu número não está cadastrado no sistema.\n\nPor favor, peça ao administrador do seu gabinete para cadastrar seu número de telefone.",
  mensagem_encerramento: "Fico à disposição! Até mais. 😊",
  kanban_type_padrao: "Pessoal",
};

// ─────────────────────────────────────────────────────────────

export default function AssessorWhatsApp() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [config, setConfig] = useState<AssessorConfig>(CONFIG_DEFAULT);
  const [notifStatus, setNotifStatus] = useState<NotifConfigStatus>({
    configurado: false, ativo: false, tem_openai: false,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [stats, setStats] = useState({ totalInteracoes: 0, tokensUsados: 0, sessoesAtivas: 0 });

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Status do canal de notificações (global)
      const { data: notif } = await supabase
        .from("notification_whatsapp_config" as never)
        .select("ativo, zapi_instance_id, openai_api_key, zapi_phone_number")
        .limit(1)
        .maybeSingle() as { data: { ativo: boolean; zapi_instance_id: string; openai_api_key: string; zapi_phone_number: string } | null };

      setNotifStatus({
        configurado: !!notif?.zapi_instance_id,
        ativo: notif?.ativo ?? false,
        tem_openai: !!notif?.openai_api_key,
        phone_number: notif?.zapi_phone_number || undefined,
      });

      // Config do assessor deste gabinete
      const { data: cfg } = await supabase
        .from("whatsapp_assessor_config")
        .select("*")
        .maybeSingle();

      if (cfg) {
        setConfig({
          id: cfg.id,
          tenant_id: cfg.tenant_id,
          ativo: cfg.ativo ?? false,
          nome_assessor: cfg.nome_assessor || "Assessor Virtual",
          system_prompt_extra: cfg.system_prompt_extra || "",
          funcoes_ativas: (cfg.funcoes_ativas as string[]) || TODAS_FUNCOES.map((f) => f.id),
          saudacao_inicial: cfg.saudacao_inicial || CONFIG_DEFAULT.saudacao_inicial,
          saudacao_desconhecido: cfg.saudacao_desconhecido || CONFIG_DEFAULT.saudacao_desconhecido,
          mensagem_encerramento: cfg.mensagem_encerramento || CONFIG_DEFAULT.mensagem_encerramento,
          kanban_type_padrao: cfg.kanban_type_padrao || "Pessoal",
        });
      }

      await carregarStats();
    } catch (err) {
      console.error("Erro ao carregar:", err);
    } finally {
      setLoading(false);
    }
  };

  const carregarStats = async () => {
    const { count: totalInteracoes } = await supabase
      .from("whatsapp_assessor_logs")
      .select("*", { count: "exact", head: true });

    const { data: tokens } = await supabase
      .from("whatsapp_assessor_logs")
      .select("tokens_input, tokens_output");

    const tokensUsados = (tokens || []).reduce(
      (acc, r) => acc + (r.tokens_input || 0) + (r.tokens_output || 0), 0
    );

    const { count: sessoesAtivas } = await supabase
      .from("whatsapp_assessor_sessoes")
      .select("*", { count: "exact", head: true })
      .eq("ativa", true);

    setStats({ totalInteracoes: totalInteracoes || 0, tokensUsados, sessoesAtivas: sessoesAtivas || 0 });
  };

  const carregarLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data } = await supabase
        .from("whatsapp_assessor_logs")
        .select("id, created_at, telefone, mensagem_usuario, resposta_assessor, funcao_chamada, tokens_input, tokens_output, profiles(nome)")
        .order("created_at", { ascending: false })
        .limit(50);
      setLogs((data as LogEntry[]) || []);
    } finally {
      setLoadingLogs(false);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const payload = {
        ativo: config.ativo,
        nome_assessor: config.nome_assessor,
        system_prompt_extra: config.system_prompt_extra || null,
        funcoes_ativas: config.funcoes_ativas,
        saudacao_inicial: config.saudacao_inicial,
        saudacao_desconhecido: config.saudacao_desconhecido,
        mensagem_encerramento: config.mensagem_encerramento,
        kanban_type_padrao: config.kanban_type_padrao,
        updated_at: new Date().toISOString(),
      };

      if (config.id) {
        const { error } = await supabase.from("whatsapp_assessor_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_assessor_config").insert(payload);
        if (error) throw error;
      }

      toast({ title: "Configurações salvas! ✅" });
      await carregarDados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const toggleFuncao = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      funcoes_ativas: prev.funcoes_ativas.includes(id)
        ? prev.funcoes_ativas.filter((f) => f !== id)
        : [...prev.funcoes_ativas, id],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Verificar se o canal de notificações está pronto para o assessor
  const canalPronto = notifStatus.configurado && notifStatus.ativo && notifStatus.tem_openai;

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Assessor Virtual — WhatsApp</h1>
            <p className="text-muted-foreground text-sm">GPT-4o-mini via canal de notificações do Admin SaaS</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={config.ativo}
              disabled={!canalPronto}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, ativo: v }))}
            />
            {config.ativo
              ? <Badge className="bg-green-100 text-green-700">Ativo</Badge>
              : <Badge variant="secondary">Inativo</Badge>
            }
          </div>
          <Button onClick={salvar} disabled={salvando}>
            <Save className="h-4 w-4 mr-2" />
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Status do canal de notificações */}
      <Card className={`border ${canalPronto ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className={`h-5 w-5 mt-0.5 shrink-0 ${canalPronto ? "text-green-600" : "text-amber-600"}`} />
            <div className="space-y-1">
              <p className={`text-sm font-medium ${canalPronto ? "text-green-800" : "text-amber-800"}`}>
                Canal de notificações (Admin SaaS)
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant="outline" className={notifStatus.configurado ? "border-green-400 text-green-700" : "border-red-400 text-red-700"}>
                  {notifStatus.configurado ? "✅ Z-API configurada" : "❌ Z-API não configurada"}
                </Badge>
                <Badge variant="outline" className={notifStatus.ativo ? "border-green-400 text-green-700" : "border-amber-400 text-amber-700"}>
                  {notifStatus.ativo ? "✅ Canal ativo" : "⚠️ Canal inativo"}
                </Badge>
                <Badge variant="outline" className={notifStatus.tem_openai ? "border-green-400 text-green-700" : "border-red-400 text-red-700"}>
                  {notifStatus.tem_openai ? "✅ OpenAI configurada" : "❌ Sem chave OpenAI"}
                </Badge>
                {notifStatus.phone_number && (
                  <Badge variant="outline" className="border-blue-400 text-blue-700">
                    📱 {notifStatus.phone_number}
                  </Badge>
                )}
              </div>
              {!canalPronto && (
                <p className="text-xs text-amber-700 mt-1">
                  Para ativar o Assessor, configure o canal em <strong>Admin SaaS → Notificações WhatsApp</strong>.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Interações</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalInteracoes.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Tokens usados</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.tokensUsados.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Sessões ativas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.sessoesAtivas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="configuracao">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="configuracao"><Settings className="h-4 w-4 mr-2" />Configuração</TabsTrigger>
          <TabsTrigger value="funcoes"><ListChecks className="h-4 w-4 mr-2" />Funções</TabsTrigger>
          <TabsTrigger value="logs" onClick={carregarLogs}><MessageCircle className="h-4 w-4 mr-2" />Logs</TabsTrigger>
        </TabsList>

        {/* ── Configuração ─────────────────────────────────── */}
        <TabsContent value="configuracao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração da IA</CardTitle>
              <CardDescription>Personalize o comportamento do assistente para este gabinete.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Assessor</Label>
                  <Input
                    value={config.nome_assessor}
                    onChange={(e) => setConfig((p) => ({ ...p, nome_assessor: e.target.value }))}
                    placeholder="Assessor Virtual"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Board do Kanban (tarefas criadas pelo assessor)</Label>
                  <Input
                    value={config.kanban_type_padrao}
                    onChange={(e) => setConfig((p) => ({ ...p, kanban_type_padrao: e.target.value }))}
                    placeholder="Pessoal"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deve corresponder exatamente ao nome do board no Kanban.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Instruções adicionais{" "}
                  <span className="text-xs text-muted-foreground font-normal">(complementam o prompt padrão)</span>
                </Label>
                <Textarea
                  value={config.system_prompt_extra}
                  onChange={(e) => setConfig((p) => ({ ...p, system_prompt_extra: e.target.value }))}
                  placeholder="Ex: Use sempre linguagem formal. Não discuta assuntos fora da política municipal."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mensagens Padrão</CardTitle>
              <CardDescription>Use {"{nome}"} para o primeiro nome do usuário.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Saudação inicial (usuário cadastrado)</Label>
                <Textarea
                  value={config.saudacao_inicial}
                  onChange={(e) => setConfig((p) => ({ ...p, saudacao_inicial: e.target.value }))}
                  rows={6}
                />
              </div>
              <div className="space-y-2">
                <Label>Saudação para número desconhecido</Label>
                <Textarea
                  value={config.saudacao_desconhecido}
                  onChange={(e) => setConfig((p) => ({ ...p, saudacao_desconhecido: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Mensagem de encerramento</Label>
                <Input
                  value={config.mensagem_encerramento}
                  onChange={(e) => setConfig((p) => ({ ...p, mensagem_encerramento: e.target.value }))}
                  placeholder="Fico à disposição! Até mais. 😊"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Funções ──────────────────────────────────────── */}
        <TabsContent value="funcoes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funções habilitadas</CardTitle>
              <CardDescription>Escolha quais ações o Assessor pode realizar neste gabinete.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {TODAS_FUNCOES.map((f) => {
                  const ativa = config.funcoes_ativas.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => toggleFuncao(f.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        ativa ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                      }`}
                    >
                      <span className="text-sm font-medium">{f.label}</span>
                      <Switch
                        checked={ativa}
                        onCheckedChange={() => toggleFuncao(f.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                As funções de lookup (buscar áreas, tags, usuários, munícipes) são sempre incluídas automaticamente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs ─────────────────────────────────────────── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas 50 interações</CardTitle>
              <CardDescription>Histórico de conversas do Assessor Virtual.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma interação registrada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.profiles?.nome || log.telefone}</span>
                          {log.funcao_chamada && (
                            <Badge variant="outline" className="text-xs">{log.funcao_chamada}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{(log.tokens_input + log.tokens_output).toLocaleString()} tokens</span>
                          <span>{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/50 rounded p-2">
                          <p className="text-xs text-muted-foreground mb-1">👤 Usuário</p>
                          <p className="text-xs line-clamp-3">{log.mensagem_usuario}</p>
                        </div>
                        <div className="bg-primary/5 rounded p-2">
                          <p className="text-xs text-muted-foreground mb-1">🤖 Assessor</p>
                          <p className="text-xs line-clamp-3">{log.resposta_assessor}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
