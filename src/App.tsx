import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthLayout } from "@/components/layout/AuthLayout";
import Dashboard from "./pages/Dashboard";
import Demandas from "./pages/Demandas";
import Municipes from "./pages/Municipes";
import Tags from "./pages/Tags";
import Areas from "./pages/Areas";
import Usuarios from "./pages/Usuarios";
import Configuracoes from "./pages/Configuracoes";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  console.log('App está renderizando...');
  
  return (
    <div className="min-h-screen bg-background p-4">
      <h1 className="text-3xl font-bold text-center mb-8">
        Sistema de Gestão de Gabinete
      </h1>
      
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-xl mb-4">Sistema Carregado!</h2>
          <p className="text-muted-foreground mb-4">
            O sistema está funcionando corretamente.
          </p>
          
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <div className="space-y-4">
                  <p>Você está na página principal!</p>
                  <a 
                    href="/login" 
                    className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
                  >
                    Ir para Login
                  </a>
                </div>
              } />
            </Routes>
          </BrowserRouter>
        </div>
      </div>
      
      <Toaster />
      <Sonner />
    </div>
  );
};

export default App;
