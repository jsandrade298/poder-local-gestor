import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDemandaStatus } from "@/hooks/useDemandaStatus";
import { fetchAll } from "@/lib/fetchAll";
import { diasAtrasISO } from "@/lib/situacaoDemanda";
import { colunaEhFinal, urlDoCartao, nomeDoQuadro } from "@/hooks/useQuadros";

/**
 * Dados da tela Início: "o que é meu e o que precisa de atenção".
 * Cada bloco é uma consulta separada, para um bloco lento ou com erro
 * não travar os outros.
 */

const DIAS_PARADA = 30;

/** Faixas de "tempo sem alteração" (dias). Cada uma vira um link para a lista. */
export const FAIXAS_PARADA: { min: number; max?: number; rotulo: string; situacao: string }[] = [
  { min: 30, max: 90, rotulo: "1 a 3 meses", situacao: "parada-30-90" },
  { min: 90, max: 180, rotulo: "3 a 6 meses", situacao: "parada-90-180" },
  { min: 180, rotulo: "mais de 6 meses", situacao: "parada-180" },
];

export interface ItemTarefa {
  id: string;
  titulo: string;
  data_prazo: string | null;
  board_id: string;
  /** Nome do quadro ("Meu quadro" para o pessoal de quem vê) */
  origem: string;
  tipoQuadro: "projeto" | "equipe" | "pessoal";
  link: string;
  coluna_id: string;
  /** Etapa final do quadro (para "concluir" num toque); null se não houver */
  coluna_final_id: string | null;
  protocolos: string[];
  souResponsavel: boolean;
}

