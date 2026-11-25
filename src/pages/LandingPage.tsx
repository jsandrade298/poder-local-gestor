import { Link } from "react-router-dom";
import {
  ArrowRight, BarChart3, Bell, CalendarDays, ClipboardList, Columns3, Lock, LogIn, MapPinned, ShieldCheck,
  Sparkles, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarcaIcone, MarcaLogo, MarcaPalavra } from "@/components/marca/Marca";
import { aplicarPerfil, useTema, type Perfil } from "@/lib/tema";
import { cn } from "@/lib/utils";

/**
 * Apresentação pública do Jorgeus (raiz "/").
 * Sem cadastro: o acesso é criado pelo Super Admin no Admin SaaS.
 * O visitante alterna entre as duas identidades (Brasil! e Tech); a escolha
 * fica guardada e vale também para a tela de login. Depois de entrar, vale a
 * identidade do gabinete (definida pelo Super Admin).
 */

const RECURSOS = [
  { icone: ClipboardList, titulo: "Demandas com protocolo", texto: "Cada pedido do munícipe vira uma demanda com protocolo, responsável, prazo e histórico de tudo o que foi feito." },
  { icone: Users, titulo: "Munícipes e lideranças", texto: "Cadastro completo, prontuário de contatos e busca rápida por nome, bairro, tag ou telefone." },
  { icone: MapPinned, titulo: "Território no mapa", texto: "Veja onde estão as demandas e os munícipes, por bairro e por tema, para planejar a atuação." },
  { icone: Columns3, titulo: "Quadros de trabalho", texto: "Projetos da equipe em etapas, com responsáveis, checklist, comentários e avisos de prazo." },
  { icone: CalendarDays, titulo: "Agenda do mandato", texto: "Pedidos de agenda, confirmações e acompanhantes organizados, sem perder compromisso." },
  { icone: BarChart3, titulo: "O gabinete em números", texto: "Entrada e conclusão de demandas, prazos, canais e bairros, do mês ao mandato inteiro." },
];

const PASSOS = [
  { n: "01", titulo: "Registre", texto: "A equipe cadastra a demanda em segundos, no computador ou no celular, já ligada ao munícipe." },
  { n: "02", titulo: "Acompanhe", texto: "Responsáveis, prazos e avisos mantêm tudo andando. Cada um vê a própria semana ao abrir o app." },
  { n: "03", titulo: "Mostre resultado", texto: "Análises por período e por território mostram o que o mandato entregou, com números de verdade." },
];

const PERFIS: { v: Perfil; nome: string; desc: string }[] = [
  { v: "brasil", nome: "Brasil!", desc: "Institucional" },
  { v: "tech", nome: "Tech", desc: "Digital" },
];

