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
import { lazy as reactLazy, Suspense, type ComponentType } from "react";
import Login from "./pages/Login";

/**
 * Como React.lazy, mas se o arquivo da tela não existir mais (o app foi
 * publicado de novo enquanto a aba estava aberta), recarrega a página uma
 * vez para buscar a versão nova em vez de quebrar.
 */
function lazy<T extends ComponentType<any>>(importar: () => Promise<{ default: T }>) {
  return reactLazy(async () => {
    const CHAVE = "recarregou-por-versao-nova";
    try {
      const modulo = await importar();
      try { sessionStorage.removeItem(CHAVE); } catch { /* sem storage */ }
      return modulo;
    } catch (erro) {
      let jaRecarregou = false;
      try { jaRecarregou = sessionStorage.getItem(CHAVE) === "1"; } catch { /* sem storage */ }
      if (!jaRecarregou) {
        try { sessionStorage.setItem(CHAVE, "1"); } catch { /* sem storage */ }
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // aguarda o reload
      }
      throw erro;
    }
  });
}

// Cada tela é baixada só quando aberta (antes: um único arquivo de ~3 MB).
const Inicio = lazy(() => import("./pages/Inicio"));
const Analises = lazy(() => import("./pages/Analises"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Demandas = lazy(() => import("./pages/Demandas"));
const Municipes = lazy(() => import("./pages/Municipes"));
const Kanban = lazy(() => import("./pages/Kanban"));
const Quadros = lazy(() => import("./pages/Quadros"));
const QuadroProjeto = lazy(() => import("./pages/QuadroProjeto"));
const PlanoAcao = lazy(() => import("./pages/PlanoAcao"));
const PlanoAcaoDetalhe = lazy(() => import("./pages/PlanoAcaoDetalhe"));
const SolicitarAgenda = lazy(() => import("./pages/SolicitarAgenda"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const ConfiguracoesWhatsApp = lazy(() => import("./pages/ConfiguracoesWhatsApp"));
const AssessorIA = lazy(() => import("./pages/AssessorIA"));
const Tags = lazy(() => import("./pages/Tags"));
const Categorias = lazy(() => import("./pages/Categorias"));
const Areas = lazy(() => import("./pages/Areas"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const MapaUnificado = lazy(() => import("./pages/MapaUnificado"));
const BalancoDemandas = lazy(() => import("./pages/BalancoDemandas"));
const EscolherDestino = lazy(() => import("./pages/EscolherDestino"));
const AdminSaaS = lazy(() => import("./pages/AdminSaaS"));
const AdminNotificacoesWhatsApp = lazy(() => import("./pages/AdminNotificacoesWhatsApp"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ConviteRepresentante = lazy(() => import("./pages/ConviteRepresentante"));
const RepresentanteDashboard = lazy(() => import("./pages/representante/RepresentanteDashboard"));
const RepresentanteMunicipes = lazy(() => import("./pages/representante/RepresentanteMunicipes"));
const RepresentanteDemandas = lazy(() => import("./pages/representante/RepresentanteDemandas"));
const RepresentanteAgenda = lazy(() => import("./pages/representante/RepresentanteAgenda"));
const RepresentanteMapa = lazy(() => import("./pages/representante/RepresentanteMapa"));

function CarregandoTela() {
  return (
    <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ═══════════════════════════════════════════════════════════
      // CRÍTICO: Desabilita refetch automático ao voltar para a aba.
      // Sem isso, toda vez que o usuário troca de aba e volta,
      // TODAS as queries refazem fetch, causando loading spinners
      // e perda de estado nos formulários/dialogs abertos.
      // ═══════════════════════════════════════════════════════════
      refetchOnWindowFocus: false,
    },
  },
});

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
            <Suspense fallback={<CarregandoTela />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/site" element={<LandingPage />} />
              <Route path="/convite" element={<ConviteRepresentante />} />
              <Route path="/rep" element={<RepresentanteDashboard />} />
              <Route path="/rep/municipes" element={<RepresentanteMunicipes />} />
              <Route path="/rep/demandas" element={<RepresentanteDemandas />} />
              <Route path="/rep/agenda" element={<RepresentanteAgenda />} />
              <Route path="/rep/mapa" element={<RepresentanteMapa />} />
              <Route path="/escolher" element={<EscolherDestino />} />
              <Route path="/admin" element={<AdminSaaS />} />
              <Route path="/admin/notificacoes" element={<AdminNotificacoesWhatsApp />} />
              <Route path="/" element={<Inicio />} />
              <Route path="/analises" element={<Analises />} />
              <Route path="/visao-geral" element={<Dashboard />} />
              <Route path="/demandas" element={<Demandas />} />
              <Route path="/municipes" element={<Municipes />} />
              <Route path="/kanban" element={<Kanban />} />
              <Route path="/quadros" element={<Quadros />} />
              <Route path="/quadros/:id" element={<QuadroProjeto />} />
              <Route path="/plano-acao" element={<PlanoAcao />} />
              <Route path="/plano-acao/:id" element={<PlanoAcaoDetalhe />} />
              <Route path="/solicitar-agenda" element={<SolicitarAgenda />} />
              <Route path="/whatsapp" element={<WhatsApp />} />
              <Route path="/configuracoes-whatsapp" element={<ConfiguracoesWhatsApp />} />
              <Route path="/assessor-ia" element={<AssessorIA />} />
              <Route path="/tags" element={<Tags />} />
              <Route path="/categorias" element={<Categorias />} />
              <Route path="/areas" element={<Areas />} />
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/config" element={<Configuracoes />} />
              <Route path="/mapa" element={<MapaUnificado />} />
              <Route path="/balanco-demandas" element={<BalancoDemandas />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
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
