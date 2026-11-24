import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, CalendarClock, CalendarDays, Cake, CheckSquare, ChevronRight,
  Clock, FileText, Inbox, MessageCircle, UserPlus, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useInicioData, DemandaResumo } from "@/hooks/useInicioData";
import { formatDateOnly, formatDateTime } from "@/lib/dateUtils";
import { formatPhoneDisplay, normalizePhoneNoDDI } from "@/lib/phoneUtils";
import { cn } from "@/lib/utils";

// ─── Peças pequenas ─────────────────────────────────────────────

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
    <Card className={cn("border shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icone className="h-4 w-4 text-muted-foreground" />
          {titulo}
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
      <div className={cn("text-2xl font-bold tabular-nums leading-tight", corValor)}>{valor ?? "–"}</div>
      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{rotulo}</div>
    </div>
  );
  return para ? <Link to={para} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">{conteudo}</Link> : conteudo;
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-muted-foreground py-3 text-center">{texto}</p>;
}

function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: linhas }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

function prazoRelativo(prazo: string | null, hoje: string) {
  if (!prazo) return null;
  const dias = Math.round((new Date(prazo + "T12:00:00").getTime() - new Date(hoje + "T12:00:00").getTime()) / 86400000);
  if (dias < 0) return { texto: `atrasada ${-dias} dia${dias === -1 ? "" : "s"}`, tom: "perigo" as const };
  if (dias === 0) return { texto: "vence hoje", tom: "alerta" as const };
  if (dias === 1) return { texto: "vence amanhã", tom: "alerta" as const };
  return { texto: `vence em ${dias} dias`, tom: "neutro" as const };
}

