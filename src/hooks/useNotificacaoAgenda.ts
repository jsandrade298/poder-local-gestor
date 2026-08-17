import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────

export interface NotificacaoAgenda {
  id: string;
  tenant_id: string;
  ativo: boolean;
  /** 0 = domingo … 6 = sábado */
  dias_semana: number[];
  /** "HH:MM" ou "HH:MM:SS" vindos do banco */
  horarios: string[];
  timezone: string;
  tipos_urgentes: string[];
}

export const DIAS_SEMANA = [
  { valor: 0, label: "Dom", nome: "Domingo" },
  { valor: 1, label: "Seg", nome: "Segunda" },
  { valor: 2, label: "Ter", nome: "Terça" },
  { valor: 3, label: "Qua", nome: "Quarta" },
  { valor: 4, label: "Qui", nome: "Quinta" },
  { valor: 5, label: "Sex", nome: "Sexta" },
  { valor: 6, label: "Sáb", nome: "Sábado" },
] as const;

export const MAX_HORARIOS = 12;

/** O banco devolve time como "09:00:00"; os inputs usam "09:00". */
export function horarioParaInput(valor: string): string {
  return String(valor).slice(0, 5);
}

// ── Hook ───────────────────────────────────────────────────────

export function useNotificacaoAgenda() {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notificacao-agenda", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<NotificacaoAgenda | null> => {
      // `as never` porque a tabela ainda não está no types.ts gerado
      const { data, error } = await supabase
        .from("notificacao_whatsapp_agenda" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const row = data as unknown as NotificacaoAgenda;
      return { ...row, horarios: (row.horarios || []).map(horarioParaInput) };
    },
  });

  const salvar = useMutation({
    mutationFn: async (agenda: Partial<NotificacaoAgenda>) => {
      if (!tenantId) throw new Error("Gabinete não identificado");

      const payload = {
        tenant_id: tenantId,
        ativo: agenda.ativo,
        dias_semana: agenda.dias_semana,
        horarios: agenda.horarios,
        timezone: agenda.timezone,
        tipos_urgentes: agenda.tipos_urgentes ?? [],
      };

      // A agenda é criada pela migração, mas o upsert cobre gabinetes
      // cadastrados depois dela.
      const { error } = await supabase
        .from("notificacao_whatsapp_agenda" as never)
        .upsert(payload as never, { onConflict: "tenant_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacao-agenda", tenantId] });
      toast({
        title: "Agenda salva",
        description: "Os novos dias e horários já valem para o próximo envio.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar a agenda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return { agenda: query.data, isLoading: query.isLoading, salvar };
}
