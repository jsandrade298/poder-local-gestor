import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building, Lock, Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Estado = "validando" | "formulario" | "sucesso" | "erro";

export default function ConviteRepresentante() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const { toast }       = useToast();

  const token = searchParams.get("token") || "";

  const [estado, setEstado]         = useState<Estado>("validando");
  const [nomeRepresentante, setNomeRepresentante] = useState("");
  const [erroMensagem, setErroMensagem] = useState("");
  const [email, setEmail]           = useState("");
  const [senha, setSenha]           = useState("");
  const [confirmar, setConfirmar]   = useState("");
  const [isLoading, setIsLoading]   = useState(false);

  // ── Validar token ao carregar ────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setErroMensagem("Link de convite inválido. Solicite um novo link ao gabinete.");
      setEstado("erro");
      return;
    }

    // Verificar token diretamente no banco (sem autenticação)
    supabase
      .from("municipes")
      .select("nome, invite_expires_at, invite_token_usado")
      .eq("invite_token", token)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setErroMensagem("Convite inválido. Solicite um novo link ao gabinete.");
          setEstado("erro");
          return;
        }

        if (data.invite_token_usado) {
          setErroMensagem("Este convite já foi utilizado. Solicite um novo link ao gabinete.");
          setEstado("erro");
          return;
        }

        if (new Date(data.invite_expires_at) < new Date()) {
          setErroMensagem("Este convite expirou. Solicite um novo link ao gabinete.");
          setEstado("erro");
          return;
        }

        setNomeRepresentante(data.nome);
        setEstado("formulario");
      });
  }, [token]);

  // ── Submeter formulário ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!email.trim()) {
      toast({ title: "Informe seu email", variant: "destructive" });
      return;
    }
    if (senha.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (senha !== confirmar) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("representante-accept-invite", {
        body: { token, email: email.trim(), senha },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao criar conta");
      }

      setEstado("sucesso");
    } catch (err: any) {
      toast({
        title: "Erro ao criar conta",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
            <Building className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Poder Local Gestor</h1>
          <p className="text-muted-foreground text-sm">Portal do Representante</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-center">
              {estado === "validando" && "Validando convite…"}
              {estado === "formulario" && `Olá, ${nomeRepresentante.split(" ")[0]}!`}
              {estado === "sucesso"    && "Conta criada com sucesso!"}
              {estado === "erro"       && "Convite inválido"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* Validando */}
            {estado === "validando" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Verificando seu convite…</p>
              </div>
            )}

            {/* Erro */}
            {estado === "erro" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
                <p className="text-sm text-muted-foreground">{erroMensagem}</p>
                <Button variant="outline" className="mt-2" onClick={() => navigate("/login")}>
                  Ir para o login
                </Button>
              </div>
            )}

            {/* Formulário */}
            {estado === "formulario" && (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Você foi convidado para ser Representante. Defina seu email e senha para ativar o acesso.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Seu email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="senha">Criar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="senha"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        className="pl-9"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmar">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmar"
                        type="password"
                        placeholder="Repita a senha"
                        className="pl-9"
                        value={confirmar}
                        onChange={(e) => setConfirmar(e.target.value)}
                        disabled={isLoading}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando conta…</>
                  ) : (
                    "Ativar meu acesso"
                  )}
                </Button>
              </>
            )}

            {/* Sucesso */}
            {estado === "sucesso" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
                <p className="text-sm text-muted-foreground">
                  Sua conta foi criada! Agora você pode fazer login e começar a usar o sistema.
                </p>
                <Button className="mt-2 w-full" onClick={() => navigate("/login")}>
                  Ir para o login
                </Button>
              </div>
            )}

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
