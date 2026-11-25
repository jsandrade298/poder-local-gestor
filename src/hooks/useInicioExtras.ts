import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { descreverHistorico, urlDoCartao } from "@/hooks/useQuadros";
import { paraTexto } from "@/components/ui/EditorRico";

/**
 * Dados novos do Início (24/11/2026):
 *  - useNovidades: o que mudou para mim desde a última vez que marquei "visto"
 *  - useSemanaGabinete: a semana do gabinete × a semana passada (mesmo trecho)
 */

// ── Novidades para você ─────────────────────────────────────────

export type AlvoNovidade = { tipo: "demanda"; id: string } | { tipo: "url"; url: string };

export interface Novidade {
  id: string;
  quando: string;
  autorId: string | null;
  /** "comentou", "registrou uma atividade", "mencionou você"... */
  acao: string;
  /** Onde: "#2026ABC · Buraco na rua" ou "Cartão X" */
  onde: string;
  detalhe?: string;
  tipo: "mencao" | "atividade" | "cartao" | "comentario" | "aviso";
  alvo: AlvoNovidade | null;
  notificacaoId?: string;
}

const DIAS_PADRAO = 7;
const chaveVisto = (uid: string) => `jorgeus-novidades-visto:${uid}`;

function lerVisto(uid: string) {
  try {
    const v = localStorage.getItem(chaveVisto(uid));
    if (v) return v;
  } catch { /* sem storage */ }
  return new Date(Date.now() - DIAS_PADRAO * 86_400_000).toISOString();
}

export function useNovidades(uid: string | undefined, cartoesComigo: string[]) {
  const qc = useQueryClient();
  const [visto, setVisto] = useState(() => (uid ? lerVisto(uid) : new Date(0).toISOString()));
  const cartoes = useMemo(() => cartoesComigo.slice(0, 300), [cartoesComigo]);

  const query = useQuery({
    queryKey: ["inicio-novidades", uid, visto, cartoes.join(",")],
    enabled: !!uid,
    queryFn: async (): Promise<Novidade[]> => {
      const [notif, ativ, hist, coment] = await Promise.all([
        // Menções e avisos não lidos (os mesmos do sino)
        (supabase.from("notificacoes") as any)
          .select("id, tipo, titulo, mensagem, url_destino, demanda_id, created_at, remetente_id")
          .eq("destinatario_id", uid!).eq("lida", false)
          .order("created_at", { ascending: false }).limit(20),
        // Atividades que outras pessoas registraram nas minhas demandas
        (supabase.from("demanda_atividades") as any)
          .select("id, titulo, tipo_atividade, created_at, created_by, demanda_id, demandas!inner(protocolo, titulo, responsavel_id)")
          .eq("demandas.responsavel_id", uid!).neq("created_by", uid!).gt("created_at", visto)
          .order("created_at", { ascending: false }).limit(20),
        // Mudanças nos cartões em que estou
        cartoes.length === 0 ? Promise.resolve({ data: [], error: null }) :
          (supabase.from("kanban_board_card_historico") as any)
            .select("id, acao, detalhe, created_at, usuario_id, card_id, kanban_board_cards(titulo, board_id)")
            .in("card_id", cartoes).neq("usuario_id", uid!).gt("created_at", visto)
            .order("created_at", { ascending: false }).limit(20),
        cartoes.length === 0 ? Promise.resolve({ data: [], error: null }) :
          (supabase.from("kanban_board_card_comentarios") as any)
            .select("id, texto, created_at, autor_id, card_id, kanban_board_cards(titulo, board_id)")
            .in("card_id", cartoes).neq("autor_id", uid!).gt("created_at", visto)
            .order("created_at", { ascending: false }).limit(20),
      ]);
      for (const r of [notif, ativ, hist, coment]) if (r.error) throw r.error;

      const itens: Novidade[] = [];
      (notif.data ?? []).forEach((n: any) => itens.push({
        id: "n" + n.id, quando: n.created_at, autorId: n.remetente_id,
        acao: n.tipo === "mencao" ? "mencionou você" : (n.titulo || "aviso"),
        onde: n.tipo === "mencao" ? (n.titulo || "") : "",
        detalhe: n.mensagem ? paraTexto(n.mensagem).slice(0, 140) : undefined,
        tipo: n.tipo === "mencao" ? "mencao" : "aviso",
        alvo: n.demanda_id ? { tipo: "demanda", id: n.demanda_id } : n.url_destino ? { tipo: "url", url: n.url_destino } : null,
        notificacaoId: n.id,
      }));
      (ativ.data ?? []).forEach((a: any) => itens.push({
        id: "a" + a.id, quando: a.created_at, autorId: a.created_by,
        acao: "registrou uma atividade",
        onde: `#${a.demandas?.protocolo} · ${a.demandas?.titulo ?? ""}`,
        detalhe: a.titulo,
        tipo: "atividade",
        alvo: { tipo: "demanda", id: a.demanda_id },
      }));
      (hist.data ?? []).forEach((h: any) => {
        if (h.acao === "criou") return; // criação já aparece como cartão novo na semana
        itens.push({
          id: "h" + h.id, quando: h.created_at, autorId: h.usuario_id,
          acao: descreverHistorico(h.acao, h.detalhe),
          onde: h.kanban_board_cards?.titulo ?? "Cartão",
          tipo: "cartao",
          alvo: h.kanban_board_cards ? { tipo: "url", url: urlDoCartao(h.kanban_board_cards.board_id, h.card_id) } : null,
        });
      });
      (coment.data ?? []).forEach((c: any) => itens.push({
        id: "c" + c.id, quando: c.created_at, autorId: c.autor_id,
        acao: "comentou",
        onde: c.kanban_board_cards?.titulo ?? "Cartão",
        detalhe: paraTexto(c.texto || "").slice(0, 140),
        tipo: "comentario",
        alvo: c.kanban_board_cards ? { tipo: "url", url: urlDoCartao(c.kanban_board_cards.board_id, c.card_id) } : null,
      }));
      return itens.sort((a, b) => b.quando.localeCompare(a.quando));
    },
    staleTime: 60_000,
  });

  /** Marca tudo como visto: some da lista (e as notificações ficam lidas no sino). */
  const marcarVisto = useCallback(async () => {
    if (!uid) return;
    const agora = new Date().toISOString();
    try { localStorage.setItem(chaveVisto(uid), agora); } catch { /* sem storage */ }
    const ids = (query.data ?? []).map((n) => n.notificacaoId).filter(Boolean) as string[];
    if (ids.length) {
      await (supabase.from("notificacoes") as any).update({ lida: true, updated_at: agora }).in("id", ids);
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    }
    setVisto(agora);
  }, [uid, query.data, qc]);

  /** Abrir uma novidade que é notificação também a marca como lida. */
  const marcarLida = useCallback(async (n: Novidade) => {
    if (!n.notificacaoId) return;
    await (supabase.from("notificacoes") as any).update({ lida: true, updated_at: new Date().toISOString() }).eq("id", n.notificacaoId);
    qc.invalidateQueries({ queryKey: ["notificacoes"] });
    qc.invalidateQueries({ queryKey: ["inicio-novidades"] });
  }, [qc]);

  return { ...query, visto, marcarVisto, marcarLida };
}

