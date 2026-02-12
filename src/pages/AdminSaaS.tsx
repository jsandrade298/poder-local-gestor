import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Users,
  FileText,
  MessageCircle,
  Bot,
  Map,
  Plus,
  Power,
  PowerOff,
  Pencil,
  ChevronRight,
  BarChart3,
  Loader2,
  ArrowLeft,
  UserPlus,
} from "lucide-react";

// ============================================================
// Tipos
// ============================================================

interface TenantRow {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  ativo: boolean;
  max_usuarios: number;
  max_municipes: number;
  max_demandas: number;
  created_at: string;
  total_usuarios: number;
  total_municipes: number;
  total_demandas: number;
  total_whatsapp_instances: number;
  openai_chamadas: number;
  openai_tokens_input: number;
  openai_tokens_output: number;
  whatsapp_envios: number;
  mapbox_requests: number;
}

interface UsageSummary {
  total_tenants: number;
  tenants_ativos: number;
  total_usuarios: number;
  total_municipes: number;
  total_demandas: number;
  mes_atual: {
    openai_chamadas: number;
    openai_tokens: number;
    whatsapp_envios: number;
    mapbox_requests: number;
  };
}

interface TenantDetail {
  tenant: any;
  usuarios: any[];
  whatsapp_instances: any[];
  uso_mensal: any[];
}

// ============================================================
// KPI Card
// ============================================================

