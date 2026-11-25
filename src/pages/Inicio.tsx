import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, AtSign, BarChart3, Cake, CalendarClock, Check, ChevronRight,
  Columns3, FileText, FolderKanban, Layers, MapPin, MessageCircle, MessageSquare, Minus, Sparkles, Trash2, UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { MinhaSemana } from "@/components/inicio/MinhaSemana";
import { DemandaRapida } from "@/components/demandas/DemandaRapida";
import { useContagemLixeira, DIAS_LIXEIRA } from "@/components/demandas/LixeiraDemandas";
import { Avatar } from "@/components/quadros/CartaoProjetoDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { useInicioData, DemandaResumo } from "@/hooks/useInicioData";
import { useNovidades, useSemanaGabinete, type Novidade, type NumeroSemana } from "@/hooks/useInicioExtras";
import { usePessoasGabinete } from "@/hooks/useQuadros";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { formatPhoneDisplay, normalizePhoneNoDDI } from "@/lib/phoneUtils";
import { cn } from "@/lib/utils";

/**
 * Início — organizado pela pergunta de quem abre o app:
 *   1. O que tenho hoje?            → faixa "Hoje na agenda" (compromissos do dia)
 *   2. O que mudou para mim?        → Novidades para você
 *   3. O que é meu para fazer?      → Minha semana · Minhas demandas
 *   4. O que o gabinete precisa?    → Precisa de atenção (com revisão em lote)
 * Ao lado, o que se olha de relance: Aniversariantes · Meus quadros ·
 * A semana do gabinete (os blocos de tamanho variável em cima).
 * Demandas abrem aqui mesmo (modal), sem sair do Início.
 */

// ─── Peças ──────────────────────────────────────────────────────