// ── A semana do gabinete ────────────────────────────────────────

function inicioDaSemana(d = new Date()) {
  const x = new Date(d);
  const dia = (x.getDay() + 6) % 7; // segunda = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - dia);
  return x;
}

export interface NumeroSemana { atual: number; anterior: number }

export function useSemanaGabinete(finalSlugs: string[], habilitado: boolean) {
  const filtroFinais = finalSlugs.length > 0 ? `(${finalSlugs.join(",")})` : "(__nenhum__)";
  return useQuery({
    queryKey: ["inicio-semana-gabinete", filtroFinais, new Date().toDateString()],
    enabled: habilitado && finalSlugs.length > 0,
    queryFn: async () => {
      // Esta semana (segunda até agora) × semana passada até o mesmo dia/hora
      const ini = inicioDaSemana();
      const agora = new Date();
      const iniAnt = new Date(ini.getTime() - 7 * 86_400_000);
      const agoraAnt = new Date(agora.getTime() - 7 * 86_400_000);
      const faixa = (a: Date, b: Date) => [a.toISOString(), b.toISOString()] as const;
      const [A, B] = [faixa(ini, agora), faixa(iniAnt, agoraAnt)];

      const contar = (tabela: "demandas" | "municipes" | "demanda_atividades", [de, ate]: readonly [string, string]) =>
        supabase.from(tabela).select("id", { count: "exact", head: true }).gte("created_at", de).lte("created_at", ate);
      // Não há data de conclusão no banco: status final + última alteração na semana (como em Análises)
      const concluidas = ([de, ate]: readonly [string, string]) =>
        supabase.from("demandas").select("id", { count: "exact", head: true })
          .in("status", finalSlugs).gte("updated_at", de).lte("updated_at", ate);

      const r = await Promise.all([
        contar("demandas", A), contar("demandas", B),
        concluidas(A), concluidas(B),
        contar("demanda_atividades", A), contar("demanda_atividades", B),
        contar("municipes", A), contar("municipes", B),
        supabase.from("demandas").select("responsavel_id").in("status", finalSlugs)
          .gte("updated_at", A[0]).lte("updated_at", A[1]).not("responsavel_id", "is", null).limit(2000),
      ]);
      for (const x of r) if (x.error) throw x.error;
      const n = (i: number) => (r[i] as any).count ?? 0;

      const porPessoa = new Map<string, number>();
      ((r[8] as any).data ?? []).forEach((d: any) => porPessoa.set(d.responsavel_id, (porPessoa.get(d.responsavel_id) || 0) + 1));
      const destaque = [...porPessoa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, total]) => ({ id, total }));

      return {
        inicio: ini.toISOString(),
        novas: { atual: n(0), anterior: n(1) } as NumeroSemana,
        concluidas: { atual: n(2), anterior: n(3) } as NumeroSemana,
        atividades: { atual: n(4), anterior: n(5) } as NumeroSemana,
        municipes: { atual: n(6), anterior: n(7) } as NumeroSemana,
        destaque,
      };
    },
    staleTime: 5 * 60_000,
  });
}
