import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Building, Shield, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Verificar se é superadmin
      const { data: isSuperAdmin } = await supabase.rpc('is_superadmin');

      if (isSuperAdmin === true) {
        // Superadmin: mostrar modal de escolha
        setShowSuperAdminModal(true);
        setIsLoading(false);
      } else {
        // Usuário normal: ir direto para o gabinete
        toast({
          title: "Login realizado com sucesso!",
          description: "Redirecionando..."
        });
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: "Erro inesperado. Tente novamente.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const handleChooseDestination = (destination: 'gabinete' | 'admin') => {
    setShowSuperAdminModal(false);
    toast({
      title: "Login realizado com sucesso!",
      description: destination === 'admin' ? "Acessando painel admin..." : "Acessando gabinete..."
    });
    navigate(destination === 'admin' ? '/admin' : '/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
            <Building className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Sistema de Gestão do Gabinete
          </h1>
          <p className="text-muted-foreground">
            Faça login para acessar o sistema
          </p>
        </div>

        {/* Form Card */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-center">
              Acesso ao Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                <LogIn className="h-4 w-4 mr-2" />
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Modal de escolha para superadmin */}
      <Dialog open={showSuperAdminModal} onOpenChange={setShowSuperAdminModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              Bem-vindo de volta!
            </DialogTitle>
            <DialogDescription className="text-center">
              Para onde deseja ir?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 py-4">
            {/* Opção: Gabinete */}
            <button
              onClick={() => handleChooseDestination('gabinete')}
              className="flex items-center gap-4 p-4 rounded-lg border-2 border-transparent hover:border-primary hover:bg-primary/5 transition-all group text-left"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <Building className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Meu Gabinete</p>
                <p className="text-sm text-muted-foreground">
                  Acessar demandas, munícipes e gestão do gabinete
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            {/* Opção: Admin SaaS */}
            <button
              onClick={() => handleChooseDestination('admin')}
              className="flex items-center gap-4 p-4 rounded-lg border-2 border-transparent hover:border-primary hover:bg-primary/5 transition-all group text-left"
            >
              <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Painel Admin SaaS</p>
                <p className="text-sm text-muted-foreground">
                  Gerenciar gabinetes, usuários e uso da plataforma
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
