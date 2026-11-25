import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Google Agenda no Jorgeus: tudo passa pela função do servidor
 * "google-agenda" (o token do Google nunca chega ao navegador).
 *   - mandato: agenda do vereador (toda a equipe vê; editores mexem)
 *   - pessoal: a conta Google de cada pessoa (só o dono)
 */

export type OrigemAgenda = "mandato" | "pessoal";
export type RespostaConvite = "accepted" | "declined" | "tentative" | "needsAction";

export interface CalendarioGoogle { id: string; nome: string; cor: string; papel: string; principal?: boolean; escolhida?: boolean; corPersonalizada?: boolean }

export interface EventoGoogle {
  id: string;
  calendarId: string;
  calendario: string;
  origem: OrigemAgenda;
  cor: string;
  titulo: string;
  descricao: string;
  local: string;
  diaInteiro: boolean;
  inicio: string;
  fim: string;
  link: string;
  meet: string | null;
  recorrente: boolean;
  organizador: string | null;
  souOrganizador: boolean;
  convidados: { email: string; nome: string | null; resposta: RespostaConvite; organizador: boolean; eu: boolean }[];
  minhaResposta: RespostaConvite | null;
  podeEditar: boolean;
  podeExcluir: boolean;
  criadoNoJorgeusPor: string | null;
  editadoNoJorgeusPor: string | null;
  /** Só editores veem os detalhes; para os outros vem como "Ocupado" (oculto = true) */
  reservado: boolean;
  oculto: boolean;
  /** Marcado como "disponível" no Google: não ocupa o horário */
  livre: boolean;
  vinculos: { demandaId?: string | null; municipeId?: string | null; pedidoId?: string | null };
}

export interface StatusGoogle {
  configurado: boolean;
  souEditorMandato: boolean;
  mandato: null | { email: string | null; calendarios: CalendarioGoogle[]; conectadoPor: string | null; conectadoEm: string };
  pessoal: null | { email: string | null; calendarios: CalendarioGoogle[]; conectadoEm: string };
}

export interface EventoForm {
  titulo: string;
  descricao?: string;
  local?: string;
  diaInteiro: boolean;
  /** ISO (com hora) ou YYYY-MM-DD (dia inteiro; fim exclusivo, como no Google) */
  inicio: string;
  fim: string;
  convidados?: { email: string; resposta?: RespostaConvite }[];
  /** Agenda do mandato: os outros veem só "Ocupado" */
  reservado?: boolean;
  vinculos?: { demandaId?: string | null; municipeId?: string | null; pedidoId?: string | null };
}

export class ErroAgenda extends Error {
  constructor(message: string, public codigo?: string) { super(message); }
}

export async function chamarAgenda<T = any>(acao: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("google-agenda", { body: { acao, ...extra } });
  if (error) {
    let msg = error.message, codigo: string | undefined;
    try { const corpo = await (error as any)?.context?.json(); msg = corpo?.error || msg; codigo = corpo?.codigo; } catch { /* sem corpo */ }
    throw new ErroAgenda(msg, codigo);
  }
  if (data?.success === false) throw new ErroAgenda(data.error || "Não foi possível concluir", data.codigo);
  return data as T;
}

// Cache no navegador (por pessoa): a tela abre já com o que se viu da última
// vez e atualiza em segundo plano. Nunca guarda o token, só o que já aparece na tela.
function lerCache<T>(chave: string | null): T | undefined {
  if (!chave) return undefined;
  try { const v = localStorage.getItem(chave); return v ? (JSON.parse(v) as T) : undefined; } catch { return undefined; }
}
function gravarCache(chave: string | null, valor: unknown) {
  if (!chave) return;
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem storage */ }
}

export function useStatusGoogle(habilitado = true) {
  const { user } = useAuth();
  const chave = user?.id ? `jorgeus-google-status:${user.id}` : null;
  const q = useQuery({
    queryKey: ["google-agenda-status"],
    enabled: habilitado,
    queryFn: () => chamarAgenda<StatusGoogle>("status"),
    placeholderData: () => lerCache<StatusGoogle>(chave),
    staleTime: 5 * 60_000,
    retry: false,
  });
  useEffect(() => { if (q.data && !q.isPlaceholderData) gravarCache(chave, q.data); }, [q.data, q.isPlaceholderData, chave]);
  return q;
}

type RespostaEventos = { eventos: EventoGoogle[]; avisos: { origem: OrigemAgenda; codigo?: string; mensagem: string }[] };

/**
 * Eventos das duas agendas no período (só busca se houver algo conectado).
 * `guardarComo`: guarda o resultado no navegador para mostrar na hora da
 * próxima vez (usado no Início).
 */