function Bloco({
  titulo, icone: Icone, acao, children, className,
}: {
  titulo: string;
  icone: React.ComponentType<{ className?: string }>;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border shadow-suave", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="titulo-compacto text-base font-semibold flex items-start gap-2 min-w-0 leading-snug">
          <Icone className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <span>{titulo}</span>
        </CardTitle>
        {acao}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function Numero({
  valor, rotulo, tom = "neutro", para,
}: {
  valor: number | undefined;
  rotulo: string;
  tom?: "neutro" | "alerta" | "perigo";
  para?: string;
}) {
  const corValor = tom === "perigo" ? "text-destructive" : tom === "alerta" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  const conteudo = (
    <div className={cn("rounded-lg border bg-muted/30 px-3 py-2.5 h-full", para && "hover:bg-muted/60 transition-colors")}>
      <div className={cn("text-2xl font-bold tabular-nums leading-tight", corValor)}>{valor === undefined ? "–" : valor.toLocaleString("pt-BR")}</div>
      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{rotulo}</div>
    </div>
  );
  return para ? <Link to={para} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">{conteudo}</Link> : conteudo;
}

const Vazio = ({ texto }: { texto: string }) => <p className="text-sm text-muted-foreground py-3 text-center">{texto}</p>;
const Carregando = ({ linhas = 3 }: { linhas?: number }) => (
  <div className="space-y-2">{Array.from({ length: linhas }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
);

function prazoRelativo(prazo: string | null, hoje: string) {
  if (!prazo) return null;
  const dias = Math.round((new Date(prazo + "T12:00:00").getTime() - new Date(hoje + "T12:00:00").getTime()) / 86400000);
  if (dias < 0) return { texto: `atrasada ${-dias} dia${dias === -1 ? "" : "s"}`, tom: "perigo" as const };
  if (dias === 0) return { texto: "vence hoje", tom: "alerta" as const };
  if (dias === 1) return { texto: "vence amanhã", tom: "alerta" as const };
  return { texto: `vence em ${dias} dias`, tom: "neutro" as const };
}

function LinhaDemanda({ d, hoje, onAbrir }: { d: DemandaResumo; hoje: string; onAbrir: (id: string) => void }) {
  const prazo = prazoRelativo(d.data_prazo, hoje);
  return (
    <button type="button" onClick={() => onAbrir(d.id)}
      className="w-full text-left flex items-center gap-3 rounded-md px-2 py-2 -mx-2 hover:bg-muted/60 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{d.titulo}</p>
        <p className="text-xs text-muted-foreground truncate">#{d.protocolo}{d.municipes?.nome ? ` · ${d.municipes.nome}` : ""}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <StatusBadge status={d.status} size="sm" />
        {prazo && (
          <span className={cn("text-[11px]", prazo.tom === "perigo" ? "text-destructive" : prazo.tom === "alerta" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
            {prazo.texto}
          </span>
        )}
      </div>
    </button>
  );
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function linkWhatsApp(telefone: string | null, nome: string) {
  const digitos = normalizePhoneNoDDI(telefone);
  if (digitos.length < 10) return null;
  const texto = encodeURIComponent(`Olá, ${nome.split(" ")[0]}! Feliz aniversário! 🎉`);
  return `https://wa.me/55${digitos}?text=${texto}`;
}

function haQuanto(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const diaLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

// ─── Blocos ─────────────────────────────────────────────────────

const ICONE_NOVIDADE: Record<Novidade["tipo"], React.ComponentType<{ className?: string }>> = {
  mencao: AtSign, atividade: FileText, cartao: Columns3, comentario: MessageSquare, aviso: Sparkles,
};

function NovidadesParaVoce({ uid, cartoes, onAbrirDemanda }: { uid: string; cartoes: string[]; onAbrirDemanda: (id: string) => void }) {
  const navigate = useNavigate();
  const { porId } = usePessoasGabinete();
  const novidades = useNovidades(uid, cartoes);
  const [todas, setTodas] = useState(false);
  const itens = novidades.data ?? [];
  const mostrar = todas ? itens : itens.slice(0, 5);

  const abrir = (n: Novidade) => {
    novidades.marcarLida(n);
    if (!n.alvo) return;
    if (n.alvo.tipo === "demanda") onAbrirDemanda(n.alvo.id);
    else navigate(n.alvo.url);
  };

  // Sem novidades: uma linha discreta, para não ocupar o topo à toa
  if (!novidades.isLoading && !novidades.isError && itens.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>Nada novo para você. Menções, atividades nas suas demandas e mudanças nos seus cartões aparecem aqui.</span>
      </div>
    );
  }

  return (
    <Bloco
      titulo={itens.length > 0 ? `Novidades para você (${itens.length})` : "Novidades para você"}
      icone={Sparkles}
      acao={itens.length > 0 && (
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs shrink-0" onClick={() => novidades.marcarVisto()}>
          <Check className="h-3.5 w-3.5" /> Marcar como visto
        </Button>
      )}
    >
      {novidades.isError ? (
        <ErrorState what="as novidades" onRetry={() => novidades.refetch()} className="py-6" />
      ) : novidades.isLoading ? <Carregando linhas={2} /> : itens.length === 0 ? (
        <Vazio texto="Nada novo para você. Menções, atividades nas suas demandas e mudanças nos seus cartões aparecem aqui." />
      ) : (
        <>
          <ul className="divide-y">
            {mostrar.map((n) => {
              const Icone = ICONE_NOVIDADE[n.tipo];
              const autor = n.autorId ? porId.get(n.autorId)?.nome?.split(" ")[0] : null;
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => abrir(n)} disabled={!n.alvo}
                    className="w-full text-left flex items-start gap-3 rounded-md px-2 py-2.5 -mx-2 hover:bg-muted/60 transition-colors disabled:cursor-default">
                    <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                      n.tipo === "mencao" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <Icone className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug">
                        <span className="font-medium">{autor || "Alguém"}</span> {n.acao}
                        {n.onde && <> <span className="text-muted-foreground">em</span> <span className="font-medium">{n.onde}</span></>}
                      </span>
                      {n.detalhe && <span className="block text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.detalhe}</span>}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">{haQuanto(n.quando)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {itens.length > 5 && (
            <Button variant="ghost" size="sm" className="w-full mt-1 h-8 text-xs" onClick={() => setTodas((v) => !v)}>
              {todas ? "Mostrar menos" : `Ver mais ${itens.length - 5}`}
            </Button>
          )}
        </>
      )}
    </Bloco>
  );
}

function Variacao({ n }: { n: NumeroSemana }) {
  const dif = n.atual - n.anterior;
  if (n.anterior === 0 && n.atual === 0) return <span className="text-[11px] text-muted-foreground">igual</span>;
  const Ic = dif > 0 ? ArrowUpRight : dif < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground" title={`Semana passada, até este dia: ${n.anterior}`}>
      <Ic className="h-3 w-3" aria-hidden />{dif === 0 ? "igual" : `${dif > 0 ? "+" : ""}${dif.toLocaleString("pt-BR")}`}
    </span>
  );
}

function SemanaDoGabinete({ habilitado }: { habilitado: boolean }) {
  const { finalSlugs } = useDemandaStatus();
  const { porId } = usePessoasGabinete();
  const semana = useSemanaGabinete(finalSlugs, habilitado);
  const d = semana.data;
  const linhas: { rotulo: string; n?: NumeroSemana }[] = [
    { rotulo: "demandas novas", n: d?.novas },
    { rotulo: "concluídas", n: d?.concluidas },
    { rotulo: "atividades registradas", n: d?.atividades },
    { rotulo: "munícipes cadastrados", n: d?.municipes },
  ];
  return (
    <Bloco
      titulo="A semana do gabinete"
      icone={BarChart3}
      acao={<Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs shrink-0"><Link to="/analises">Análises <ChevronRight className="h-3.5 w-3.5" /></Link></Button>}
    >
      {semana.isError ? (
        <ErrorState what="a semana do gabinete" onRetry={() => semana.refetch()} className="py-6" />
      ) : semana.isLoading ? <Carregando linhas={2} /> : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {linhas.map((l) => (
              <div key={l.rotulo} className="rounded-lg border bg-muted/30 px-3 py-2">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xl font-bold tabular-nums">{(l.n?.atual ?? 0).toLocaleString("pt-BR")}</span>
                  {l.n && <Variacao n={l.n} />}
                </div>
                <div className="text-xs text-muted-foreground leading-snug">{l.rotulo}</div>
              </div>
            ))}
          </div>
          {d && d.destaque.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium mb-1.5">Quem mais concluiu</p>
              <ul className="space-y-1.5">
                {d.destaque.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <Avatar id={p.id} nome={porId.get(p.id)?.nome} size={22} />
                    <span className="flex-1 truncate">{porId.get(p.id)?.nome || "Pessoa"}</span>
                    <span className="tabular-nums text-muted-foreground">{p.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            Desde segunda, comparado com a semana passada até o mesmo dia. Concluídas = status final alterado na semana.
          </p>
        </>
      )}
    </Bloco>
  );
}

// ─── Tela ───────────────────────────────────────────────────────

export default function Inicio() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { uid, hoje, minhas, atencao, tarefas, projetos, agendas, aniversariantes } = useInicioData();
  const lixeira = useContagemLixeira();
  const [demandaAberta, setDemandaAberta] = useState<string | null>(null);
  const primeiroNome = (profile?.nome || "").split(" ")[0];
  const dataExtenso = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  // Compromissos de hoje ficam na faixa do topo; o resto da agenda, na Minha semana
  const agendaHoje = useMemo(() => (agendas.data ?? []).filter((a) => diaLocal(a.data_hora_proposta) === hoje), [agendas.data, hoje]);
  const agendasSemana = useMemo(() => ({ ...agendas, data: (agendas.data ?? []).filter((a) => diaLocal(a.data_hora_proposta) !== hoje) }), [agendas, hoje]);
  const cartoesComigo = useMemo(() => (tarefas.data ?? []).map((t) => t.id), [tarefas.data]);
  const paraHoje = (tarefas.data ?? []).filter((t) => t.data_prazo && t.data_prazo <= hoje).length;
  const saindoDaLixeira = (lixeira.data ?? []).filter((d) => Date.now() - new Date(d.excluida_em).getTime() > (DIAS_LIXEIRA - 3) * 86_400_000).length;

  const resumo = [
    paraHoje > 0 ? `${paraHoje} tarefa${paraHoje === 1 ? "" : "s"} para hoje` : null,
    agendaHoje.length > 0 ? `${agendaHoje.length} compromisso${agendaHoje.length === 1 ? "" : "s"}` : null,
    (minhas.data?.atrasadas ?? 0) > 0 ? `${minhas.data!.atrasadas} demanda${minhas.data!.atrasadas === 1 ? "" : "s"} sua${minhas.data!.atrasadas === 1 ? "" : "s"} atrasada${minhas.data!.atrasadas === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  const lote = atencao.data ? [
    { rotulo: "Sem responsável", n: atencao.data.semResponsavel, url: "/demandas?situacao=sem-responsavel&lote=1" },
    { rotulo: "Prazo vencido", n: atencao.data.atrasadas, url: "/demandas?atraso=overdue&lote=1" },
    { rotulo: `Paradas há ${atencao.data.diasParada}+ dias`, n: atencao.data.paradas, url: "/demandas?situacao=parada-30&ordem=sem_alteracao&lote=1" },
  ].filter((x) => x.n > 0) : [];

  return (
    <div className="px-0 md:container md:mx-auto md:px-4 max-w-[1400px] space-y-4 md:space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="capitalize-first">{dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1)}</span>
            {resumo.length > 0 && <> · <span className="text-foreground">{resumo.join(" · ")}</span></>}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => navigate("/municipes")} className="gap-2"><UserPlus className="h-4 w-4" /> Munícipes</Button>
          <NovaDemandaDialog />
        </div>
      </div>

      {/* Hoje na agenda: compromissos do dia em destaque */}
      {agendaHoje.length > 0 && (
        <section aria-label="Compromissos de hoje" className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 md:p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="titulo-compacto text-sm font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Hoje na agenda</h2>
            <Link to="/solicitar-agenda" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">Agenda <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {agendaHoje.map((a) => (
              <li key={a.id}>
                <Link to="/solicitar-agenda" className="flex gap-3 rounded-lg border bg-card px-3 py-2 hover:border-primary/50 transition-colors">
                  <span className="text-lg font-bold tabular-nums text-primary leading-tight">{hora(a.data_hora_proposta)}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{a.titulo || a.descricao_objetivo || "Compromisso"}</span>
                    {a.local_endereco && <span className="flex items-center gap-1 text-xs text-muted-foreground truncate"><MapPin className="h-3 w-3 shrink-0" />{a.local_endereco}</span>}
                    {a.status === "pendente" && <span className="text-[11px] text-amber-600 dark:text-amber-400">aguardando confirmação</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* ── Onde se trabalha: o que é meu e o que o gabinete precisa ── */}
        <div className="lg:col-span-2 space-y-4 md:space-y-5 min-w-0">
          {uid && <NovidadesParaVoce uid={uid} cartoes={cartoesComigo} onAbrirDemanda={setDemandaAberta} />}

          {uid && <MinhaSemana uid={uid} nome={profile?.nome} hoje={hoje} tarefas={tarefas} agendas={agendasSemana} />}

          <Bloco
            titulo="Minhas demandas"
            icone={FileText}
            acao={uid && (
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs shrink-0" onClick={() => navigate(`/demandas?responsavel=${uid}`)}>
                Ver todas <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          >
            {minhas.isError ? (
              <ErrorState what="suas demandas" onRetry={() => minhas.refetch()} className="py-6" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 md:gap-3 mb-3">
                  <Numero valor={minhas.data?.abertas} rotulo="abertas comigo" para={uid ? `/demandas?responsavel=${uid}` : undefined} />
                  <Numero valor={minhas.data?.vencendoSemana} rotulo="vencem em 7 dias" tom={minhas.data?.vencendoSemana ? "alerta" : "neutro"} />
                  <Numero valor={minhas.data?.atrasadas} rotulo="atrasadas" tom={minhas.data?.atrasadas ? "perigo" : "neutro"} para={uid ? `/demandas?responsavel=${uid}&atraso=overdue` : undefined} />
                </div>
                {minhas.isLoading ? <Carregando /> : (minhas.data?.proximas.length ?? 0) === 0 ? (
                  <Vazio texto="Nenhuma demanda sua com prazo atrasado ou para esta semana." />
                ) : (
                  <div className="divide-y">
                    {minhas.data!.proximas.map((d) => <LinhaDemanda key={d.id} d={d} hoje={hoje} onAbrir={setDemandaAberta} />)}
                  </div>
                )}
              </>
            )}
          </Bloco>

          <Bloco titulo="Precisa de atenção no gabinete" icone={AlertTriangle}>
            {atencao.isError ? (
              <ErrorState what="os alertas do gabinete" onRetry={() => atencao.refetch()} className="py-6" />
            ) : (
              <>
                {atencao.data && (
                  <p className="text-xs text-muted-foreground -mt-1 mb-2">Entre as {atencao.data.abertas.toLocaleString("pt-BR")} demandas abertas. Toque num número para ver a lista.</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  <Numero valor={atencao.data?.semResponsavel} rotulo="sem responsável" tom={atencao.data?.semResponsavel ? "alerta" : "neutro"} para="/demandas?situacao=sem-responsavel" />
                  <Numero valor={atencao.data?.atrasadas} rotulo="com prazo vencido" tom={atencao.data?.atrasadas ? "perigo" : "neutro"} para="/demandas?atraso=overdue" />
                  <Numero valor={atencao.data?.vencendo3dias} rotulo="vencem em 3 dias" para="/demandas?situacao=vence-3" />
                  <Numero valor={atencao.data?.paradas} rotulo={`sem alteração há ${atencao.data?.diasParada ?? 30}+ dias`} tom={atencao.data?.paradas ? "alerta" : "neutro"} para="/demandas?situacao=parada-30&ordem=sem_alteracao" />
                </div>

                {((atencao.data?.paradas ?? 0) > 0 || lote.length > 0) && (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Há quanto tempo estão paradas */}
                    {(atencao.data?.paradas ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1.5">Há quanto tempo estão sem alteração</p>
                        <div className="space-y-0.5">
                          {atencao.data!.faixas.map((f) => {
                            const max = Math.max(...atencao.data!.faixas.map((x) => x.valor), 1);
                            return (
                              <Link key={f.situacao} to={`/demandas?situacao=${f.situacao}`}
                                className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/60 transition-colors"
                                aria-label={`${f.valor} demandas sem alteração há ${f.rotulo}`}>
                                <span className="text-xs text-muted-foreground">{f.rotulo}</span>
                                <span className="h-2 rounded-full bg-muted overflow-hidden">
                                  <span className="block h-full rounded-full" style={{ width: `${(f.valor / max) * 100}%`, minWidth: f.valor ? 4 : 0, background: "var(--viz-seq)" }} />
                                </span>
                                <span className="text-xs font-semibold tabular-nums w-10 text-right">{f.valor.toLocaleString("pt-BR")}</span>
                              </Link>
                            );
                          })}
                        </div>
                        {atencao.data!.abertas > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            {Math.round((atencao.data!.paradas / atencao.data!.abertas) * 100)}% das abertas sem nenhuma alteração no último mês: concluir as resolvidas ou atualizar o andamento.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Revisar em lote: abre a lista já selecionada, com a barra de ações */}
                    {lote.length > 0 && (
                      <div className="rounded-lg border border-dashed p-3">
                        <p className="text-xs font-medium flex items-center gap-1.5 mb-2"><Layers className="h-3.5 w-3.5 text-muted-foreground" /> Revisar em lote</p>
                        <div className="flex flex-wrap gap-1.5">
                          {lote.map((x) => (
                            <Button key={x.url} asChild size="sm" variant="outline" className="h-8 text-xs gap-1">
                              <Link to={x.url}>{x.rotulo} <span className="tabular-nums text-muted-foreground">{x.n.toLocaleString("pt-BR")}</span></Link>
                            </Button>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">Abre a lista já selecionada: mude status, responsável ou área, ou mande para um quadro, tudo de uma vez.</p>
                      </div>
                    )}
                  </div>
                )}

                {saindoDaLixeira > 0 && (
                  <Link to="/demandas?lixeira=1" className="mt-3 flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs hover:bg-muted transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1">{saindoDaLixeira} demanda{saindoDaLixeira === 1 ? " sai" : "s saem"} da lixeira de vez em até 3 dias</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                )}
              </>
            )}
          </Bloco>
        </div>

        {/* ── Para olhar de relance ── */}
        <div className="space-y-4 md:space-y-5 min-w-0">
          {/* Aniversariantes: sem ninguém no dia, uma linha discreta (o bloco não fica vazio) */}
          {aniversariantes.isError ? (
            <Bloco titulo="Aniversariantes de hoje" icone={Cake}>
              <ErrorState what="os aniversariantes" onRetry={() => aniversariantes.refetch()} className="py-6" />
            </Bloco>
          ) : !aniversariantes.isLoading && (aniversariantes.data?.length ?? 0) === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-sm text-muted-foreground">
              <Cake className="h-4 w-4 shrink-0" /> Nenhum aniversariante hoje.
            </div>
          ) : (
            <Bloco titulo={`Aniversariantes de hoje${aniversariantes.data?.length ? ` (${aniversariantes.data.length})` : ""}`} icone={Cake}>
              {aniversariantes.isLoading ? <Carregando linhas={2} /> : (
                <>
                  <div className="divide-y max-h-[320px] overflow-y-auto -mx-2 px-2">
                    {aniversariantes.data!.map((m: any) => {
                      const wa = linkWhatsApp(m.telefone, m.nome);
                      return (
                        <div key={m.id} className="flex items-center gap-2 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug line-clamp-2">{m.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[formatPhoneDisplay(m.telefone), m.bairro].filter(Boolean).join(" · ") || "Sem telefone"}
                            </p>
                          </div>
                          {wa && (
                            <Button asChild size="icon" variant="outline" className="h-8 w-8 shrink-0 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950">
                              <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`Parabenizar ${m.nome} pelo WhatsApp`} title="Parabenizar pelo WhatsApp">
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">O botão abre o WhatsApp com a mensagem de parabéns pronta; nada é enviado sozinho.</p>
                </>
              )}
            </Bloco>
          )}

          {(projetos.data?.length ?? 0) > 0 && (
            <Bloco
              titulo="Meus quadros"
              icone={FolderKanban}
              acao={<Button variant="ghost" size="sm" className="h-8 gap-1 text-xs shrink-0" onClick={() => navigate("/quadros")}>Todos <ChevronRight className="h-3.5 w-3.5" /></Button>}
            >
              <div className="divide-y">
                {projetos.data!.map((p) => (
                  <Link key={p.id} to={`/quadros/${p.id}`} className="flex items-center gap-3 rounded-md px-2 py-2 -mx-2 hover:bg-muted/60 transition-colors">
                    <span className="h-7 w-7 rounded-md grid place-items-center text-sm shrink-0" style={{ background: `${p.cor || "#64748b"}22` }} aria-hidden>{p.icone || "📋"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.nome}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.abertos} em aberto{p.comigo > 0 ? ` · ${p.comigo} com você` : ""}</p>
                    </div>
                    {p.atrasados > 0 && (
                      <span className="text-[11px] text-destructive shrink-0 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" aria-hidden /> {p.atrasados}</span>
                    )}
                  </Link>
                ))}
              </div>
            </Bloco>
          )}

          <SemanaDoGabinete habilitado={!!uid} />
        </div>
      </div>

      {/* Demanda aberta aqui mesmo (ver, editar, registrar atividade) */}
      <DemandaRapida demandaId={demandaAberta} onClose={() => setDemandaAberta(null)} />
    </div>
  );
}
