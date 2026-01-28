import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WhatsAppSendingProvider } from "@/contexts/WhatsAppSendingContext";
import { MunicipeDeletionProvider } from "@/contexts/MunicipeDeletionContext";
import { DemandaNotificationProvider } from "@/contexts/DemandaNotificationContext";
import { EnvioWhatsAppProgress } from "@/components/forms/EnvioWhatsAppProgress";
import { MunicipeDeletionProgress } from "@/components/forms/MunicipeDeletionProgress";
import { DemandaNotificationProgress } from "@/components/forms/DemandaNotificationProgress";
import { AuthLayout } from "@/components/layout/AuthLayout";
import Dashboard from "./pages/Dashboard";
import Demandas from "./pages/Demandas";
import Municipes from "./pages/Municipes";
import Kanban from "./pages/Kanban";
import PlanoAcao from "./pages/PlanoAcao";
import SolicitarAgenda from "./pages/SolicitarAgenda";
import WhatsApp from "./pages/WhatsApp";
import ConfiguracoesWhatsApp from "./pages/ConfiguracoesWhatsApp";
import AssessorIA from "./pages/AssessorIA";
import Tags from "./pages/Tags";
import Areas from "./pages/Areas";
import Usuarios from "./pages/Usuarios";
import Configuracoes from "./pages/Configuracoes";
import MapaUnificado from "./pages/MapaUnificado";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WhatsAppSendingProvider>
        <MunicipeDeletionProvider>
        <DemandaNotificationProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <AuthLayout>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="/demandas" element={<Demandas />} />
              <Route path="/municipes" element={<Municipes />} />
              <Route path="/kanban" element={<Kanban />} />
              <Route path="/plano-acao" element={<PlanoAcao />} />
              <Route path="/solicitar-agenda" element={<SolicitarAgenda />} />
              <Route path="/whatsapp" element={<WhatsApp />} />
              <Route path="/configuracoes-whatsapp" element={<ConfiguracoesWhatsApp />} />
              <Route path="/assessor-ia" element={<AssessorIA />} />
              <Route path="/tags" element={<Tags />} />
              <Route path="/areas" element={<Areas />} />
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/config" element={<Configuracoes />} />
              <Route path="/mapa" element={<MapaUnificado />} />
              {/* Rota do Mapa Cruzado removida - funcionalidade integrada ao Mapa principal */}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </AuthLayout>
          </BrowserRouter>
          <EnvioWhatsAppProgress />
          <MunicipeDeletionProgress />
          <DemandaNotificationProgress />
          </TooltipProvider>
        </DemandaNotificationProvider>
        </MunicipeDeletionProvider>
      </WhatsAppSendingProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
