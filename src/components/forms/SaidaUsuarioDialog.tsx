import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lock, UserX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Saída de um usuário do gabinete, sem perder nada:
 *  - Desativar: a pessoa não entra mais; o nome continua no histórico.
 *  - Transferir e excluir: tudo o que é dela passa para outra pessoa e a
 *    conta é excluída.
 * (Antes, excluir apagava atividades, prontuário, anexos e agendas.)
 */

interface Pessoa { id: string; nome: string; ativo?: boolean }

const ROTULOS: [string, string][] = [
  ["demandas_responsavel", "demandas sob responsabilidade"],
  ["demandas_cadastradas", "demandas cadastradas"],
  ["atividades", "atividades em demandas"],
  ["prontuario", "registros de prontuário"],
  ["anexos", "anexos"],
  ["agendas", "agendas pedidas ou validadas"],
  ["cartoes", "cartões nos quadros"],
  ["quadro_pessoal", "cartões no quadro pessoal"],
  ["areas", "áreas sob responsabilidade"],
];

async function chamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("delete-user", { body });
  if (error) {
    // a função devolve a mensagem no corpo mesmo em erro
    const ctx = (error as any)?.context;
    let msg = error.message;
    try { msg = (await ctx?.json())?.error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  if (!data?.success) throw new Error(data?.error || "Não foi possível concluir");
  return data;
}

export function SaidaUsuarioDialog({
  usuario, pessoas, onOpenChange,
}: {
  usuario: Pessoa | null;
  pessoas: Pessoa[];
  onOpenChange: (aberto: boolean) => void;
}) {
  const qc = useQueryClient();
  const [modo, setModo] = useState<"desativar" | "excluir">("desativar");
  const [para, setPara] = useState("");

  useEffect(() => { setModo("desativar"); setPara(""); }, [usuario?.id]);

  const vinculos = useQuery({
    queryKey: ["usuario-vinculos", usuario?.id],
    enabled: !!usuario,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("usuario_vinculos", { p_usuario: usuario!.id });
      if (error) throw error;
      return data as Record<string, number>;
    },
    staleTime: 0,
  });

  const acao = useMutation({
    mutationFn: () => chamar(
      modo === "desativar"
        ? { userId: usuario!.id, acao: "desativar" }
        : { userId: usuario!.id, acao: "excluir", transferirPara: para },
    ),
    onSuccess: () => {
      const recebe = pessoas.find((p) => p.id === para)?.nome;
      toast({
        title: modo === "desativar" ? "Acesso desativado" : "Usuário excluído",
        description: modo === "desativar"
          ? `${usuario!.nome} não consegue mais entrar. Dá para reativar pelo menu.`
          : `Tudo o que era de ${usuario!.nome} agora está com ${recebe}.`,
      });
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      qc.invalidateQueries({ queryKey: ["pessoas-gabinete"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Não foi possível concluir", description: e.message, variant: "destructive" }),
  });

  const candidatos = pessoas.filter((p) => p.id !== usuario?.id && p.ativo !== false);
  const itens = ROTULOS.filter(([k]) => (vinculos.data?.[k] ?? 0) > 0);
  const podeConfirmar = modo === "desativar" || !!para;

  return (
    <Dialog open={!!usuario} onOpenChange={(v) => !acao.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tirar {usuario?.nome} do gabinete</DialogTitle>
          <DialogDescription>Nada do que a pessoa registrou é apagado. Escolha como ela sai:</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="font-medium mb-1.5">O que está com {usuario?.nome?.split(" ")[0]}</p>
          {vinculos.isLoading ? <Skeleton className="h-12" /> : vinculos.isError ? (
            <p className="text-muted-foreground">Não foi possível contar agora.</p>
          ) : itens.length === 0 ? (
            <p className="text-muted-foreground">Nada ligado a esta pessoa.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
              {itens.map(([k, r]) => (
                <li key={k} className="text-muted-foreground"><strong className="text-foreground tabular-nums">{vinculos.data![k].toLocaleString("pt-BR")}</strong> {r}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-3" role="radiogroup" aria-label="Como a pessoa sai">
          <button type="button" role="radio" aria-checked={modo === "desativar"} onClick={() => setModo("desativar")}
            className={cn("flex gap-3 rounded-xl border-2 p-3 text-left transition-colors", modo === "desativar" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
            <Lock className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <span>
              <span className="block font-semibold text-sm">Desativar o acesso <span className="text-primary font-normal">(recomendado)</span></span>
              <span className="block text-xs text-muted-foreground mt-0.5">A pessoa não consegue mais entrar. O nome continua nas demandas e no histórico. Dá para reativar depois.</span>
            </span>
          </button>
          <button type="button" role="radio" aria-checked={modo === "excluir"} onClick={() => setModo("excluir")}
            className={cn("flex gap-3 rounded-xl border-2 p-3 text-left transition-colors", modo === "excluir" ? "border-destructive bg-destructive/5" : "border-border hover:border-destructive/40")}>
            <UserX className="h-5 w-5 mt-0.5 text-destructive shrink-0" />
            <span>
              <span className="block font-semibold text-sm">Transferir tudo e excluir a conta</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Demandas, cartões, agendas, atividades e anexos passam para outra pessoa, que aparece como autora dos registros. A conta é excluída e isso não tem volta.</span>
            </span>
          </button>
        </div>

        {modo === "excluir" && (
          <div className="space-y-2">
            <Label>Quem recebe</Label>
            <Select value={para} onValueChange={setPara}>
              <SelectTrigger><SelectValue placeholder="Escolha uma pessoa do gabinete" /></SelectTrigger>
              <SelectContent>{candidatos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
              O quadro pessoal de {usuario?.nome?.split(" ")[0]} vira um projeto arquivado de quem receber.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={acao.isPending}>Cancelar</Button>
          <Button variant={modo === "excluir" ? "destructive" : "default"} onClick={() => acao.mutate()} disabled={!podeConfirmar || acao.isPending}>
            {acao.isPending ? "Aguarde…" : modo === "desativar" ? "Desativar acesso" : "Transferir e excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Reativar (sem modal: é reversível e não mexe em dados). */
export async function reativarUsuario(id: string) {
  return chamar({ userId: id, acao: "reativar" });
}
