import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { usePessoasGabinete } from "@/hooks/useQuadros";
import { supabase } from "@/integrations/supabase/client";
import type { EventoGoogle } from "@/hooks/useGoogleAgenda";
import { toast } from "sonner";

/**
 * "Como foi?" — registro do compromisso depois que ele acontece (nota/ata,
 * encaminhamentos). Se o evento estiver ligado a uma demanda, o registro
 * também entra nas atividades dela. Ajuda na prestação de contas.
 */
export function RegistroCompromisso({ evento }: { evento: EventoGoogle }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { porId } = usePessoasGabinete();
  const [texto, setTexto] = useState("");
  const chave = ["agenda-registros", evento.calendarId, evento.id];
  const jaAconteceu = new Date(evento.fim.length === 10 ? evento.fim + "T00:00:00" : evento.fim) <= new Date();

  const registros = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await (supabase.from("agenda_registros") as any)
        .select("id, texto, autor_id, created_at").eq("event_id", evento.id).eq("calendar_id", evento.calendarId).order("created_at");
      if (error) throw error;
      return (data ?? []) as { id: string; texto: string; autor_id: string; created_at: string }[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const t = texto.trim();
      const demandaId = evento.vinculos?.demandaId || null;
      const { error } = await (supabase.from("agenda_registros") as any).insert({
        calendar_id: evento.calendarId, event_id: evento.id, titulo_evento: evento.titulo,
        inicio_evento: evento.inicio.length === 10 ? `${evento.inicio}T12:00:00Z` : evento.inicio, texto: t, demanda_id: demandaId,
      });
      if (error) throw error;
      if (demandaId && user) {
        await (supabase.from("demanda_atividades") as any).insert({
          demanda_id: demandaId, created_by: user.id, tipo_atividade: "comentario",
          titulo: `Registro do compromisso: ${evento.titulo}`, descricao: t,
        });
      }
    },
    onSuccess: () => {
      toast.success(evento.vinculos?.demandaId ? "Registro salvo (também na demanda)" : "Registro salvo");
      setTexto("");
      qc.invalidateQueries({ queryKey: chave });
    },
    onError: (e: any) => toast.error("Não foi possível salvar: " + e.message),
  });

  const apagar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("agenda_registros") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chave }),
  });

  const lista = registros.data ?? [];
  if (!jaAconteceu && lista.length === 0) return null;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold"><NotebookPen className="h-3.5 w-3.5 text-muted-foreground" /> Como foi</p>
      {lista.map((r) => (
        <div key={r.id} className="rounded-md bg-muted/40 px-2.5 py-2 text-sm">
          <p className="whitespace-pre-wrap">{r.texto}</p>
          <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            {porId.get(r.autor_id)?.nome?.split(" ")[0] || "Alguém"} · {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            {r.autor_id === user?.id && (
              <button type="button" className="ml-auto hover:text-destructive" onClick={() => apagar.mutate(r.id)} aria-label="Apagar registro"><Trash2 className="h-3 w-3" /></button>
            )}
          </p>
        </div>
      ))}
      {jaAconteceu && (
        <>
          <Textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="O que foi tratado, encaminhamentos, quem estava…" className="text-sm" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">{evento.vinculos?.demandaId ? "Também vai para as atividades da demanda ligada." : "Fica registrado neste compromisso."}</span>
            <Button size="sm" className="h-8" disabled={!texto.trim() || salvar.isPending} onClick={() => salvar.mutate()}>{salvar.isPending ? "Salvando…" : "Salvar registro"}</Button>
          </div>
        </>
      )}
    </div>
  );
}
