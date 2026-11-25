import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Admin SaaS → detalhe do gabinete: quem pode criar, editar e excluir
 * eventos na agenda do mandato (Google Agenda do vereador). Os demais
 * membros só visualizam. Representantes não aparecem (não usam a agenda).
 */
export function EditoresAgendaCard({ tenantId, usuarios }: { tenantId: string; usuarios: { id: string; nome: string | null; email: string | null; role_no_tenant?: string | null }[] }) {
  const qc = useQueryClient();
  const candidatos = useMemo(() => usuarios.filter((u) => u.role_no_tenant !== "representante")
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR")), [usuarios]);

  const atuais = useQuery({
    queryKey: ["admin-editores-agenda", tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("agenda_editores") as any).select("usuario_id").eq("tenant_id", tenantId);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.usuario_id));
    },
  });
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  useEffect(() => { if (atuais.data) setMarcados(new Set(atuais.data)); }, [atuais.data]);

  const mudou = !!atuais.data && (atuais.data.size !== marcados.size || [...marcados].some((id) => !atuais.data!.has(id)));

  const salvar = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_definir_editores_agenda", { p_tenant_id: tenantId, p_usuarios: [...marcados] });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(n === 0 ? "Ninguém edita a agenda do mandato" : `${n} pessoa${n === 1 ? "" : "s"} pode${n === 1 ? "" : "m"} editar a agenda do mandato`);
      qc.invalidateQueries({ queryKey: ["admin-editores-agenda", tenantId] });
    },
    onError: (e: any) => toast.error("Não foi possível salvar: " + e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> Agenda do mandato: quem pode editar
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Quem estiver marcado conecta a agenda Google do vereador e cria, edita e exclui eventos nela.
          O restante da equipe só visualiza. Cada pessoa sempre gerencia a própria agenda pessoal.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {atuais.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : candidatos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário da equipe neste gabinete.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {candidatos.map((u) => (
              <label key={u.id} className="flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/40">
                <Checkbox className="mt-0.5" checked={marcados.has(u.id)}
                  onCheckedChange={(v) => setMarcados((s) => { const n = new Set(s); if (v) n.add(u.id); else n.delete(u.id); return n; })} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{u.nome || "—"}</span>
                  <span className="block text-xs text-muted-foreground truncate">{u.email}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={() => salvar.mutate()} disabled={!mudou || salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar editores"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
