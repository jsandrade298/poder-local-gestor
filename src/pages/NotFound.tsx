import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarcaIcone } from "@/components/marca/Marca";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <MarcaIcone className="h-14 w-14 mx-auto mb-5 opacity-90" />
        <p className="texto-etiqueta text-muted-foreground mb-2">Erro 404</p>
        <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground mb-6">
          O endereço <span className="font-mono text-foreground">{location.pathname}</span> não existe ou mudou de lugar.
        </p>
        <Button asChild className="gap-2">
          <Link to="/inicio"><ArrowLeft className="h-4 w-4" /> Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