export interface AgendaResumo {
  id: string;
  titulo: string | null;
  descricao_objetivo: string | null;
  data_hora_proposta: string;
  local_endereco: string | null;
  status: string;
  /** Eventos do Google Agenda: para onde o item leva e como aparece */
  link?: string;
  diaInteiro?: boolean;
  /** Ex.: "mandato", "minha agenda", "convite" (no lugar de confirmada/pendente) */
  selo?: string;
  cor?: string;
}

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
  // Só demandas ABERTAS (status não final). "Parada" = sem nenhuma alteração
  // na demanda (status, responsável, prazo, texto...) há X dias.
  const atencao = useQuery({
    queryKey: ["inicio-atencao", hoje, filtroAbertas],
    enabled: pronto,
    queryFn: async () => {
      const base = () =>
        supabase.from("demandas").select("id", { count: "exact", head: true })
          .not("status", "in", filtroAbertas);

      const [abertas, semResponsavel, atrasadas, vencendo, ...faixasR] = await Promise.all([
        base(),
        base().is("responsavel_id", null),
        base().lt("data_prazo", hoje),
        base().gte("data_prazo", hoje).lte("data_prazo", somarDias(hoje, 3)),
        ...FAIXAS_PARADA.map((f) => {
          let q = base().lt("updated_at", diasAtrasISO(f.min));
          if (f.max) q = q.gte("updated_at", diasAtrasISO(f.max));
          return q;
        }),
      ]);
      const listaParadas = await supabase.from("demandas")
        .select("id, protocolo, titulo, status, data_prazo, updated_at, municipes(nome)")
        .not("status", "in", filtroAbertas).lt("updated_at", diasAtrasISO(DIAS_PARADA))
        .order("updated_at", { ascending: true }).limit(4);
      for (const r of [abertas, semResponsavel, atrasadas, vencendo, ...faixasR, listaParadas]) if (r.error) throw r.error;

      const faixas = FAIXAS_PARADA.map((f, i) => ({ ...f, valor: faixasR[i].count ?? 0 }));
      return {
        abertas: abertas.count ?? 0,
        semResponsavel: semResponsavel.count ?? 0,
        atrasadas: atrasadas.count ?? 0,
        vencendo3dias: vencendo.count ?? 0,
        paradas: faixas.reduce((s, f) => s + f.valor, 0),
        faixas,
        maisParadas: (listaParadas.data ?? []) as unknown as DemandaResumo[],
        diasParada: DIAS_PARADA,
      };
    },
    staleTime: 60_000,
  });

  // ── Minha semana: cartões comigo em qualquer quadro ─────────────
  // Responsável ou colaborador; quadro e cartão não arquivados; fora da
  // etapa final. Desde 24/11/2026 tudo (equipe, pessoal, projetos) é cartão.
  const tarefas = useQuery({
    queryKey: ["inicio-minhas-tarefas", uid],
    enabled: !!uid,
    queryFn: async (): Promise<ItemTarefa[]> => {
      const { data: colab, error: e1 } = await supabase
        .from("kanban_board_card_colaboradores").select("card_id").eq("usuario_id", uid!);
      if (e1) throw e1;
      const idsC = (colab ?? []).map((c: any) => c.card_id);

      const cartoes = await fetchAll((from, to) => {
        let q = (supabase.from("kanban_board_cards") as any)
          .select("id, titulo, data_prazo, board_id, coluna_id, responsavel_id, kanban_boards!inner(nome, tipo, dono_id, arquivado_em), kanban_board_colunas(nome, slug), kanban_board_card_demandas(demandas(protocolo))")
          .is("arquivado_em", null)
          .is("kanban_boards.arquivado_em", null);
        q = idsC.length > 0 ? q.or(`responsavel_id.eq.${uid},id.in.(${idsC.join(",")})`) : q.eq("responsavel_id", uid!);
        return q.order("id").range(from, to);
      });
      const abertos = (cartoes as any[]).filter((c) => !colunaEhFinal(c.kanban_board_colunas ?? {}));

      // Etapa final de cada quadro envolvido (para concluir num toque)
      const quadros = [...new Set(abertos.map((c) => c.board_id))];
      const finalPorQuadro = new Map<string, string>();
      if (quadros.length > 0) {
        const { data: cols, error: e2 } = await supabase.from("kanban_board_colunas")
          .select("id, board_id, nome, slug, ordem, arquivada").in("board_id", quadros);
        if (e2) throw e2;
        (cols ?? [])
          .filter((c: any) => !c.arquivada && colunaEhFinal(c))
          .sort((a: any, b: any) => a.ordem - b.ordem)
          .forEach((c: any) => { if (!finalPorQuadro.has(c.board_id)) finalPorQuadro.set(c.board_id, c.id); });
      }

      return abertos.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        data_prazo: c.data_prazo,
        board_id: c.board_id,
        origem: nomeDoQuadro({ nome: c.kanban_boards?.nome || "Quadro", tipo: c.kanban_boards?.tipo, dono_id: c.kanban_boards?.dono_id }, uid!),
        tipoQuadro: (c.kanban_boards?.tipo || "projeto") as ItemTarefa["tipoQuadro"],
        link: urlDoCartao(c.board_id, c.id),
        coluna_id: c.coluna_id,
        coluna_final_id: finalPorQuadro.get(c.board_id) ?? null,
        protocolos: (c.kanban_board_card_demandas || []).map((d: any) => d.demandas?.protocolo).filter(Boolean),
        souResponsavel: c.responsavel_id === uid,
      })).sort((a, b) => (a.data_prazo ?? "9999-12-31").localeCompare(b.data_prazo ?? "9999-12-31"));
    },
    staleTime: 60_000,
  });

  // ── Meus quadros: equipe, o meu e os projetos de que participo ──
  const projetos = useQuery({
    queryKey: ["inicio-meus-projetos", uid, hoje],
    enabled: !!uid,
    queryFn: async () => {
      const [membro, equipe] = await Promise.all([
        (supabase.from("kanban_board_membros") as any)
          .select("board_id, kanban_boards!inner(id, nome, cor, icone, tipo, dono_id, arquivado_em)")
          .eq("usuario_id", uid!).is("kanban_boards.arquivado_em", null),
        (supabase.from("kanban_boards") as any)
          .select("id, nome, cor, icone, tipo, dono_id, arquivado_em").eq("tipo", "equipe").is("arquivado_em", null),
      ]);
      if (membro.error) throw membro.error;
      if (equipe.error) throw equipe.error;
      const mapa = new Map<string, any>();
      [...(equipe.data ?? []), ...(membro.data ?? []).map((m: any) => m.kanban_boards)].forEach((q: any) => q && mapa.set(q.id, q));
      const quadros = [...mapa.values()];
      if (quadros.length === 0) return [];

      const cartoes = await fetchAll((from, to) =>
        supabase.from("kanban_board_cards")
          .select("id, board_id, data_prazo, responsavel_id, kanban_board_colunas(nome, slug)")
          .in("board_id", quadros.map((q: any) => q.id))
          .is("arquivado_em", null)
          .order("id").range(from, to)
      );

      const peso = (t: string) => (t === "equipe" ? 0 : t === "pessoal" ? 1 : 2);
      return quadros.map((q: any) => {
        const abertos = (cartoes as any[]).filter((c) => c.board_id === q.id && !colunaEhFinal(c.kanban_board_colunas ?? {}));
        return {
          id: q.id as string,
          nome: nomeDoQuadro(q, uid!),
          cor: q.cor as string | null,
          icone: q.icone as string | null,
          tipo: (q.tipo || "projeto") as string,
          abertos: abertos.length,
          atrasados: abertos.filter((c) => c.data_prazo && c.data_prazo < hoje).length,
          comigo: abertos.filter((c) => c.responsavel_id === uid).length,
        };
      }).sort((a, b) => peso(a.tipo) - peso(b.tipo) || b.atrasados - a.atrasados || b.abertos - a.abertos);
    },
    staleTime: 60_000,
  });

  // ── Minhas agendas (próximos 14 dias) ───────────────────────────
  const agendas = useQuery({
    queryKey: ["inicio-minhas-agendas", uid, hoje],
    enabled: !!uid,
    queryFn: async (): Promise<AgendaResumo[]> => {
      const { data: acomp, error: e1 } = await supabase
        .from("agenda_acompanhantes").select("agenda_id").eq("usuario_id", uid!);
      if (e1) throw e1;
      const ids = (acomp ?? []).map((a) => a.agenda_id);
      const filtroQuem = [`solicitante_id.eq.${uid}`, `validador_id.eq.${uid}`];
      if (ids.length > 0) filtroQuem.push(`id.in.(${ids.join(",")})`);

      const inicioHoje = new Date(hoje + "T00:00:00").toISOString();
      const fim = new Date(somarDias(hoje, 14) + "T23:59:59").toISOString();
      const { data, error } = await supabase.from("agendas")
        .select("id, titulo, descricao_objetivo, data_hora_proposta, local_endereco, status")
        .in("status", ["pendente", "confirmado"])
        .gte("data_hora_proposta", inicioHoje)
        .lte("data_hora_proposta", fim)
        .or(filtroQuem.join(","))
        .order("data_hora_proposta", { ascending: true }).limit(30);
      if (error) throw error;
      return (data ?? []) as AgendaResumo[];
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

  // ("Hoje no gabinete" virou "A semana do gabinete": useSemanaGabinete em useInicioExtras)

  return { uid, hoje, minhas, atencao, tarefas, projetos, agendas, aniversariantes };
}
