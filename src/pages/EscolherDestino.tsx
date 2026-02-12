import { useNavigate } from "react-router-dom";
import { Building, Shield, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function EscolherDestino() {
  const navigate = useNavigate();
  const { tenant } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Bem-vindo de volta!
          </h1>
          <p className="text-muted-foreground">
            Para onde deseja ir?
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* Opção: Gabinete */}
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-transparent bg-card shadow-sm hover:border-primary hover:shadow-md transition-all group text-left"
          >
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Building className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground text-lg">
                {tenant?.nome || "Meu Gabinete"}
              </p>
              <p className="text-sm text-muted-foreground">
                Acessar demandas, munícipes e gestão do gabinete
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          {/* Opção: Admin SaaS */}
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-transparent bg-card shadow-sm hover:border-amber-500 hover:shadow-md transition-all group text-left"
          >
            <div className="h-14 w-14 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
              <Shield className="h-7 w-7 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground text-lg">
                Painel Admin SaaS
              </p>
              <p className="text-sm text-muted-foreground">
                Gerenciar gabinetes, usuários e uso da plataforma
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
