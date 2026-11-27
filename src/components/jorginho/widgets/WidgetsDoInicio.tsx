import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CartaoWidget } from "./WidgetJorginho";
import { ConviteJotinha } from "../ui";
import type { ReceitaWidget } from "./receita";

/**
 * Widgets da Oficina do Jotinha no Início: os da pessoa e os que a equipe
 * compartilhou. Sem nenhum, um convite discreto para criar o primeiro.
 */

interface Widget { id: string; titulo: string; spec: ReceitaWidget; compartilhado: boolean; dono_id: string; ordem: number }

const abrirOficina = (widget?: Widget) => window.dispatchEvent(new CustomEvent("jorginho:abrir", { detail: { aba: "oficina", widget } }));

export function WidgetsDoInicio() {
  const { user } = useAuth();
  const uid = user?.id || "";
  const qc = useQueryClient();
  const [convite, setConvite] = useState(() => { try { return localStorage.getItem(`jorginho-convite-oficina:${uid}`) !== "fechado"; } catch { return true; } });
  const q = useQuery({
    queryKey: ["jorginho-widgets", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await (supabase.from("jorginho_widgets") as any).select("id, titulo, spec, compartilhado, dono_id, ordem").order("ordem").order("created_at");
      if (error) throw error;
      return (data ?? []) as Widget[];
    },
    staleTime: 60_000,
    retry: false,
  });

  const remover = async (w: Widget) => {
    const { error } = await (supabase.from("jorginho_widgets") as any).delete().eq("id", w.id);
    if (error) return toast.error("Não foi possível remover: " + error.message);
    qc.invalidateQueries({ queryKey: ["jorginho-widgets"] });
    toast.success("Widget removido do Início");
  };
  const alternarCompartilhado = async (w: Widget) => {
    const { error } = await (supabase.from("jorginho_widgets") as any).update({ compartilhado: !w.compartilhado }).eq("id", w.id);
    if (error) return toast.error("Não foi possível mudar: " + error.message);
    qc.invalidateQueries({ queryKey: ["jorginho-widgets"] });
    toast.success(w.compartilhado ? "Agora só você vê este widget" : "Compartilhado com a equipe");
  };

  if (q.isError) return null; // tabela ainda não existe ou sem acesso: some sem incomodar
  const lista = q.data ?? [];
  if (!lista.length) {
    if (!convite || q.isLoading) return null;
    return (
      <ConviteJotinha expressao="ideia"
        titulo="Monte seu próprio painel"
        texto="Diga ao Jotinha o que quer acompanhar e ele cria um widget aqui no Início."
        acao={
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" className="gap-1.5 rounded-full" onClick={() => abrirOficina()}><Wand2 className="h-3.5 w-3.5" /> Criar</Button>
            <button type="button" aria-label="Dispensar" className="rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => { setConvite(false); try { localStorage.setItem(`jorginho-convite-oficina:${uid}`, "fechado"); } catch { /* sem storage */ } }}>
              <X className="h-4 w-4" />
            </button>
          </div>
        } />
    );
  }
  return (
    <section aria-label="Meus widgets" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="titulo-compacto text-sm font-semibold text-muted-foreground">Meus widgets</h2>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => abrirOficina()}><Wand2 className="h-3.5 w-3.5" /> Novo widget</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lista.map((w) => (
          <CartaoWidget key={w.id} widget={w} meu={w.dono_id === uid}
            onEditar={() => abrirOficina(w)} onRemover={() => remover(w)} onCompartilhar={() => alternarCompartilhado(w)} />
        ))}
      </div>
    </section>
  );
}
