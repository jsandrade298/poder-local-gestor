import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, LogIn, ShieldCheck, Users, MapPinned, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MarcaIcone, MarcaLogo } from "@/components/marca/Marca";

/** Mensagens do Supabase em português, para quem está entrando. */
function traduzirErro(msg?: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Este e-mail ainda não foi confirmado.";
  if (m.includes("too many") || m.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (m.includes("network") || m.includes("fetch")) return "Sem conexão com o servidor. Verifique sua internet.";
  return msg || "Não foi possível entrar. Tente novamente.";
}

const DESTAQUES = [
  { icone: Users, texto: "Demandas e munícipes organizados, com protocolo e prazos" },
  { icone: MapPinned, texto: "O território do mandato no mapa, por bairro e por tema" },
  { icone: BarChart3, texto: "O gabinete em números, para decidir e prestar contas" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { signIn } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErro(null);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setErro(traduzirErro(error.message));
        setIsLoading(false);
      }
      // Sucesso: o AuthLayout leva cada perfil para o lugar certo
    } catch {
      setErro("Erro inesperado. Tente novamente.");
      toast({ title: "Erro no login", description: "Erro inesperado. Tente novamente.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* Painel da marca (computador) */}
      <aside
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white"
        style={{ background: "var(--marca-fundo-escuro)" }}
      >
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full opacity-30 blur-3xl fundo-marca" />
        <div aria-hidden className="pointer-events-none absolute -left-32 bottom-[-12rem] h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl fundo-marca" />

        <MarcaLogo modo="escuro" className="relative h-16 w-auto self-start" />

        <div className="relative max-w-md space-y-8">
          <h2 className="text-[2rem] leading-tight font-extrabold tracking-tight">
            Do pedido do munícipe ao resultado do mandato, tudo em um só lugar.
          </h2>
          <ul className="space-y-4">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-start gap-3 text-[15px] text-white/85">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icone className="h-4 w-4" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Jorgeus · Gestão e Inteligência Parlamentar</p>
      </aside>

      {/* Formulário */}
      <main className="flex flex-col px-5 py-6 sm:px-10">
        <Link to="/" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <MarcaLogo className="h-12 w-auto" />
            </div>
            <MarcaIcone className="hidden lg:block h-11 w-11 mb-6" />

            <h1 className="texto-marca text-[22px] sm:text-[26px] leading-tight font-bold text-foreground">Entrar</h1>
            <p className="mt-2 text-sm text-muted-foreground">Use o e-mail e a senha do seu acesso ao gabinete.</p>

            <form onSubmit={handleLogin} className="mt-8 space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email" type="email" autoComplete="email" inputMode="email"
                  placeholder="seu@email.com" className="h-11"
                  value={email} onChange={(e) => setEmail(e.target.value)} required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password" type={verSenha ? "text" : "password"} autoComplete="current-password"
                    placeholder="Sua senha" className="h-11 pr-11"
                    value={password} onChange={(e) => setPassword(e.target.value)} required
                  />
                  <button
                    type="button" onClick={() => setVerSenha((v) => !v)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
                  >
                    {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {erro && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erro}
                </p>
              )}

              <Button type="submit" className="w-full h-11 text-[15px] gap-2" disabled={isLoading || !email || !password}>
                <LogIn className="h-4 w-4" />
                {isLoading ? "Entrando…" : "Entrar"}
              </Button>
            </form>

            <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              O acesso é criado pelo administrador do seu gabinete. Se ainda não tem login ou esqueceu a senha, fale com ele.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground">Política de Privacidade</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
