import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Users, MessageCircle, Bot, MapPin, Target,
  BarChart3, Columns, ArrowRight, Check, ChevronRight,
  Clock, AlertTriangle, TrendingUp, Phone, Mail, Shield,
  Star, Zap, Eye, Calendar, Layers, ChevronDown,
} from "lucide-react";

// ============================================================
// MOCK DATA para Demo Interativo
// ============================================================

const mockKPIs = [
  { label: "Total Demandas", value: 342, icon: FileText, color: "#3B82F6" },
  { label: "Abertas", value: 47, icon: Clock, color: "#F59E0B" },
  { label: "Em Atraso", value: 12, icon: AlertTriangle, color: "#EF4444" },
  { label: "Munícipes", value: 1247, icon: Users, color: "#10B981" },
  { label: "Resolvidas (mês)", value: 38, icon: TrendingUp, color: "#8B5CF6" },
];

const mockDemandas = [
  { id: 1, titulo: "Buraco na Rua das Flores, 234", municipe: "Maria Silva", area: "Infraestrutura", status: "Aberta", statusCor: "#3B82F6", data: "10/02/2026", prioridade: "Alta" },
  { id: 2, titulo: "Iluminação na Praça Central", municipe: "José Santos", area: "Iluminação Pública", status: "Em Andamento", statusCor: "#F59E0B", data: "08/02/2026", prioridade: "Média" },
  { id: 3, titulo: "Poda de árvore na Av. Brasil", municipe: "Ana Costa", area: "Meio Ambiente", status: "Concluída", statusCor: "#10B981", data: "05/02/2026", prioridade: "Baixa" },
  { id: 4, titulo: "Vazamento de esgoto - Rua 7 de Setembro", municipe: "Carlos Oliveira", area: "Saneamento", status: "Em Andamento", statusCor: "#F59E0B", data: "07/02/2026", prioridade: "Urgente" },
  { id: 5, titulo: "Semáforo quebrado - Cruzamento da Rodoviária", municipe: "Fernanda Lima", area: "Trânsito", status: "Aberta", statusCor: "#3B82F6", data: "09/02/2026", prioridade: "Alta" },
  { id: 6, titulo: "Limpeza do terreno baldio - Jd. América", municipe: "Roberto Alves", area: "Limpeza Urbana", status: "Concluída", statusCor: "#10B981", data: "03/02/2026", prioridade: "Média" },
];

const mockKanban = {
  "Aberta": [
    { titulo: "Buraco na Rua das Flores", municipe: "Maria Silva", cor: "#EF4444" },
    { titulo: "Semáforo quebrado - Rodoviária", municipe: "Fernanda Lima", cor: "#F59E0B" },
    { titulo: "Calçada irregular - Rua XV", municipe: "Pedro Nunes", cor: "#3B82F6" },
  ],
  "Em Andamento": [
    { titulo: "Iluminação Praça Central", municipe: "José Santos", cor: "#F59E0B" },
    { titulo: "Vazamento de esgoto", municipe: "Carlos Oliveira", cor: "#EF4444" },
  ],
  "Concluída": [
    { titulo: "Poda de árvore - Av. Brasil", municipe: "Ana Costa", cor: "#10B981" },
    { titulo: "Limpeza terreno - Jd. América", municipe: "Roberto Alves", cor: "#10B981" },
    { titulo: "Pintura de faixa - Escola Municipal", municipe: "Lucia Mendes", cor: "#10B981" },
    { titulo: "Troca de lâmpada - Rua do Comércio", municipe: "Marcos Souza", cor: "#10B981" },
  ],
};

// ============================================================
// ANIMATED COUNTER
// ============================================================

function AnimatedCounter({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const startTime = Date.now();
          const tick = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count.toLocaleString("pt-BR")}</span>;
}

// ============================================================
// FEATURES DATA
// ============================================================

