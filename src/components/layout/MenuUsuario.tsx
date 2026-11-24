import { LogOut, MessageCircleQuestion, Moon, Sun } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useTema } from "@/lib/tema";
import { cn } from "@/lib/utils";

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

/** Abre o assistente (Navi). No celular é o único caminho; no computador há também a aba lateral. */
function ItemAjuda() {
  if (typeof window === "undefined" || !(window as any).__jorgeusAjuda) return null;
  return (
    <DropdownMenuItem onSelect={() => window.dispatchEvent(new Event("jorgeus:abrir-ajuda"))}>
      <MessageCircleQuestion className="h-4 w-4 mr-2" /> Ajuda (assistente)
    </DropdownMenuItem>
  );
}

/** Menu da pessoa no cabeçalho: quem está logado, modo claro/escuro e sair. */
export function MenuUsuario({ destinoAoSair = "/login" }: { destinoAoSair?: string }) {
  const { user, profile, signOut } = useAuth();
  const { modo, alternarModo } = useTema();
  const nome = profile?.nome || user?.user_metadata?.full_name || user?.email || "Você";
  const escuro = modo === "escuro";

  const sair = async () => {
    await signOut();
    window.location.href = destinoAoSair;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-full pl-1 pr-1 md:pr-3 py-1 transition-colors",
            "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="Menu da conta"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
            {iniciais(nome)}
          </span>
          <span className="hidden md:block max-w-[160px] truncate text-sm font-medium">{nome.split(" ")[0]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold truncate">{nome}</p>
          {user?.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); alternarModo(); }}
          className="flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            {escuro ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            Modo escuro
          </span>
          <Switch checked={escuro} aria-label="Modo escuro" className="pointer-events-none" />
        </DropdownMenuItem>
        <ItemAjuda />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={sair} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