function LinhaDemanda({ d, hoje, extra }: { d: DemandaResumo; hoje: string; extra?: string }) {
  const prazo = prazoRelativo(d.data_prazo, hoje);
  return (
    <Link
      to={`/demandas?id=${d.id}`}
      className="flex items-center gap-3 rounded-md px-2 py-2 -mx-2 hover:bg-muted/60 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{d.titulo}</p>
        <p className="text-xs text-muted-foreground truncate">
          #{d.protocolo}{d.municipes?.nome ? ` · ${d.municipes.nome}` : ""}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <StatusBadge status={d.status} size="sm" />
        {prazo && (
          <span className={cn("text-[11px]",
            prazo.tom === "perigo" ? "text-destructive" : prazo.tom === "alerta" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
            {prazo.texto}
          </span>
        )}
        {extra && <span className="text-[11px] text-muted-foreground">{extra}</span>}
      </div>
    </Link>
  );
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function linkWhatsApp(telefone: string | null, nome: string) {
  const digitos = normalizePhoneNoDDI(telefone);
  if (digitos.length < 10) return null;
  const primeiroNome = nome.split(" ")[0];
  const texto = encodeURIComponent(`Olá, ${primeiroNome}! Feliz aniversário! 🎉`);
  return `https://wa.me/55${digitos}?text=${texto}`;
}

// ─── Tela ───────────────────────────────────────────────────────

export default function Inicio() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { uid, hoje, minhas, atencao, tarefas, agendas, aniversariantes, hojeNoGabinete } = useInicioData();
  const primeiroNome = (profile?.nome || "").split(" ")[0];
  const dataExtenso = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="px-0 md:container md:mx-auto md:px-4 max-w-[1400px] space-y-4 md:space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            {saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">{dataExtenso}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/municipes")} className="gap-2">
            <UserPlus className="h-4 w-4" /> Munícipes
          </Button>
          <NovaDemandaDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-4 md:space-y-5">
          {/* Minhas demandas */}
          <Bloco
            titulo="Minhas demandas"
            icone={FileText}
            acao={uid && (
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => navigate(`/demandas?responsavel=${uid}`)}>
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
                    {minhas.data!.proximas.map((d) => <LinhaDemanda key={d.id} d={d} hoje={hoje} />)}
                  </div>
                )}
              </>
            )}
          </Bloco>

          {/* Precisa de atenção */}
          <Bloco titulo="Precisa de atenção no gabinete" icone={AlertTriangle}>
            {atencao.isError ? (
              <ErrorState what="os alertas do gabinete" onRetry={() => atencao.refetch()} className="py-6" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 md:gap-3 mb-3">
                  <Numero valor={atencao.data?.semResponsavel} rotulo="sem responsável" tom={atencao.data?.semResponsavel ? "alerta" : "neutro"} />
                  <Numero valor={atencao.data?.paradas} rotulo={`paradas há ${atencao.data?.diasParada ?? 30}+ dias`} tom={atencao.data?.paradas ? "alerta" : "neutro"} />
                  <Numero valor={atencao.data?.vencendo3dias} rotulo="vencem em 3 dias" />
                </div>
                {atencao.isLoading ? <Carregando /> : (atencao.data?.maisParadas.length ?? 0) === 0 ? (
                  <Vazio texto="Nenhuma demanda aberta parada há mais de 30 dias." />
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-1">Paradas há mais tempo (sem nenhuma alteração):</p>
                    <div className="divide-y">
                      {atencao.data!.maisParadas.map((d) => (
                        <LinhaDemanda
                          key={d.id} d={d} hoje={hoje}
                          extra={d.updated_at ? `sem mudança desde ${formatDateOnly(d.updated_at)}` : undefined}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </Bloco>

          {/* Hoje no gabinete */}
          <Bloco titulo="Hoje no gabinete" icone={Activity}>
            {hojeNoGabinete.isError ? (
              <ErrorState what="as atividades de hoje" onRetry={() => hojeNoGabinete.refetch()} className="py-6" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 md:gap-3 mb-3">
                  <Numero valor={hojeNoGabinete.data?.demandasNovas} rotulo="demandas novas" />
                  <Numero valor={hojeNoGabinete.data?.atividades} rotulo="atividades registradas" />
                  <Numero valor={hojeNoGabinete.data?.municipesNovos} rotulo="munícipes cadastrados" />
                </div>
                {hojeNoGabinete.isLoading ? <Carregando /> : (hojeNoGabinete.data?.ultimas.length ?? 0) === 0 ? (
                  <Vazio texto="Nenhuma atividade registrada hoje ainda." />
                ) : (
                  <div className="divide-y">
                    {hojeNoGabinete.data!.ultimas.map((a: any) => (
                      <Link
                        key={a.id}
                        to={`/demandas?id=${a.demanda_id}&atividade=${a.id}`}
                        className="flex items-start gap-3 rounded-md px-2 py-2 -mx-2 hover:bg-muted/60 transition-colors"
                      >
                        <Clock className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">
                            <span className="font-medium">{a.autor?.nome?.split(" ")[0] || "Alguém"}</span>{" "}
                            <span className="text-muted-foreground">em</span>{" "}
                            #{a.demandas?.protocolo} — {a.titulo || a.tipo_atividade}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{a.demandas?.titulo}</p>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </Bloco>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4 md:space-y-5">
          {/* Aniversariantes */}
          <Bloco titulo="Aniversariantes de hoje" icone={Cake}>
            {aniversariantes.isError ? (
              <ErrorState what="os aniversariantes" onRetry={() => aniversariantes.refetch()} className="py-6" />
            ) : aniversariantes.isLoading ? <Carregando linhas={2} /> : (aniversariantes.data?.length ?? 0) === 0 ? (
              <Vazio texto="Nenhum aniversariante hoje." />
            ) : (
              <div className="divide-y max-h-[320px] overflow-y-auto -mx-2 px-2">
                {aniversariantes.data!.map((m: any) => {
                  const wa = linkWhatsApp(m.telefone, m.nome);
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[formatPhoneDisplay(m.telefone), m.bairro].filter(Boolean).join(" · ") || "Sem telefone"}
                        </p>
                      </div>
                      {wa ? (
                        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 shrink-0 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950">
                          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`Parabenizar ${m.nome} pelo WhatsApp`}>
                            <MessageCircle className="h-3.5 w-3.5" /> Parabenizar
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            {(aniversariantes.data?.length ?? 0) > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                O botão abre o WhatsApp do seu aparelho com a mensagem pronta; nada é enviado automaticamente.
              </p>
            )}
          </Bloco>

          {/* Minhas tarefas */}
          <Bloco
            titulo="Minhas tarefas"
            icone={CheckSquare}
            acao={<Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => navigate("/kanban")}>Kanban <ChevronRight className="h-3.5 w-3.5" /></Button>}
          >
            {tarefas.isError ? (
              <ErrorState what="suas tarefas" onRetry={() => tarefas.refetch()} className="py-6" />
            ) : tarefas.isLoading ? <Carregando linhas={2} /> : (tarefas.data?.length ?? 0) === 0 ? (
              <Vazio texto="Nenhuma tarefa aberta com você." />
            ) : (
              <div className="divide-y">
                {tarefas.data!.map((t: any) => {
                  const prazo = prazoRelativo(t.data_prazo, hoje);
                  return (
                    <Link key={t.id} to={`/kanban?tarefa=${t.id}`} className="flex items-center gap-3 rounded-md px-2 py-2 -mx-2 hover:bg-muted/60 transition-colors">
                      <p className="text-sm min-w-0 flex-1 truncate">{t.titulo}</p>
                      {prazo ? (
                        <span className={cn("text-[11px] shrink-0",
                          prazo.tom === "perigo" ? "text-destructive" : prazo.tom === "alerta" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                          {prazo.texto}
                        </span>
                      ) : <span className="text-[11px] text-muted-foreground shrink-0">sem prazo</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </Bloco>

          {/* Minhas agendas */}
          <Bloco
            titulo="Minhas próximas agendas"
            icone={CalendarDays}
            acao={<Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => navigate("/solicitar-agenda")}>Agenda <ChevronRight className="h-3.5 w-3.5" /></Button>}
          >
            {agendas.isError ? (
              <ErrorState what="suas agendas" onRetry={() => agendas.refetch()} className="py-6" />
            ) : agendas.isLoading ? <Carregando linhas={2} /> : (agendas.data?.length ?? 0) === 0 ? (
              <Vazio texto="Nenhuma agenda futura em que você esteja." />
            ) : (
              <div className="divide-y">
                {agendas.data!.map((a: any) => (
                  <Link key={a.id} to="/solicitar-agenda" className="flex items-start gap-3 rounded-md px-2 py-2 -mx-2 hover:bg-muted/60 transition-colors">
                    <CalendarClock className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.titulo || a.descricao_objetivo || "Agenda"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDateTime(a.data_hora_proposta)}{a.local_endereco ? ` · ${a.local_endereco}` : ""}
                      </p>
                    </div>
                    <span className={cn("text-[11px] shrink-0 rounded px-1.5 py-0.5",
                      a.status === "confirmado" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300")}>
                      {a.status === "confirmado" ? "confirmada" : "pendente"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Bloco>
        </div>
      </div>

      {/* Dica discreta de onde foi a visão antiga */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Inbox className="h-3.5 w-3.5" />
        Os gráficos e números gerais do gabinete estão em{" "}
        <Link to="/visao-geral" className="underline underline-offset-2 hover:text-foreground">Análises › Visão geral</Link>.
      </p>
    </div>
  );
}