const features = [
  {
    icon: FileText,
    title: "Gestão de Demandas",
    desc: "Cadastre, acompanhe e resolva todas as solicitações dos munícipes em um só lugar. Filtros avançados, prazos e alertas automáticos.",
    destaque: true,
  },
  {
    icon: Columns,
    title: "Kanban Visual",
    desc: "Visualize o fluxo de trabalho com quadro Kanban drag-and-drop. Saiba exatamente o status de cada demanda.",
    destaque: true,
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Integrado",
    desc: "Envie mensagens individuais ou em massa direto pela plataforma. Notificações automáticas de status e aniversários.",
    destaque: true,
  },
  {
    icon: Bot,
    title: "Assessor IA",
    desc: "Inteligência artificial que ajuda a redigir ofícios, respostas e documentos legislativos em segundos.",
    destaque: true,
  },
  {
    icon: MapPin,
    title: "Mapa Georreferenciado",
    desc: "Visualize todas as demandas e munícipes no mapa. Identifique áreas críticas e planeje ações por região.",
    destaque: false,
  },
  {
    icon: Target,
    title: "Plano de Ação",
    desc: "Organize projetos, defina metas e acompanhe a execução de pautas legislativas e ações do mandato.",
    destaque: false,
  },
  {
    icon: BarChart3,
    title: "Dashboard Analítico",
    desc: "Métricas em tempo real: demandas por status, área, período. Relatórios prontos para prestação de contas.",
    destaque: false,
  },
  {
    icon: Users,
    title: "Gestão de Munícipes",
    desc: "Base completa de munícipes com tags, categorias, histórico de demandas e comunicação integrada.",
    destaque: false,
  },
];

// ============================================================
// LANDING PAGE
// ============================================================