/** Alternar a identidade visual (Brasil! / Tech). */
function TrocaPerfil({ perfil, className }: { perfil: Perfil; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Identidade visual" className={cn("inline-flex rounded-full border border-white/15 bg-white/5 p-1", className)}>
      {PERFIS.map((p) => (
        <button key={p.v} type="button" role="radio" aria-checked={perfil === p.v} onClick={() => aplicarPerfil(p.v)}
          className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors",
            perfil === p.v ? "bg-white text-[color:var(--marca-fundo-escuro)] font-semibold" : "text-white/70 hover:text-white")}>
          <MarcaIcone perfil={p.v} className="h-4 w-4" />
          {p.nome}
          <span className={cn("hidden sm:inline", perfil === p.v ? "opacity-60 font-normal" : "opacity-50")}>· {p.desc}</span>
        </button>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const { perfil } = useTema();
  return (
    <div data-perfil={perfil} className="min-h-screen bg-background text-foreground">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--marca-fundo-escuro) 90%, transparent)" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" aria-label="Jorgeus — início" className="flex items-center gap-2.5">
            <MarcaIcone perfil={perfil} className="h-8 w-8" />
            <MarcaPalavra perfil={perfil} modo="escuro" className="h-[15px]" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/75">
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a>
            <a href="#seguranca" className="hover:text-white transition-colors">Segurança</a>
          </nav>
          <Button asChild size="sm" className="gap-2 h-9 px-4 bg-white text-[color:var(--marca-fundo-escuro)] hover:bg-white/90">
            <Link to="/login"><LogIn className="h-4 w-4" /> Entrar</Link>
          </Button>
        </div>
      </header>

      {/* Abertura */}
      <section className="relative overflow-hidden text-white" style={{ background: "var(--marca-fundo-escuro)" }}>
        <div aria-hidden className="pointer-events-none absolute -right-48 -top-48 h-[40rem] w-[40rem] rounded-full opacity-25 blur-3xl fundo-marca" />
        <div aria-hidden className="pointer-events-none absolute -left-40 top-1/2 h-[26rem] w-[26rem] rounded-full opacity-15 blur-3xl fundo-marca" />
        <div className="relative mx-auto grid grid-cols-1 max-w-6xl items-center gap-12 px-5 py-20 md:py-28 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="texto-etiqueta text-[11px] text-white/60 mb-5">Gestão e Inteligência Parlamentar</p>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.08] tracking-tight">
              O gabinete inteiro{" "}
              <span className="texto-degrade">organizado</span>, do pedido ao resultado.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/75 leading-relaxed">
              Demandas, munícipes, agenda, quadros de trabalho e análises em um só lugar, para a equipe agir rápido
              e o mandato mostrar o que entrega.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6 gap-2 text-[15px] bg-white text-[color:var(--marca-fundo-escuro)] hover:bg-white/90">
                <Link to="/login"><LogIn className="h-4 w-4" /> Entrar no Jorgeus</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 px-6 gap-2 text-[15px] text-white hover:bg-white/10 hover:text-white">
                <a href="#recursos">Conhecer os recursos <ArrowRight className="h-4 w-4" /></a>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <span className="text-xs text-white/55">Duas identidades, o gabinete escolhe:</span>
              <TrocaPerfil perfil={perfil} />
            </div>
          </div>

          {/* Símbolo com "órbitas" — o ponto focal de inteligência do manual */}
          <div className="relative mx-auto hidden aspect-square w-full max-w-[400px] lg:block" aria-hidden>
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-10 rounded-full border border-white/10" />
            <div className="absolute inset-20 rounded-full border border-white/[0.07]" />
            <span className="absolute left-[12%] top-[18%] h-2.5 w-2.5 rounded-full" style={{ background: "var(--marca-3)", boxShadow: "0 0 18px var(--marca-3)" }} />
            <span className="absolute right-[8%] top-[52%] h-2 w-2 rounded-full" style={{ background: "var(--marca-2)", boxShadow: "0 0 16px var(--marca-2)" }} />
            <span className="absolute left-[30%] bottom-[6%] h-2 w-2 rounded-full bg-[#60A5FA]" style={{ boxShadow: "0 0 16px #60A5FA" }} />
            <MarcaIcone perfil={perfil} className="absolute left-[18%] top-[18%] h-[64%] w-[64%] drop-shadow-[0_20px_60px_rgba(255,255,255,0.12)]" />
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="scroll-mt-16 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="texto-etiqueta text-primary mb-3">Recursos</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Tudo o que o gabinete faz, em um só sistema</h2>
            <p className="mt-4 text-muted-foreground text-lg">Feito para a rotina de vereadores e deputados: simples para quem atende, completo para quem coordena.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
              <article key={titulo} className="group rounded-2xl border bg-card p-6 shadow-suave transition-all hover:-translate-y-0.5 hover:shadow-media">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground ring-1 ring-primary/10">
                  <Icone className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold">{titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="scroll-mt-16 border-y bg-muted/50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="texto-etiqueta text-primary mb-3">Como funciona</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Três passos, todos os dias</h2>
          </div>
          <ol className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PASSOS.map((p) => (
              <li key={p.n} className="relative rounded-2xl border bg-card p-7 shadow-suave">
                <span className="texto-marca text-3xl font-bold texto-degrade">{p.n}</span>
                <h3 className="mt-4 text-xl font-bold">{p.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Segurança */}
      <section id="seguranca" className="scroll-mt-16 py-20 md:py-28">
        <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-10 px-5 lg:grid-cols-2">
          <div>
            <p className="texto-etiqueta text-primary mb-3">Segurança</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Os dados de cada gabinete, só do gabinete</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Cada mandato trabalha em um espaço isolado. Quem entra é convidado pelo administrador, e cada pessoa vê e edita
              apenas o que a função permite.
            </p>
          </div>
          <ul className="grid gap-4">
            {[
              { icone: Lock, titulo: "Dados isolados por gabinete", texto: "Um gabinete nunca enxerga as informações de outro." },
              { icone: ShieldCheck, titulo: "Acesso por convite", texto: "Não há cadastro aberto: as contas são criadas pelo administrador." },
              { icone: Bell, titulo: "Avisos na medida", texto: "Prazos e menções avisam quem precisa, sem encher a caixa de notificações." },
            ].map(({ icone: Icone, titulo, texto }) => (
              <li key={titulo} className="flex gap-4 rounded-2xl border bg-card p-5 shadow-suave">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Icone className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold">{titulo}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Chamada final */}
      <section className="px-5 pb-20 md:pb-28">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-8 py-14 text-center text-white md:px-16" style={{ background: "var(--marca-fundo-escuro)" }}>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-72 w-[42rem] rounded-full opacity-30 blur-3xl fundo-marca" />
          <Sparkles className="relative mx-auto h-7 w-7" style={{ color: "var(--marca-3)" }} />
          <h2 className="relative mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">Pronto para começar o dia?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/75">Entre com o acesso que o administrador do seu gabinete criou para você.</p>
          <Button asChild size="lg" className="relative mt-8 h-12 px-7 gap-2 text-[15px] bg-white text-[color:var(--marca-fundo-escuro)] hover:bg-white/90">
            <Link to="/login"><LogIn className="h-4 w-4" /> Entrar no Jorgeus</Link>
          </Button>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <MarcaLogo perfil={perfil} className="h-8 w-auto" />
          <p className="text-xs text-muted-foreground text-center sm:text-right">
            © {new Date().getFullYear()} Jorgeus · Gestão e Inteligência Parlamentar ·{" "}
            <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground">Política de Privacidade</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