function KPI({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: any;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Dialog: Criar novo tenant
// ============================================================

function CriarTenantDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [plano, setPlano] = useState("basico");
  const { toast } = useToast();

  const criarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_create_tenant", {
        p_nome: nome,
        p_slug: slug,
        p_plano: plano,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Gabinete criado!", description: `"${nome}" criado com sucesso.` });
      setOpen(false);
      setNome("");
      setSlug("");
      setPlano("basico");
      onSuccess();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar", description: err.message, variant: "destructive" });
    },
  });

  const handleNomeChange = (v: string) => {
    setNome(v);
    setSlug(
      v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Novo Gabinete</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Gabinete</DialogTitle>
          <DialogDescription>
            Crie um novo tenant. Depois, crie o usuário admin no Supabase Auth e vincule ao tenant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome do Gabinete</Label>
            <Input placeholder="Gabinete do Vereador Silva" value={nome} onChange={(e) => handleNomeChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Slug (identificador único)</Label>
            <Input placeholder="gabinete-silva" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <p className="text-xs text-muted-foreground">Sem espaços, acentos ou caracteres especiais.</p>
          </div>
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={plano} onValueChange={setPlano}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="basico">Básico</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => criarMutation.mutate()} disabled={!nome || !slug || criarMutation.isPending}>
            {criarMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Criar Gabinete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Dialog: Editar tenant
// ============================================================

function EditarTenantDialog({ tenant, onSuccess }: { tenant: TenantRow; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(tenant.nome);
  const [plano, setPlano] = useState(tenant.plano);
  const [maxUsuarios, setMaxUsuarios] = useState(tenant.max_usuarios);
  const [maxMunicipes, setMaxMunicipes] = useState(tenant.max_municipes);
  const [maxDemandas, setMaxDemandas] = useState(tenant.max_demandas);
  const { toast } = useToast();

  const editarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_update_tenant", {
        p_tenant_id: tenant.id, p_nome: nome, p_plano: plano,
        p_max_usuarios: maxUsuarios, p_max_municipes: maxMunicipes, p_max_demandas: maxDemandas,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast({ title: "Tenant atualizado!" }); setOpen(false); onSuccess(); },
    onError: (err: any) => { toast({ title: "Erro", description: err.message, variant: "destructive" }); },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar: {tenant.nome}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={plano} onValueChange={setPlano}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="basico">Básico</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label className="text-xs">Máx. Usuários</Label><Input type="number" value={maxUsuarios} onChange={(e) => setMaxUsuarios(parseInt(e.target.value) || 0)} /></div>
            <div className="space-y-2"><Label className="text-xs">Máx. Munícipes</Label><Input type="number" value={maxMunicipes} onChange={(e) => setMaxMunicipes(parseInt(e.target.value) || 0)} /></div>
            <div className="space-y-2"><Label className="text-xs">Máx. Demandas</Label><Input type="number" value={maxDemandas} onChange={(e) => setMaxDemandas(parseInt(e.target.value) || 0)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => editarMutation.mutate()} disabled={editarMutation.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Dialog: Criar usuário para um tenant
// ============================================================

function CriarUsuarioDialog({ tenantId, tenantNome, onSuccess }: { tenantId: string; tenantNome: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState("membro");
  const { toast } = useToast();

  const criarMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email,
            password: senha,
            nome,
            tenant_id: tenantId,
            role_no_tenant: role,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao criar usuário");
      return result;
    },
    onSuccess: () => {
      toast({ title: "Usuário criado!", description: `${email} adicionado ao gabinete.` });
      setOpen(false);
      setEmail("");
      setNome("");
      setSenha("");
      setRole("membro");
      onSuccess();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          Adicionar Usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Usuário</DialogTitle>
          <DialogDescription>
            Criar usuário para o gabinete "{tenantNome}"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input placeholder="João da Silva" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" placeholder="joao@gabinete.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Senha inicial</Label>
            <Input type="text" placeholder="Mínimo 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <p className="text-xs text-muted-foreground">O usuário poderá alterar depois.</p>
          </div>
          <div className="space-y-2">
            <Label>Papel no gabinete</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="membro">Membro</SelectItem>
                <SelectItem value="visualizador">Visualizador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => criarMutation.mutate()}
            disabled={!email || !senha || senha.length < 6 || criarMutation.isPending}
          >
            {criarMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Criar Usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Detalhe do Tenant
// ============================================================

function TenantDetalhe({ tenantId, onBack }: { tenantId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenant-detail", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_tenant_detail", { p_tenant_id: tenantId });
      if (error) throw error;
      return data as TenantDetail;
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return null;

  const refreshDetail = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-tenant-detail", tenantId] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
        <h2 className="text-xl font-bold">{data.tenant?.nome}</h2>
        <Badge variant={data.tenant?.ativo ? "default" : "secondary"}>{data.tenant?.ativo ? "Ativo" : "Inativo"}</Badge>
        <Badge variant="outline">{data.tenant?.plano}</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Usuários ({data.usuarios?.length || 0})</CardTitle>
            <CriarUsuarioDialog
              tenantId={tenantId}
              tenantNome={data.tenant?.nome || ""}
              onSuccess={refreshDetail}
            />
          </div>
        </CardHeader>
        <CardContent>
          {data.usuarios && data.usuarios.length > 0 ? (
            <div className="space-y-2">
              {data.usuarios.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div><p className="text-sm font-medium">{u.nome || "—"}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                  <Badge variant="outline" className="text-xs">{u.role_no_tenant}</Badge>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Nenhum usuário vinculado</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Instâncias WhatsApp</CardTitle></CardHeader>
        <CardContent>
          {data.whatsapp_instances && data.whatsapp_instances.length > 0 ? (
            <div className="space-y-2">
              {data.whatsapp_instances.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div><p className="text-sm font-medium">{w.display_name}</p><p className="text-xs text-muted-foreground">{w.instance_name}</p></div>
                  <Badge variant={w.active ? "default" : "secondary"}>{w.active ? "Ativa" : "Inativa"}</Badge>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Nenhuma instância configurada</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Uso</CardTitle></CardHeader>
        <CardContent>
          {data.uso_mensal && data.uso_mensal.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">Mês</th>
                    <th className="text-right py-2 px-2 font-medium">OpenAI</th>
                    <th className="text-right py-2 px-2 font-medium">Tokens</th>
                    <th className="text-right py-2 px-2 font-medium">WhatsApp</th>
                    <th className="text-right py-2 px-2 font-medium">Mapbox</th>
                  </tr>
                </thead>
                <tbody>
                  {data.uso_mensal.map((u: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 px-2">{new Date(u.mes).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</td>
                      <td className="text-right py-2 px-2">{u.openai_chamadas}</td>
                      <td className="text-right py-2 px-2">{((u.openai_tokens_input || 0) + (u.openai_tokens_output || 0)).toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{u.whatsapp_envios}</td>
                      <td className="text-right py-2 px-2">{u.mapbox_requests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted-foreground">Nenhum registro de uso</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Página Principal Admin SaaS
// ============================================================

export default function AdminSaaS() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["admin-usage-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_usage_summary");
      if (error) throw error;
      return data as UsageSummary;
    },
  });

  const { data: tenants, isLoading: loadingTenants, refetch: refetchTenants } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_tenants");
      if (error) throw error;
      return (data || []) as TenantRow[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ tenantId, ativo }: { tenantId: string; ativo: boolean }) => {
      const { data, error } = await supabase.rpc("admin_toggle_tenant", { p_tenant_id: tenantId, p_ativo: ativo });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchTenants();
      queryClient.invalidateQueries({ queryKey: ["admin-usage-summary"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (err: any) => { toast({ title: "Erro", description: err.message, variant: "destructive" }); },
  });

  const invalidateAll = () => {
    refetchTenants();
    queryClient.invalidateQueries({ queryKey: ["admin-usage-summary"] });
  };

  if (selectedTenantId) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-[1200px]">
        <TenantDetalhe tenantId={selectedTenantId} onBack={() => setSelectedTenantId(null)} />
      </div>
    );
  }

  const isLoading = loadingSummary || loadingTenants;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-sm text-muted-foreground">Gestão de gabinetes e uso da plataforma</p>
        </div>
        <CriarTenantDialog onSuccess={invalidateAll} />
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPI title="Gabinetes Ativos" value={summary.tenants_ativos} icon={Building2} subtitle={`${summary.total_tenants} total`} />
          <KPI title="Usuários" value={summary.total_usuarios} icon={Users} />
          <KPI title="Munícipes" value={summary.total_municipes.toLocaleString()} icon={FileText} />
          <KPI title="Demandas" value={summary.total_demandas.toLocaleString()} icon={FileText} />
        </div>
      )}

      {/* Uso do mês */}
      {summary?.mes_atual && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPI title="OpenAI (mês)" value={summary.mes_atual.openai_chamadas} icon={Bot} subtitle={`${summary.mes_atual.openai_tokens.toLocaleString()} tokens`} />
          <KPI title="WhatsApp (mês)" value={summary.mes_atual.whatsapp_envios} icon={MessageCircle} />
          <KPI title="Mapbox (mês)" value={summary.mes_atual.mapbox_requests} icon={Map} />
          <KPI title="Custo OpenAI est." value={`$${((summary.mes_atual.openai_tokens / 1000000) * 3.0).toFixed(2)}`} icon={BarChart3} subtitle="~$3/M tokens" />
        </div>
      )}

      {/* Lista de Tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Gabinetes ({tenants?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : tenants && tenants.length > 0 ? (
            <div className="space-y-2">
              {tenants.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setSelectedTenantId(t.id)}>
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{t.nome}</p>
                        <Badge variant={t.ativo ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">{t.ativo ? "Ativo" : "Inativo"}</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.plano}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{t.total_usuarios} usuários</span><span>•</span>
                        <span>{t.total_municipes} munícipes</span><span>•</span>
                        <span>{t.total_demandas} demandas</span>
                        {t.whatsapp_envios > 0 && (<><span>•</span><span>{t.whatsapp_envios} msgs/mês</span></>)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <EditarTenantDialog tenant={t} onSuccess={refetchTenants} />
                    <Button variant="ghost" size="icon" onClick={() => toggleMutation.mutate({ tenantId: t.id, ativo: !t.ativo })} title={t.ativo ? "Desativar" : "Ativar"}>
                      {t.ativo ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-green-600" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedTenantId(t.id)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-muted-foreground py-8">Nenhum gabinete cadastrado</p>}
        </CardContent>
      </Card>
    </div>
  );
}
