import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateBoardDialog } from "@/components/kanban/CreateBoardDialog";
import { supabase } from "@/integrations/supabase/client";
import { useKanbanBoards, KanbanBoard } from "@/hooks/useKanbanBoards";
import { normalizarBusca } from "@/lib/busca";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/**
 * Menu "⋯" de um quadro: Editar (nome, ícone, cor, descrição) e Excluir.
 * Quem pode: membros do projeto; no quadro pessoal, só o dono (o banco
 * também garante isso). A exclusão mostra o que vai junto e pede o nome.
 */
export function AcoesProjeto({
  board, podeEditar, onExcluido, className,
}: {
  board: KanbanBoard;
  podeEditar: boolean;
  onExcluido?: () => void;
  className?: string;
}) {
  const { user } = useAuth();
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const pessoal = board.tipo === "pessoal";
  // Quadro pessoal: só o dono mexe, mesmo que esteja como membro de outro jeito
  if (!podeEditar || (pessoal && board.dono_id !== user?.id)) return null;
  const podeExcluir = (board.tipo ?? "projeto") === "projeto" || pessoal;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost" size="sm" className={cn("h-8 w-8 p-0", className)} aria-label={`Ações do projeto ${board.nome}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setEditando(true)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
          {podeExcluir && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setExcluindo(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> {pessoal ? "Excluir meu quadro…" : "Excluir projeto…"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateBoardDialog open={editando} onOpenChange={setEditando} editingBoard={editando ? board : null} />
      {podeExcluir && (
        <ExcluirProjetoDialog board={board} aberto={excluindo} onAbertoChange={setExcluindo} onExcluido={onExcluido} />
      )}
    </>
  );
}

function ExcluirProjetoDialog({
  board, aberto, onAbertoChange, onExcluido,
}: {
  board: KanbanBoard;
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  onExcluido?: () => void;
}) {
  const { deleteBoard } = useKanbanBoards();
  const [confirmacao, setConfirmacao] = useState("");

  // O que vai junto (para a pessoa decidir sabendo)
  const contagem = useQuery({
    queryKey: ["projeto-excluir-contagem", board.id],
    enabled: aberto,
    queryFn: async () => {
      const { data: cards, error } = await supabase.from("kanban_board_cards").select("id").eq("board_id", board.id);
      if (error) throw error;
      const ids = (cards ?? []).map((c) => c.id);
      if (ids.length === 0) return { cartoes: 0, comentarios: 0, demandas: 0 };
      const [com, dem] = await Promise.all([
        supabase.from("kanban_board_card_comentarios").select("id", { count: "exact", head: true }).in("card_id", ids),
        (supabase.from("kanban_board_card_demandas" as any) as any).select("id", { count: "exact", head: true }).in("card_id", ids),
      ]);
      return { cartoes: ids.length, comentarios: com.count ?? 0, demandas: dem.count ?? 0 };
    },
    staleTime: 0,
  });

  const nomeConfere = normalizarBusca(confirmacao.trim()) === normalizarBusca(board.nome.trim());
  const c = contagem.data;

  return (
    <AlertDialog open={aberto} onOpenChange={(v) => { onAbertoChange(v); if (!v) setConfirmacao(""); }}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir o projeto "{board.nome}"?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>Isso não pode ser desfeito. Vão junto as etapas, os cartões, checklists, comentários e o histórico.</p>
              {contagem.isLoading ? <p className="text-muted-foreground">Contando…</p> : c && (
                <ul className="list-disc pl-5">
                  <li><strong>{c.cartoes}</strong> {c.cartoes === 1 ? "cartão" : "cartões"}</li>
                  <li><strong>{c.comentarios}</strong> {c.comentarios === 1 ? "comentário" : "comentários"}</li>
                  {c.demandas > 0 && <li><strong>{c.demandas}</strong> vínculo{c.demandas > 1 ? "s" : ""} com demandas (as demandas continuam existindo)</li>}
                </ul>
              )}
              <label className="block pt-1">
                <span className="text-foreground">Para confirmar, digite o nome do projeto:</span>
                <Input className="mt-1.5" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={board.nome} autoFocus />
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!nomeConfere || deleteBoard.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              deleteBoard.mutate(board.id, {
                onSuccess: () => { onAbertoChange(false); setConfirmacao(""); onExcluido?.(); },
              });
            }}
          >
            {deleteBoard.isPending ? "Excluindo…" : "Excluir de vez"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