export default function LandingPage() {
  const navigate = useNavigate();
  const [demoTab, setDemoTab] = useState<"dashboard" | "demandas" | "kanban">("dashboard");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

        .font-display { font-family: 'Sora', sans-serif; }

        .gradient-text {
          background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #0ea5e9 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-gradient {
          background: radial-gradient(ellipse 80% 60% at 50% -20%, rgba(37, 99, 235, 0.08) 0%, transparent 70%),
                      radial-gradient(ellipse 60% 40% at 80% 60%, rgba(14, 165, 233, 0.05) 0%, transparent 70%),
                      linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        }

        .demo-shadow {
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.15),
                      0 0 0 1px rgba(0, 0, 0, 0.05);
        }

        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.1);
        }

        .pricing-glow {
          box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.2),
                      0 25px 60px -15px rgba(37, 99, 235, 0.15);
        }

        .fade-in {
          animation: fadeInUp 0.6s ease-out both;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .stagger-1 { animation-delay: 0.1s; }
        .stagger-2 { animation-delay: 0.2s; }
        .stagger-3 { animation-delay: 0.3s; }
        .stagger-4 { animation-delay: 0.4s; }

        .dot-pattern {
          background-image: radial-gradient(circle, #e2e8f0 1px, transparent 1px);
          background-size: 24px 24px;
        }

        .kanban-card {
          transition: all 0.2s ease;
        }
        .kanban-card:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 8px 25px -8px rgba(0,0,0,0.12);
        }
      `}</style>

      {/* ========== NAVBAR ========== */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-slate-900 tracking-tight">
              Poder Local
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#recursos" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Recursos</a>
            <a href="#demo" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Demo</a>
            <a href="#preco" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Preço</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-medium text-slate-700 hover:text-slate-900 px-4 py-2 transition-colors"
            >
              Entrar
            </button>
            <button
              onClick={() => {
                document.getElementById("preco")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20"
            >
              Começar agora
            </button>
          </div>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section className="hero-gradient pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center fade-in">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-blue-100">
              <Zap className="h-3.5 w-3.5" />
              Plataforma completa para gabinetes parlamentares
            </div>

            <h1 className="font-display font-extrabold text-4xl md:text-5xl lg:text-6xl text-slate-900 leading-[1.1] tracking-tight mb-6">
              Gestão inteligente
              <br />
              <span className="gradient-text">para quem representa</span>
              <br />
              o povo
            </h1>

            <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              Organize demandas, gerencie munícipes, envie WhatsApp em massa e
              use IA para produzir documentos legislativos —
              tudo em uma única plataforma.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => {
                  document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all hover:shadow-xl hover:shadow-blue-600/20"
              >
                Ver demonstração
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium px-6 py-4 text-base transition-colors"
              >
                Já tenho conta
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto fade-in stagger-2">
            {[
              { label: "Demandas gerenciadas", value: 15000 },
              { label: "Munícipes cadastrados", value: 42000 },
              { label: "Mensagens enviadas", value: 180000 },
              { label: "Horas economizadas", value: 3200 },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="font-display font-bold text-2xl md:text-3xl text-slate-900">
                  <AnimatedCounter target={stat.value} />
                  <span className="text-blue-600">+</span>
                </p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== RECURSOS ========== */}
      <section id="recursos" className="py-24 bg-slate-50 dot-pattern">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 mb-4">
              Tudo que seu gabinete precisa
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Mais de 20 módulos integrados para gestão completa do mandato
            </p>
          </div>

          {/* Features em destaque (2x2) */}
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            {features.filter(f => f.destaque).map((feat, i) => (
              <div
                key={i}
                className="feature-card bg-white rounded-2xl p-7 border border-slate-100 transition-all duration-300 cursor-default"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: ["#EFF6FF", "#F0FDF4", "#FFF7ED", "#FAF5FF"][i] }}
                >
                  <feat.icon
                    className="h-6 w-6"
                    style={{ color: ["#2563EB", "#16A34A", "#EA580C", "#7C3AED"][i] }}
                  />
                </div>
                <h3 className="font-display font-semibold text-lg text-slate-900 mb-2">
                  {feat.title}
                </h3>
                <p className="text-slate-500 leading-relaxed text-sm">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Features secundárias (4 colunas) */}
          <div className="grid md:grid-cols-4 gap-5">
            {features.filter(f => !f.destaque).map((feat, i) => (
              <div
                key={i}
                className="feature-card bg-white rounded-2xl p-6 border border-slate-100 transition-all duration-300 cursor-default"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center mb-3">
                  <feat.icon className="h-5 w-5 text-slate-600" />
                </div>
                <h3 className="font-display font-semibold text-sm text-slate-900 mb-1.5">
                  {feat.title}
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== DEMO INTERATIVO ========== */}
      <section id="demo" className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4 border border-emerald-100">
              <Eye className="h-3.5 w-3.5" />
              Demonstração interativa
            </div>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 mb-4">
              Veja o sistema em ação
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Explore a plataforma com dados simulados de um gabinete fictício
            </p>
          </div>

          {/* Demo Window */}
          <div className="max-w-5xl mx-auto">
            <div className="demo-shadow rounded-2xl overflow-hidden border border-slate-200">
              {/* Window Chrome */}
              <div className="bg-slate-800 px-4 py-3 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-slate-700 rounded-lg px-4 py-1 text-xs text-slate-400 flex items-center gap-2">
                    <Shield className="h-3 w-3 text-green-400" />
                    app.poderlocal.com.br / Gabinete Vereador Santos
                  </div>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex gap-2">
                {([
                  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
                  { key: "demandas", label: "Demandas", icon: FileText },
                  { key: "kanban", label: "Kanban", icon: Columns },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setDemoTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      demoTab === tab.key
                        ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Demo Content */}
              <div className="bg-slate-100/50 p-6 min-h-[420px]">
                {/* === DASHBOARD === */}
                {demoTab === "dashboard" && (
                  <div className="space-y-5 fade-in">
                    {/* KPIs */}
                    <div className="grid grid-cols-5 gap-3">
                      {mockKPIs.map((kpi, i) => (
                        <div key={i} className="bg-white rounded-xl p-4 border border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                              {kpi.label}
                            </span>
                            <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                          </div>
                          <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Charts row */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* Donut chart mock */}
                      <div className="bg-white rounded-xl p-5 border border-slate-100 col-span-1">
                        <p className="text-sm font-semibold text-slate-700 mb-4">Por Status</p>
                        <div className="flex items-center justify-center">
                          <svg viewBox="0 0 120 120" className="w-32 h-32">
                            <circle cx="60" cy="60" r="45" fill="none" stroke="#E2E8F0" strokeWidth="18" />
                            <circle cx="60" cy="60" r="45" fill="none" stroke="#3B82F6" strokeWidth="18"
                              strokeDasharray={`${47 * 2.83} ${283 - 47 * 2.83}`}
                              strokeDashoffset="70" strokeLinecap="round"
                            />
                            <circle cx="60" cy="60" r="45" fill="none" stroke="#F59E0B" strokeWidth="18"
                              strokeDasharray={`${28 * 2.83} ${283 - 28 * 2.83}`}
                              strokeDashoffset={`${70 - 47 * 2.83}`} strokeLinecap="round"
                            />
                            <circle cx="60" cy="60" r="45" fill="none" stroke="#10B981" strokeWidth="18"
                              strokeDasharray={`${25 * 2.83} ${283 - 25 * 2.83}`}
                              strokeDashoffset={`${70 - 75 * 2.83}`} strokeLinecap="round"
                            />
                            <text x="60" y="56" textAnchor="middle" className="text-2xl font-bold" fill="#1E293B" style={{ fontSize: "24px", fontWeight: 700 }}>342</text>
                            <text x="60" y="72" textAnchor="middle" fill="#94A3B8" style={{ fontSize: "10px" }}>total</text>
                          </svg>
                        </div>
                        <div className="flex justify-center gap-4 mt-3 text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Abertas</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Andamento</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Concluídas</span>
                        </div>
                      </div>

                      {/* Bar chart mock */}
                      <div className="bg-white rounded-xl p-5 border border-slate-100 col-span-2">
                        <p className="text-sm font-semibold text-slate-700 mb-4">Top 5 Áreas</p>
                        <div className="space-y-3">
                          {[
                            { area: "Infraestrutura", valor: 87, pct: 100 },
                            { area: "Iluminação Pública", valor: 54, pct: 62 },
                            { area: "Saneamento", valor: 43, pct: 49 },
                            { area: "Saúde", valor: 38, pct: 44 },
                            { area: "Educação", valor: 29, pct: 33 },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-xs text-slate-500 w-32 text-right truncate">{item.area}</span>
                              <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                                <div
                                  className="h-full rounded-md transition-all duration-1000 ease-out"
                                  style={{
                                    width: `${item.pct}%`,
                                    background: `linear-gradient(90deg, #3B82F6, #0EA5E9)`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 w-8">{item.valor}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* === DEMANDAS === */}
                {demoTab === "demandas" && (
                  <div className="fade-in">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-semibold text-slate-800">Demandas</h3>
                      <div className="flex gap-2">
                        <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-400 w-48">
                          🔍 Buscar demandas...
                        </div>
                        <div className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1">
                          + Nova Demanda
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Demanda</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Munícipe</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Área</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockDemandas.map((d) => (
                            <tr key={d.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors cursor-pointer">
                              <td className="py-3 px-4">
                                <p className="font-medium text-slate-800 text-xs">{d.titulo}</p>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-600">{d.municipe}</td>
                              <td className="py-3 px-4 text-xs text-slate-600">{d.area}</td>
                              <td className="py-3 px-4">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                                  style={{ backgroundColor: d.statusCor }}
                                >
                                  {d.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-400">{d.data}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* === KANBAN === */}
                {demoTab === "kanban" && (
                  <div className="fade-in">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-semibold text-slate-800">Quadro Kanban</h3>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(mockKanban).map(([coluna, items]) => {
                        const colCor = coluna === "Aberta" ? "#3B82F6" : coluna === "Em Andamento" ? "#F59E0B" : "#10B981";
                        return (
                          <div key={coluna} className="bg-white/60 rounded-xl p-3 border border-slate-200">
                            <div className="flex items-center gap-2 mb-3 px-1">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colCor }} />
                              <span className="text-xs font-semibold text-slate-700">{coluna}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                                {items.length}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {items.map((item, i) => (
                                <div
                                  key={i}
                                  className="kanban-card bg-white rounded-lg p-3 border border-slate-100 cursor-pointer"
                                >
                                  <div
                                    className="w-full h-1 rounded-full mb-2"
                                    style={{ backgroundColor: item.cor }}
                                  />
                                  <p className="text-xs font-medium text-slate-800 leading-snug">
                                    {item.titulo}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {item.municipe}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Demo caption */}
            <p className="text-center text-sm text-slate-400 mt-4">
              * Dados fictícios para demonstração. O sistema real é personalizado para seu gabinete.
            </p>
          </div>
        </div>
      </section>

      {/* ========== PREÇO ========== */}
      <section id="preco" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 mb-4">
              Preço simples, sem surpresas
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Um único plano com tudo incluso. Sem taxas escondidas, sem limites artificiais.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="pricing-glow bg-white rounded-3xl p-8 md:p-10 border border-blue-100 relative overflow-hidden">
              {/* Badge */}
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                COMPLETO
              </div>

              <div className="text-center mb-8">
                <h3 className="font-display font-bold text-xl text-slate-900 mb-1">
                  Poder Local Gestor
                </h3>
                <p className="text-sm text-slate-500">Plataforma completa para seu gabinete</p>
              </div>

              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm text-slate-500">R$</span>
                  <span className="font-display font-extrabold text-5xl text-slate-900">297</span>
                  <span className="text-sm text-slate-500">/mês</span>
                </div>
              </div>

              {/* O que inclui */}
              <div className="space-y-3 mb-8">
                {[
                  "Gestão ilimitada de demandas",
                  "Cadastro ilimitado de munícipes",
                  "Disparo de WhatsApp integrado",
                  "Assessor IA para documentos legislativos",
                  "Mapa georreferenciado",
                  "Kanban visual + Plano de Ação",
                  "Dashboard com métricas em tempo real",
                  "Usuários ilimitados para sua equipe",
                  "Suporte por WhatsApp",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-emerald-600" />
                    </div>
                    <span className="text-sm text-slate-700">{item}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-2xl transition-all hover:shadow-lg hover:shadow-blue-600/20 text-base"
              >
                Quero para meu gabinete
              </button>

              <p className="text-center text-xs text-slate-400 mt-4">
                Período de teste gratuito de 14 dias. Cancele quando quiser.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CTA / CONTATO ========== */}
      <section id="contato" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 mb-4">
              Pronto para transformar seu gabinete?
            </h2>
            <p className="text-lg text-slate-500 mb-10">
              Preencha seus dados e entraremos em contato para iniciar seu teste gratuito.
            </p>

            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 text-left">
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome</label>
                  <input
                    type="text"
                    placeholder="Seu nome completo"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cargo</label>
                  <input
                    type="text"
                    placeholder="Ex: Vereador, Assessor"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                  />
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Cidade / Estado</label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo / SP"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                />
              </div>
              <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-2xl transition-all hover:shadow-lg hover:shadow-blue-600/20 text-base"
                onClick={() => alert("Formulário enviado! Entraremos em contato em breve.")}
              >
                Solicitar teste gratuito
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <span className="font-display font-bold text-white">Poder Local</span>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
              <a href="#demo" className="hover:text-white transition-colors">Demo</a>
              <a href="#preco" className="hover:text-white transition-colors">Preço</a>
              <a href="#contato" className="hover:text-white transition-colors">Contato</a>
            </div>

            <p className="text-sm">
              © 2026 Poder Local. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