export function useEventosGoogle(de: Date, ate: Date, habilitado = true, guardarComo?: string) {
  const { user } = useAuth();
  const status = useStatusGoogle(habilitado);
  const algumConectado = !!(status.data?.mandato?.calendarios?.length || status.data?.pessoal?.calendarios?.length);
  const chave = guardarComo && user?.id ? `jorgeus-agenda:${guardarComo}:${user.id}` : null;
  const q = useQuery({
    queryKey: ["google-agenda-eventos", de.toISOString(), ate.toISOString()],
    enabled: habilitado && algumConectado,
    queryFn: () => chamarAgenda<RespostaEventos>("eventos", { de: de.toISOString(), ate: ate.toISOString() }),
    placeholderData: () => {
      const c = lerCache<{ de: string; dados: RespostaEventos }>(chave);
      return c && c.de === de.toISOString() ? c.dados : undefined;
    },
    staleTime: 60_000,
    retry: 1,
  });
  useEffect(() => {
    if (q.data && !q.isPlaceholderData) gravarCache(chave, { de: de.toISOString(), dados: q.data });
  }, [q.data, q.isPlaceholderData, chave]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Ainda buscando no Google (mesmo que já mostre o que estava guardado) */
  const buscando = algumConectado && (q.isFetching || q.isPlaceholderData || (q.isLoading && !q.data));
  return { ...q, status, algumConectado, buscando };
}

/** Busca na agenda: de um ano atrás até um ano à frente (o Google procura). */
export function useBuscaAgenda(termo: string) {
  const status = useStatusGoogle();
  const algumConectado = !!(status.data?.mandato?.calendarios?.length || status.data?.pessoal?.calendarios?.length);
  const t = termo.trim();
  return useQuery({
    queryKey: ["google-agenda-busca", t],
    enabled: algumConectado && t.length >= 2,
    queryFn: () => {
      const hoje = inicioDoDia(new Date());
      return chamarAgenda<RespostaEventos>("eventos", { de: somarDias(hoje, -365).toISOString(), ate: somarDias(hoje, 366).toISOString(), busca: t });
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAcoesGoogle() {
  const qc = useQueryClient();
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["google-agenda-eventos"] });
    qc.invalidateQueries({ queryKey: ["google-agenda-busca"] });
  };
  const erro = (e: any) => toast.error(e?.message || "Não foi possível concluir");

  const criar = useMutation({
    mutationFn: (v: { origem: OrigemAgenda; calendarId: string; evento: EventoForm }) => chamarAgenda("criar", v),
    onSuccess: () => { toast.success("Evento criado no Google Agenda"); recarregar(); },
    onError: erro,
  });
  const editar = useMutation({
    mutationFn: (v: { origem: OrigemAgenda; calendarId: string; eventId: string; evento: EventoForm }) => chamarAgenda("editar", v),
    onSuccess: () => { toast.success("Evento atualizado"); recarregar(); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (v: { origem: OrigemAgenda; calendarId: string; eventId: string }) => chamarAgenda("excluir", v),
    onSuccess: () => { toast.success("Evento excluído"); recarregar(); },
    onError: erro,
  });
  const responder = useMutation({
    mutationFn: (v: { calendarId: string; eventId: string; resposta: Exclude<RespostaConvite, "needsAction"> }) => chamarAgenda("responder", v),
    onSuccess: (_d, v) => {
      toast.success(v.resposta === "accepted" ? "Presença confirmada" : v.resposta === "declined" ? "Convite recusado" : "Respondido: talvez");
      recarregar();
    },
    onError: erro,
  });
  const conectar = useMutation({
    mutationFn: async (tipo: OrigemAgenda) => {
      const { url } = await chamarAgenda<{ url: string }>("conectar", { tipo, voltarPara: `${window.location.origin}/agenda` });
      window.location.href = url;
    },
    onError: erro,
  });
  const desconectar = useMutation({
    mutationFn: (tipo: OrigemAgenda) => chamarAgenda("desconectar", { tipo }),
    onSuccess: () => {
      toast.success("Agenda desconectada");
      qc.invalidateQueries({ queryKey: ["google-agenda-status"] });
      recarregar();
    },
    onError: erro,
  });
  const escolher = useMutation({
    mutationFn: (v: { tipo: OrigemAgenda; ids: string[]; cores?: Record<string, string> }) => chamarAgenda("escolher", v),
    onSuccess: () => {
      toast.success("Agendas atualizadas");
      qc.invalidateQueries({ queryKey: ["google-agenda-status"] });
      recarregar();
    },
    onError: erro,
  });
  return { criar, editar, excluir, responder, conectar, desconectar, escolher };
}

// ── Datas ───────────────────────────────────────────────────────

export const ROTULO_ORIGEM: Record<OrigemAgenda, string> = { mandato: "Agenda do mandato", pessoal: "Minha agenda" };
export const ROTULO_RESPOSTA: Record<RespostaConvite, string> = {
  accepted: "vai", declined: "não vai", tentative: "talvez", needsAction: "sem resposta",
};

export function diaISO(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function somarDias(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function inicioDoDia(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function inicioDaSemana(d: Date) { const x = inicioDoDia(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

/** O evento acontece (ao menos em parte) neste dia? */
export function eventoNoDia(e: EventoGoogle, dia: Date) {
  const ini = inicioDoDia(dia), fim = somarDias(ini, 1);
  if (e.diaInteiro) {
    const d = diaISO(dia);
    return e.inicio.slice(0, 10) <= d && d < e.fim.slice(0, 10);
  }
  return new Date(e.inicio) < fim && new Date(e.fim) > ini;
}

export const horaCurta = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// ── Pedidos de agenda (agenda do mandato) ───────────────────────

export type StatusPedido = "pendente" | "aprovado" | "recusado" | "contraproposta" | "cancelado";
export interface PedidoAgenda {
  id: string;
  solicitante_id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  opcoes: { inicio: string; fim: string }[];
  status: StatusPedido;
  escolhida: { inicio: string; fim: string } | null;
  contraproposta: { inicio: string; fim: string; mensagem: string | null } | null;
  motivo: string | null;
  decidido_por: string | null;
  decidido_em: string | null;
  reservado: boolean;
  demanda_id: string | null;
  municipe_id: string | null;
  created_at: string;
}

/** Pedidos que a pessoa pode ver: os seus e, para editores, todos do gabinete. */
export function usePedidosAgenda(habilitado = true) {
  return useQuery({
    queryKey: ["pedidos-agenda"],
    enabled: habilitado,
    queryFn: async () => {
      const desde = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const { data, error } = await (supabase.from("pedidos_agenda") as any)
        .select("*").or(`status.in.(pendente,contraproposta),created_at.gte.${desde}`)
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as PedidoAgenda[];
    },
    staleTime: 30_000,
  });
}

export function useAcoesPedidos() {
  const qc = useQueryClient();
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["pedidos-agenda"] });
    qc.invalidateQueries({ queryKey: ["google-agenda-eventos"] });
  };
  const erro = (e: any) => toast.error(e?.message || "Não foi possível concluir");
  const criar = useMutation({
    mutationFn: (v: { titulo: string; descricao?: string; local?: string; opcoes: { inicio: string; fim: string }[]; demandaId?: string | null; municipeId?: string | null }) =>
      chamarAgenda<{ id: string }>("pedido-criar", v),
    onSuccess: () => { toast.success("Pedido enviado", { description: "Quem edita a agenda do mandato foi avisado." }); recarregar(); },
    onError: erro,
  });
  const decidir = useMutation({
    mutationFn: (v: { pedidoId: string; decisao: "aprovar" | "recusar" | "contrapropor"; opcao?: { inicio: string; fim: string }; motivo?: string; mensagem?: string; reservado?: boolean; calendarId?: string }) =>
      chamarAgenda("pedido-decidir", v),
    onSuccess: (_d, v) => {
      toast.success(v.decisao === "aprovar" ? "Aprovado: já está na agenda do mandato" : v.decisao === "recusar" ? "Pedido recusado" : "Outro horário proposto");
      recarregar();
    },
    onError: erro,
  });
  const responder = useMutation({
    mutationFn: (v: { pedidoId: string; aceitar: boolean }) => chamarAgenda("pedido-responder", v),
    onSuccess: (_d, v) => { toast.success(v.aceitar ? "Combinado: entrou na agenda do mandato" : "Pedido cancelado"); recarregar(); },
    onError: erro,
  });
  const cancelar = useMutation({
    mutationFn: (pedidoId: string) => chamarAgenda("pedido-cancelar", { pedidoId }),
    onSuccess: () => { toast.success("Pedido cancelado"); recarregar(); },
    onError: erro,
  });
  return { criar, decidir, responder, cancelar };
}

/** Eventos ligados a uma demanda ou munícipe (para mostrar dentro deles). */
export function useEventosVinculados(alvo: { demandaId?: string | null; municipeId?: string | null }, habilitado = true) {
  const status = useStatusGoogle(habilitado);
  const conectado = !!(status.data?.mandato || status.data?.pessoal);
  return useQuery({
    queryKey: ["google-agenda-vinculados", alvo.demandaId ?? null, alvo.municipeId ?? null],
    enabled: habilitado && conectado && !!(alvo.demandaId || alvo.municipeId),
    queryFn: () => chamarAgenda<{ eventos: EventoGoogle[] }>("vinculados", { demandaId: alvo.demandaId, municipeId: alvo.municipeId }),
    staleTime: 60_000,
    retry: false,
  });
}
