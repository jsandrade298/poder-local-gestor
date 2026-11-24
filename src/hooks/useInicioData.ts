import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { fetchAll } from "@/lib/fetchAll";

/**
 * Dados da tela Início: "o que é meu e o que precisa de atenção".
 * Cada bloco é uma consulta separada, para um bloco lento ou com erro
 * não travar os outros.
 */

const DIAS_PARADA = 30;

function hojeISO() {
  // Data local (America/Sao_Paulo no navegador do gabinete), formato YYYY-MM-DD
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function somarDias(iso: string, dias: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export interface DemandaResumo {
  id: string;
  protocolo: string;
  titulo: string;
  status: string;
  data_prazo: string | null;
  updated_at?: string;
  municipes?: { nome: string } | null;
}

export function useInicioData() {
  const { user } = useAuth();
  const uid = user?.id;
  const { finalSlugs, statusList } = useDemandaStatus();
  const hoje = hojeISO();
  const emSete = somarDias(hoje, 7);
  const filtroAbertas = finalSlugs.length > 0 ? `(${finalSlugs.join(",")})` : "(__nenhum__)";
  const pronto = !!uid && statusList.length > 0;

  // ── Minhas demandas ─────────────────────────────────────────────
  const minhas = useQuery({
    queryKey: ["inicio-minhas-demandas", uid, hoje, filtroAbertas],
    enabled: pronto,
    queryFn: async () => {
      const base = () =>
        supabase.from("demandas").select("id", { count: "exact", head: true })
          .eq("responsavel_id", uid!).not("status", "in", filtroAbertas);

      const [abertas, semana, atrasadas, lista] = await Promise.all([
        base(),
        base().gte("data_prazo", hoje).lte("data_prazo", emSete),
        base().lt("data_prazo", hoje),
        supabase.from("demandas")
          .select("id, protocolo, titulo, status, data_prazo, municipes(nome)")
          .eq("responsavel_id", uid!).not("status", "in", filtroAbertas)
          .not("data_prazo", "is", null).lte("data_prazo", emSete)
          .order("data_prazo", { ascending: true }).limit(6),
      ]);
      for (const r of [abertas, semana, atrasadas, lista]) if (r.error) throw r.error;

      return {
        abertas: abertas.count ?? 0,
        vencendoSemana: semana.count ?? 0,
        atrasadas: atrasadas.count ?? 0,
        proximas: (lista.data ?? []) as unknown as DemandaResumo[],
      };
    },
    staleTime: 60_000,
  });

  // ── Precisa de atenção (gabinete) ───────────────────────────────
  const atencao = useQuery({
    queryKey: ["inicio-atencao", hoje, filtroAbertas],
    enabled: pronto,
    queryFn: async () => {
      const limiteParada = new Date(Date.now() - DIAS_PARADA * 86400000).toISOString();
      const base = () =>
        supabase.from("demandas").select("id", { count: "exact", head: true })
          .not("status", "in", filtroAbertas);

      const [semResponsavel, paradas, vencendo, listaParadas] = await Promise.all([
        base().is("responsavel_id", null),
        base().lt("updated_at", limiteParada),
        base().gte("data_prazo", hoje).lte("data_prazo", somarDias(hoje, 3)),
        supabase.from("demandas")
          .select("id, protocolo, titulo, status, data_prazo, updated_at, municipes(nome)")
          .not("status", "in", filtroAbertas).lt("updated_at", limiteParada)
          .order("updated_at", { ascending: true }).limit(5),
      ]);
      for (const r of [semResponsavel, paradas, vencendo, listaParadas]) if (r.error) throw r.error;

      return {
        semResponsavel: semResponsavel.count ?? 0,
        paradas: paradas.count ?? 0,
        vencendo3dias: vencendo.count ?? 0,
        maisParadas: (listaParadas.data ?? []) as unknown as DemandaResumo[],
        diasParada: DIAS_PARADA,
      };
    },
    staleTime: 60_000,
  });

  // ── Minhas tarefas ──────────────────────────────────────────────
  const tarefas = useQuery({
    queryKey: ["inicio-minhas-tarefas", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data: colab, error: e1 } = await supabase
        .from("tarefa_colaboradores").select("tarefa_id").eq("colaborador_id", uid!);
      if (e1) throw e1;
      const idsColab = (colab ?? []).map((c) => c.tarefa_id);

      let q = supabase.from("tarefas")
        .select("id, titulo, data_prazo, prioridade, kanban_position")
        .eq("completed", false).neq("kanban_position", "feito");
      q = idsColab.length > 0
        ? q.or(`responsavel_id.eq.${uid},created_by.eq.${uid},id.in.(${idsColab.join(",")})`)
        : q.or(`responsavel_id.eq.${uid},created_by.eq.${uid}`);

      const { data, error } = await q
        .order("data_prazo", { ascending: true, nullsFirst: false }).limit(6);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // ── Minhas agendas (próximas) ───────────────────────────────────
  const agendas = useQuery({
    queryKey: ["inicio-minhas-agendas", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data: acomp, error: e1 } = await supabase
        .from("agenda_acompanhantes").select("agenda_id").eq("usuario_id", uid!);
      if (e1) throw e1;
      const ids = (acomp ?? []).map((a) => a.agenda_id);
      const filtroQuem = [`solicitante_id.eq.${uid}`, `validador_id.eq.${uid}`];
      if (ids.length > 0) filtroQuem.push(`id.in.(${ids.join(",")})`);

      const { data, error } = await supabase.from("agendas")
        .select("id, titulo, descricao_objetivo, data_hora_proposta, local_endereco, status")
        .in("status", ["pendente", "confirmado"])
        .gte("data_hora_proposta", new Date().toISOString())
        .or(filtroQuem.join(","))
        .order("data_hora_proposta", { ascending: true }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // ── Aniversariantes do dia ──────────────────────────────────────
  const aniversariantes = useQuery({
    queryKey: ["inicio-aniversariantes", hoje],
    enabled: !!uid,
    queryFn: async () => {
      // PostgREST não filtra por mês/dia de uma data; busca as datas e filtra aqui.
      const todos = await fetchAll((from, to) =>
        supabase.from("municipes")
          .select("id, nome, telefone, bairro, data_nascimento")
          .not("data_nascimento", "is", null)
          .order("id").range(from, to)
      );
      const mmdd = hoje.slice(5); // "MM-DD"
      return todos
        .filter((m: any) => typeof m.data_nascimento === "string" && m.data_nascimento.slice(5, 10) === mmdd)
        .sort((a: any, b: any) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
    staleTime: 10 * 60_000,
  });

  // ── Hoje no gabinete ────────────────────────────────────────────
  const hojeNoGabinete = useQuery({
    queryKey: ["inicio-hoje", hoje],
    enabled: !!uid,
    queryFn: async () => {
      const inicioDia = new Date(hoje + "T00:00:00").toISOString();
      const contar = (tabela: "demandas" | "municipes" | "demanda_atividades") =>
        supabase.from(tabela).select("id", { count: "exact", head: true }).gte("created_at", inicioDia);

      const [demandas, municipes, atividades, ultimas] = await Promise.all([
        contar("demandas"),
        contar("municipes"),
        contar("demanda_atividades"),
        supabase.from("demanda_atividades")
          .select("id, titulo, tipo_atividade, created_at, demanda_id, demandas(protocolo, titulo), autor:profiles!fk_demanda_atividades_created_by(nome)")
          .gte("created_at", inicioDia)
          .order("created_at", { ascending: false }).limit(6),
      ]);
      for (const r of [demandas, municipes, atividades, ultimas]) if (r.error) throw r.error;

      return {
        demandasNovas: demandas.count ?? 0,
        municipesNovos: municipes.count ?? 0,
        atividades: atividades.count ?? 0,
        ultimas: ultimas.data ?? [],
      };
    },
    staleTime: 60_000,
  });

  return { uid, hoje, minhas, atencao, tarefas, agendas, aniversariantes, hojeNoGabinete };
}
