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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <h1 className="text-2xl p-4">Sistema de Gestão - Debug</h1>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <div className="p-4">
                  <h2>Página Principal</h2>
                  <p>Se você está vendo isso, o App está funcionando!</p>
                  <a href="/login" className="text-blue-500 underline">
                    Ir para Login
                  </a>
                </div>
              } />
              <Route path="*" element={<div className="p-4">Página não encontrada</div>} />
            </Routes>
          </BrowserRouter>
        </div>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
