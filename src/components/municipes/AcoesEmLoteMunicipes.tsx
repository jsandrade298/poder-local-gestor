import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FolderInput, Tag as TagIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BarraAcoesEmLote, classeBotaoLote } from "@/components/ui/BarraAcoesEmLote";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Ações em lote nos Munícipes (mesma barra das Demandas):
 *  - Tags: adicionar ou tirar uma ou mais tags dos selecionados
 *  - Categoria: trocar (ou tirar) a categoria
 *  - Excluir: antes, conta quem tem demandas — esses não podem ser excluídos
 *    (o banco não deixa) e ficam de fora.
 * Outras ações (ex.: WhatsApp, quando ligado) entram por `extras`.
 */

const LOTE = 200;
const SEM_CATEGORIA = "__nenhuma__";

export function AcoesEmLoteMunicipes({
  ids, tags, categorias, onLimpar, onExcluir, extras,
}: {
  ids: string[];
  tags: { id: string; nome: string; cor?: string | null }[];
  categorias: { id: string; nome: string; cor?: string | null; icone?: string | null }[];
  onLimpar: () => void;
  /** Exclui os ids (a tela já tem o fluxo com progresso). */
  onExcluir: (ids: string[]) => void;
  extras?: ReactNode;
}) {
  const qc = useQueryClient();
  const [acao, setAcao] = useState<"tags" | "categoria" | null>(null);
  const [modoTag, setModoTag] = useState<"adicionar" | "remover">("adicionar");
  const [tagsEscolhidas, setTagsEscolhidas] = useState<string[]>([]);
  const [categoria, setCategoria] = useState("");
  const [rodando, setRodando] = useState(false);
  const [exclusao, setExclusao] = useState<{ podem: string[]; comDemandas: number } | null>(null);
  const [contando, setContando] = useState(false);
  const n = ids.length;

  const atualizarListas = () => {
    qc.invalidateQueries({ queryKey: ["municipes-complete"] });
    qc.invalidateQueries({ queryKey: ["municipes-dashboard"] });
    qc.invalidateQueries({ queryKey: ["tags"] });
  };

  const aplicarTags = async () => {
    if (tagsEscolhidas.length === 0) return;
    setRodando(true);
    try {
      let feitos = 0;
      for (let i = 0; i < ids.length; i += LOTE) {
        const parte = ids.slice(i, i + LOTE);
        if (modoTag === "adicionar") {
          const linhas = parte.flatMap((municipe_id) => tagsEscolhidas.map((tag_id) => ({ municipe_id, tag_id })));
          const { data, error } = await (supabase.from("municipe_tags") as any)
            .upsert(linhas, { onConflict: "municipe_id,tag_id", ignoreDuplicates: true }).select("id");
          if (error) throw error;
          feitos += (data ?? []).length;
        } else {
          const { data, error } = await (supabase.from("municipe_tags") as any)
            .delete().in("municipe_id", parte).in("tag_id", tagsEscolhidas).select("id");
          if (error) throw error;
          feitos += (data ?? []).length;
        }
      }
      const nomes = tags.filter((t) => tagsEscolhidas.includes(t.id)).map((t) => t.nome).join(", ");
      toast.success(modoTag === "adicionar" ? `Tag${tagsEscolhidas.length > 1 ? "s" : ""} adicionada${tagsEscolhidas.length > 1 ? "s" : ""}: ${nomes}` : `Tag${tagsEscolhidas.length > 1 ? "s" : ""} retirada${tagsEscolhidas.length > 1 ? "s" : ""}: ${nomes}`, {
        description: `${feitos.toLocaleString("pt-BR")} ${modoTag === "adicionar" ? "inclusões novas" : "remoções"} (quem já ${modoTag === "adicionar" ? "tinha" : "não tinha"} ficou igual).`,
      });
      atualizarListas();
      setAcao(null);
      onLimpar();
    } catch (e: any) {
      toast.error("Não foi possível concluir: " + (e?.message || "erro"));
    } finally {
      setRodando(false);
    }
  };

  const aplicarCategoria = async () => {
    if (!categoria) return;
    setRodando(true);
    try {
      let feitos = 0;
      const valor = categoria === SEM_CATEGORIA ? null : categoria;
      for (let i = 0; i < ids.length; i += LOTE) {
        const { data, error } = await (supabase.from("municipes") as any)
          .update({ categoria_id: valor }).in("id", ids.slice(i, i + LOTE)).select("id");
        if (error) throw error;
        feitos += (data ?? []).length;
      }
      const nome = valor ? categorias.find((c) => c.id === valor)?.nome : "sem categoria";
      toast.success(`${feitos.toLocaleString("pt-BR")} munícipe${feitos === 1 ? "" : "s"} agora em "${nome}"`, {
        description: n - feitos > 0 ? `${n - feitos} não puderam ser alterados (sem permissão).` : undefined,
      });
      atualizarListas();
      setAcao(null);
      onLimpar();
    } catch (e: any) {
      toast.error("Não foi possível concluir: " + (e?.message || "erro"));
    } finally {
      setRodando(false);
    }
  };

  // Excluir: primeiro conta quem tem demandas (esses o banco não deixa excluir)
  const prepararExclusao = async () => {
    setContando(true);
    try {
      const comDemanda = new Set<string>();
      for (let i = 0; i < ids.length; i += LOTE) {
        const { data, error } = await supabase.from("demandas").select("municipe_id").in("municipe_id", ids.slice(i, i + LOTE));
        if (error) throw error;
        (data ?? []).forEach((r: any) => r.municipe_id && comDemanda.add(r.municipe_id));
      }
      setExclusao({ podem: ids.filter((id) => !comDemanda.has(id)), comDemandas: comDemanda.size });
    } catch (e: any) {
      toast.error("Não foi possível verificar: " + e.message);
    } finally {
      setContando(false);
    }
  };

  const alternarTag = (id: string) => setTagsEscolhidas((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <>
      <BarraAcoesEmLote total={n} singular="selecionado" plural="selecionados" onLimpar={onLimpar}>
        <Button size="sm" variant="outline" className={classeBotaoLote} onClick={() => { setAcao("tags"); setTagsEscolhidas([]); setModoTag("adicionar"); }}>
          <TagIcon className="h-3.5 w-3.5" /> Tags
        </Button>
        <Button size="sm" variant="outline" className={classeBotaoLote} onClick={() => { setAcao("categoria"); setCategoria(""); }}>
          <FolderInput className="h-3.5 w-3.5" /> Categoria
        </Button>
        {extras}
        <Button size="sm" variant="outline" className={`${classeBotaoLote} text-destructive hover:text-destructive`} disabled={contando} onClick={prepararExclusao}>
          <Trash2 className="h-3.5 w-3.5" /> {contando ? "Verificando…" : "Excluir"}
        </Button>
      </BarraAcoesEmLote>

      {/* Tags */}
      <Dialog open={acao === "tags"} onOpenChange={(v) => !rodando && !v && setAcao(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tags de {n.toLocaleString("pt-BR")} munícipe{n === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>As outras tags de cada pessoa continuam como estão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex rounded-lg border bg-muted/30 p-0.5 w-fit" role="radiogroup" aria-label="Adicionar ou tirar">
              {([["adicionar", "Adicionar"], ["remover", "Tirar"]] as const).map(([v, r]) => (
                <button key={v} type="button" role="radio" aria-checked={modoTag === v} onClick={() => setModoTag(v)}
                  className={cn("px-3 py-1 text-xs rounded-md", modoTag === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>{r}</button>
              ))}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border p-2 flex flex-wrap gap-1.5">
              {tags.length === 0 && <p className="text-sm text-muted-foreground p-1">Nenhuma tag cadastrada (crie em Tags).</p>}
              {tags.map((t) => {
                const ativa = tagsEscolhidas.includes(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => alternarTag(t.id)} aria-pressed={ativa}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      ativa ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50")}>
                    <span className="h-2 w-2 rounded-full" style={{ background: t.cor || "currentColor" }} />{t.nome}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAcao(null)} disabled={rodando}>Cancelar</Button>
            <Button onClick={aplicarTags} disabled={tagsEscolhidas.length === 0 || rodando}>
              {rodando ? "Aplicando…" : `${modoTag === "adicionar" ? "Adicionar" : "Tirar"} em ${n.toLocaleString("pt-BR")}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categoria */}
      <Dialog open={acao === "categoria"} onOpenChange={(v) => !rodando && !v && setAcao(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Categoria de {n.toLocaleString("pt-BR")} munícipe{n === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>Substitui a categoria atual de cada um.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Nova categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_CATEGORIA}>Sem categoria</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.cor || "currentColor" }} />{c.nome}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAcao(null)} disabled={rodando}>Cancelar</Button>
            <Button onClick={aplicarCategoria} disabled={!categoria || rodando}>{rodando ? "Aplicando…" : `Aplicar em ${n.toLocaleString("pt-BR")}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!exclusao} onOpenChange={(v) => !v && setExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {exclusao && exclusao.podem.length === 0 ? "Nenhum destes pode ser excluído" : `Excluir ${exclusao?.podem.length.toLocaleString("pt-BR")} munícipe${exclusao?.podem.length === 1 ? "" : "s"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {exclusao && exclusao.comDemandas > 0 && (
                  <p>
                    <strong className="text-foreground">{exclusao.comDemandas.toLocaleString("pt-BR")}</strong> {exclusao.comDemandas === 1 ? "tem demanda e fica" : "têm demandas e ficam"} de fora:
                    o histórico do gabinete depende deles.
                  </p>
                )}
                {exclusao && exclusao.podem.length > 0 && (
                  <p>Saem também as tags e o prontuário de cada um. Isso não pode ser desfeito.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{exclusao && exclusao.podem.length === 0 ? "Fechar" : "Cancelar"}</AlertDialogCancel>
            {exclusao && exclusao.podem.length > 0 && (
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { onExcluir(exclusao.podem); setExclusao(null); }}>
                Excluir {exclusao.podem.length.toLocaleString("pt-BR")}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
