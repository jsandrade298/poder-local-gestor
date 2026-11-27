// ============================================================
// jorginho — o mascote com IA do Jorgeus (27/11/2026)
//
// Corpo JSON { acao, ... }:
//   status                               a IA está disponível? quanto já usei hoje?
//   conversar  { mensagens, contexto }   conversa; o modelo usa ferramentas que
//                                        consultam o banco COM O LOGIN DE QUEM PERGUNTA
//                                        (as regras de acesso valem igual à tela)
//   oficina    { pedido, atual? }        monta a "receita" de um widget (nunca código)
//   piada      { momento? }              uma piadinha curta, para o Jotinha puxar assunto
//   preencher  { mensagens, formulario } uma rodada do preenchimento conversado de um
//                                        formulário aberto na tela (o que falar e o que preencher)
//
// Regras:
//  - Ações (criar tarefa, mudar responsável, prazo, comentário) só são PROPOSTAS;
//    a pessoa confirma na tela e o próprio app executa com o login dela.
//  - O mínimo de dados vai para a IA: nada de telefone, CPF, e-mail ou endereço.
//  - Provedor compatível com OpenAI (padrão: NVIDIA). Chave em NVIDIA_API_KEY;
//    modelos em JORGINHO_MODELOS (lista, o primeiro é o principal);
//    limite por pessoa/dia em JORGINHO_LIMITE_DIA (0 ou vazio = sem limite; só conta).
//  - O gabinete pode desligar a IA: configuracoes "jorginho.ia" = "desligado".
// ============================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
class Erro extends Error { constructor(public status: number, msg: string, public codigo?: string) { super(msg); } }

const URL_IA = Deno.env.get("JORGINHO_URL") || "https://integrate.api.nvidia.com/v1/chat/completions";
const MODELOS = (Deno.env.get("JORGINHO_MODELOS") || "nvidia/nemotron-3-ultra-550b-a55b").split(",").map((s) => s.trim()).filter(Boolean);
// Na conversa por voz a resposta precisa ser rápida: dá para apontar um modelo mais leve
// (medido em 27/11/2026: Super 120B ~1,5 s com bom preenchimento; Ultra ~3 s fica de reserva)
const MODELOS_VOZ = (Deno.env.get("JORGINHO_MODELOS_VOZ") || "nvidia/nemotron-3.5-super-vl-120b-a12b,nvidia/nemotron-3-ultra-550b-a55b").split(",").map((s) => s.trim()).filter(Boolean);
const LIMITE_DIA = Number(Deno.env.get("JORGINHO_LIMITE_DIA") || 0); // 0 = sem limite
const FUSO = "America/Sao_Paulo";
const MAX_RODADAS = 5;
// Modelos de raciocínio (ex.: Nemotron 3) pensam antes de responder: lento e gasta a resposta.
// Desligado por padrão; JORGINHO_RACIOCINIO=ligado mantém.
const SEM_RACIOCINIO = (Deno.env.get("JORGINHO_RACIOCINIO") || "").toLowerCase() !== "ligado";

const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
const somarDias = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const normalizar = (t: string) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const parecido = (a: string, b: string) => { const x = normalizar(a), y = normalizar(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
const primeiroNome = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "";

// ── Quem pergunta e o que existe no gabinete ─────────────────────

interface Contexto {
  sb: SupabaseClient; admin: SupabaseClient; token: string;
  uid: string; nome: string; tenantId: string; papel: string; gabinete: string;
  status: { slug: string; nome: string; final: boolean }[];
  areas: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  hoje: string;
}

async function montarContexto(req: Request): Promise<Contexto> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Erro(401, "Não autenticado");
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: u, error } = await admin.auth.getUser(token);
  if (error || !u?.user) throw new Erro(401, "Sessão inválida — faça login novamente");
  // Cliente com o login da pessoa: tudo que o Jotinha consulta passa pelas regras de acesso dela
  const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: perfil } = await admin.from("profiles").select("nome, tenant_id, role_no_tenant, ativo").eq("id", u.user.id).maybeSingle();
  if (!perfil?.tenant_id) throw new Erro(403, "Usuário sem gabinete");
  if (perfil.ativo === false) throw new Erro(403, "Acesso desativado");
  const [st, ar, pe, cfg, tn] = await Promise.all([
    sb.from("demanda_status").select("slug, nome, is_final, ordem").order("ordem"),
    sb.from("areas").select("id, nome").order("nome"),
    sb.from("profiles").select("id, nome, ativo").order("nome"),
    admin.from("configuracoes").select("chave, valor").eq("tenant_id", perfil.tenant_id).in("chave", ["gabinete.nome", "jorginho.ia"]),
    admin.from("tenants").select("nome").eq("id", perfil.tenant_id).maybeSingle(),
  ]);
  const conf = new Map((cfg.data ?? []).map((c: any) => [c.chave, c.valor]));
  if (conf.get("jorginho.ia") === "desligado") throw new Erro(403, "A IA do Jotinha está desligada neste gabinete.", "desligado");
  return {
    sb, admin, token, uid: u.user.id, nome: perfil.nome || "você", tenantId: perfil.tenant_id, papel: perfil.role_no_tenant || "",
    gabinete: (conf.get("gabinete.nome") as string) || tn.data?.nome || "Gabinete",
    status: (st.data ?? []).map((s: any) => ({ slug: s.slug, nome: s.nome, final: !!s.is_final })),
    areas: (ar.data ?? []) as any,
    pessoas: (pe.data ?? []).filter((p: any) => p.ativo !== false).map((p: any) => ({ id: p.id, nome: p.nome })),
    hoje: hojeISO(),
  };
}

// ── Filtros de demandas (usados por várias ferramentas e pela Oficina) ──

interface Filtros {
  situacao?: "abertas" | "concluidas" | "atrasadas" | "sem_responsavel" | "todas";
  status?: string[]; areas?: string[]; bairro?: string; responsavel?: string;
  de?: string; ate?: string; vence_ate?: string; texto?: string; prioridade?: string;
}

function resolverPessoa(c: Contexto, nome?: string) {
  if (!nome) return null;
  const n = normalizar(nome);
  if (["eu", "mim", "me", "comigo", "minhas", "meus"].includes(n)) return { id: c.uid, nome: c.nome };
  return c.pessoas.find((p) => normalizar(p.nome) === n) || c.pessoas.find((p) => parecido(p.nome, nome)) || null;
}

function aplicarFiltros(q: any, c: Contexto, f: Filtros = {}) {
  const finais = c.status.filter((s) => s.final).map((s) => s.slug);
  const lista = (xs: string[]) => `(${xs.map((x) => `"${x.replace(/"/g, "")}"`).join(",")})`;
  const sit = f.situacao || "todas";
  if (sit === "abertas" && finais.length) q = q.not("status", "in", lista(finais));
  if (sit === "concluidas") q = q.in("status", finais.length ? finais : ["__nenhum__"]);
  if (sit === "atrasadas") { q = q.lt("data_prazo", c.hoje).not("data_prazo", "is", null); if (finais.length) q = q.not("status", "in", lista(finais)); }
  if (sit === "sem_responsavel") { q = q.is("responsavel_id", null); if (finais.length) q = q.not("status", "in", lista(finais)); }
  if (f.status?.length) {
    const slugs = c.status.filter((s) => f.status!.some((x) => parecido(s.nome, x) || parecido(s.slug, x))).map((s) => s.slug);
    q = q.in("status", slugs.length ? slugs : ["__nenhum__"]);
  }
  if (f.areas?.length) {
    const semArea = f.areas.some((a) => /^sem/.test(normalizar(a)));
    const ids = c.areas.filter((a) => f.areas!.some((x) => parecido(a.nome, x))).map((a) => a.id);
    if (semArea) q = q.is("area_id", null); else q = q.in("area_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (f.bairro) q = q.ilike("bairro", `%${f.bairro.replace(/[%_,()]/g, " ").trim()}%`);
  if (f.responsavel) {
    if (/^(ninguem|sem)/.test(normalizar(f.responsavel))) q = q.is("responsavel_id", null);
    else { const p = resolverPessoa(c, f.responsavel); q = q.eq("responsavel_id", p?.id ?? "00000000-0000-0000-0000-000000000000"); }
  }
  if (f.prioridade) q = q.eq("prioridade", normalizar(f.prioridade).replace("média", "media"));
  if (f.de) q = q.gte("created_at", `${f.de}T00:00:00-03:00`);
  if (f.ate) q = q.lte("created_at", `${f.ate}T23:59:59-03:00`);
  if (f.vence_ate) q = q.lte("data_prazo", f.vence_ate).gte("data_prazo", c.hoje);
  if (f.texto) for (const p of normalizar(f.texto).replace(/[%_,()"\\]/g, " ").split(/\s+/).filter(Boolean)) q = q.ilike("busca", `%${p}%`);
  return q;
}

const nomeStatus = (c: Contexto, slug: string | null) => c.status.find((s) => s.slug === slug)?.nome || slug || "–";
const nomeArea = (c: Contexto, id: string | null) => (id ? c.areas.find((a) => a.id === id)?.nome || "–" : "Sem área");
const nomePessoa = (c: Contexto, id: string | null) => (id ? c.pessoas.find((p) => p.id === id)?.nome || "Pessoa" : "Sem responsável");
const linkDemanda = (protocolo: string) => `/demandas?protocolo=${encodeURIComponent(protocolo)}`;

async function buscarTodas(q: () => any, maximo = 5000) {
  const linhas: any[] = [];
  for (let de = 0; de < maximo; de += 1000) {
    const { data, error } = await q().range(de, de + 999);
    if (error) throw new Erro(400, error.message);
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

// ── Ferramentas ──────────────────────────────────────────────────

const PROP_FILTROS = {
  situacao: { type: "string", enum: ["abertas", "concluidas", "atrasadas", "sem_responsavel", "todas"], description: "abertas = não concluídas; atrasadas = em aberto com prazo vencido" },
  status: { type: "array", items: { type: "string" }, description: "Nomes de status do gabinete" },
  areas: { type: "array", items: { type: "string" }, description: "Nomes de áreas do gabinete (ou 'sem área')" },
  bairro: { type: "string" },
  responsavel: { type: "string", description: "Nome da pessoa da equipe, 'eu' para quem pergunta, ou 'ninguém'" },
  prioridade: { type: "string", enum: ["urgente", "alta", "media", "baixa"] },
  de: { type: "string", description: "Data de entrada inicial, AAAA-MM-DD" },
  ate: { type: "string", description: "Data de entrada final, AAAA-MM-DD" },
  vence_ate: { type: "string", description: "Em aberto com prazo de hoje até esta data, AAAA-MM-DD" },
  texto: { type: "string", description: "Palavras para buscar no título, protocolo, munícipe, descrição e endereço" },
};

const FERRAMENTAS = [
  { type: "function", function: { name: "contar_demandas", description: "Conta demandas com filtros; pode agrupar por área, bairro, status, responsável, prioridade ou mês de entrada.", parameters: { type: "object", properties: { ...PROP_FILTROS, agrupar_por: { type: "string", enum: ["area", "bairro", "status", "responsavel", "prioridade", "mes"] } } } } },
  { type: "function", function: { name: "listar_demandas", description: "Lista até 10 demandas com filtros (protocolo, título, status, área, prazo, link).", parameters: { type: "object", properties: { ...PROP_FILTROS, ordem: { type: "string", enum: ["recentes", "antigas", "prazo"] }, limite: { type: "integer", minimum: 1, maximum: 10 } } } } },
  { type: "function", function: { name: "ver_demanda", description: "Detalhes de uma demanda pelo protocolo, com as últimas atividades.", parameters: { type: "object", properties: { protocolo: { type: "string" } }, required: ["protocolo"] } } },
  { type: "function", function: { name: "numeros_do_periodo", description: "Quantas entraram e quantas foram concluídas num período, e como está a fila hoje.", parameters: { type: "object", properties: { de: { type: "string", description: "AAAA-MM-DD" }, ate: { type: "string", description: "AAAA-MM-DD" } }, required: ["de", "ate"] } } },
  { type: "function", function: { name: "minhas_tarefas", description: "Cartões dos quadros com quem pergunta (responsável ou colaborando), em aberto.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "agenda", description: "Compromissos da agenda (mandato e pessoal) a partir de uma data.", parameters: { type: "object", properties: { a_partir_de: { type: "string", description: "AAAA-MM-DD; padrão hoje" }, dias: { type: "integer", minimum: 1, maximum: 14 } } } } },
  { type: "function", function: { name: "buscar_municipe", description: "Procura munícipes pelo nome e diz quantas demandas cada um tem (sem dados de contato).", parameters: { type: "object", properties: { nome: { type: "string" } }, required: ["nome"] } } },
  { type: "function", function: { name: "propor_tarefa", description: "PROPÕE criar uma tarefa no Meu quadro de quem pergunta. A pessoa confirma na tela.", parameters: { type: "object", properties: { titulo: { type: "string" }, prazo: { type: "string", description: "AAAA-MM-DD" }, descricao: { type: "string" } }, required: ["titulo"] } } },
  { type: "function", function: { name: "propor_responsavel", description: "PROPÕE passar demandas para uma pessoa da equipe. A pessoa confirma na tela.", parameters: { type: "object", properties: { protocolos: { type: "array", items: { type: "string" } }, pessoa: { type: "string" } }, required: ["protocolos", "pessoa"] } } },
  { type: "function", function: { name: "propor_prazo", description: "PROPÕE definir o prazo de uma demanda. A pessoa confirma na tela.", parameters: { type: "object", properties: { protocolo: { type: "string" }, prazo: { type: "string", description: "AAAA-MM-DD" } }, required: ["protocolo", "prazo"] } } },
  { type: "function", function: { name: "propor_comentario", description: "PROPÕE registrar um comentário na linha do tempo de uma demanda. A pessoa confirma na tela.", parameters: { type: "object", properties: { protocolo: { type: "string" }, texto: { type: "string" } }, required: ["protocolo", "texto"] } } },
  { type: "function", function: { name: "abrir_formulario_demanda", description: "Abre o formulário de NOVA DEMANDA na tela; você e a pessoa preenchem juntos, conversando (ela pode responder por voz). Use sempre que a pessoa quiser cadastrar/registrar/abrir uma demanda. Passe o que ela já contou.", parameters: { type: "object", properties: { titulo: { type: "string" }, descricao: { type: "string", description: "O relato, se ela já contou" }, municipe: { type: "string", description: "Nome de quem pediu, se disse" }, bairro: { type: "string" }, logradouro: { type: "string" }, area: { type: "string" }, prioridade: { type: "string", enum: ["baixa", "media", "alta", "urgente"] } } } } },
];

type Acao =
  | { tipo: "criar_tarefa"; titulo: string; prazo?: string | null; descricao?: string | null }
  | { tipo: "mudar_responsavel"; demandas: { id: string; protocolo: string; titulo: string }[]; pessoaId: string; pessoaNome: string }
  | { tipo: "mudar_prazo"; demandaId: string; protocolo: string; titulo: string; prazo: string }
  | { tipo: "comentar"; demandaId: string; protocolo: string; titulo: string; texto: string }
  | { tipo: "abrir_formulario"; formulario: "nova_demanda"; valores: Record<string, string> };

async function demandaPorProtocolo(c: Contexto, protocolo: string) {
  const p = String(protocolo || "").replace(/^#/, "").trim();
  const { data } = await c.sb.from("demandas").select("id, protocolo, titulo").ilike("protocolo", p).maybeSingle();
  return data as null | { id: string; protocolo: string; titulo: string };
}

async function executarFerramenta(c: Contexto, nome: string, a: any, acoes: Acao[]): Promise<unknown> {
  switch (nome) {
    case "contar_demandas": {
      if (!a.agrupar_por) {
        const { count, error } = await aplicarFiltros(c.sb.from("demandas").select("id", { count: "exact", head: true }), c, a);
        if (error) throw new Erro(400, error.message);
        return { total: count ?? 0 };
      }
      const col = ({ area: "area_id", bairro: "bairro", status: "status", responsavel: "responsavel_id", prioridade: "prioridade", mes: "created_at" } as any)[a.agrupar_por];
      const linhas = await buscarTodas(() => aplicarFiltros(c.sb.from("demandas").select(`id, ${col}`).order("id"), c, a));
      const grupos = new Map<string, number>();
      linhas.forEach((l) => {
        let k = l[col];
        if (a.agrupar_por === "area") k = nomeArea(c, k);
        else if (a.agrupar_por === "status") k = nomeStatus(c, k);
        else if (a.agrupar_por === "responsavel") k = nomePessoa(c, k);
        else if (a.agrupar_por === "mes") k = String(k).slice(0, 7);
        else if (a.agrupar_por === "bairro") k = k ? String(k).trim() : "Sem bairro";
        grupos.set(k || "–", (grupos.get(k || "–") || 0) + 1);
      });
      return { total: linhas.length, grupos: [...grupos.entries()].sort((x, y) => y[1] - x[1]).slice(0, 15).map(([nome, n]) => ({ nome, n })) };
    }
    case "listar_demandas": {
      let q = aplicarFiltros(c.sb.from("demandas").select("protocolo, titulo, status, area_id, bairro, data_prazo, created_at, responsavel_id", { count: "exact" }), c, a);
      q = a.ordem === "prazo" ? q.order("data_prazo", { ascending: true, nullsFirst: false }) : q.order("created_at", { ascending: a.ordem === "antigas" });
      const { data, count, error } = await q.limit(Math.min(10, Math.max(1, a.limite || 6)));
      if (error) throw new Erro(400, error.message);
      return {
        total: count ?? 0,
        demandas: (data ?? []).map((d: any) => ({
          protocolo: d.protocolo, titulo: d.titulo, status: nomeStatus(c, d.status), area: nomeArea(c, d.area_id), bairro: d.bairro || null,
          responsavel: d.responsavel_id ? primeiroNome(nomePessoa(c, d.responsavel_id)) : null, prazo: d.data_prazo, entrou: String(d.created_at).slice(0, 10), link: linkDemanda(d.protocolo),
        })),
      };
    }
    case "ver_demanda": {
      const p = String(a.protocolo || "").replace(/^#/, "").trim();
      const { data: d } = await c.sb.from("demandas")
        .select("id, protocolo, titulo, descricao, status, area_id, bairro, prioridade, data_prazo, created_at, concluida_em, responsavel_id, origem, municipes(nome)")
        .ilike("protocolo", p).maybeSingle();
      if (!d) return { erro: "Demanda não encontrada (ou você não tem acesso)." };
      const { data: at } = await c.sb.from("demanda_atividades").select("tipo_atividade, titulo, descricao, created_at, created_by").eq("demanda_id", (d as any).id).order("created_at", { ascending: false }).limit(8);
      return {
        protocolo: (d as any).protocolo, titulo: (d as any).titulo, descricao: String((d as any).descricao || "").slice(0, 1200),
        status: nomeStatus(c, (d as any).status), area: nomeArea(c, (d as any).area_id), bairro: (d as any).bairro, prioridade: (d as any).prioridade,
        prazo: (d as any).data_prazo, entrou: String((d as any).created_at).slice(0, 10), concluida_em: (d as any).concluida_em?.slice(0, 10) || null,
        responsavel: nomePessoa(c, (d as any).responsavel_id), municipe: primeiroNome((d as any).municipes?.nome), origem: (d as any).origem, link: linkDemanda((d as any).protocolo),
        atividades: (at ?? []).map((x: any) => ({ quando: String(x.created_at).slice(0, 10), quem: primeiroNome(nomePessoa(c, x.created_by)), tipo: x.tipo_atividade, titulo: x.titulo, texto: String(x.descricao || "").replace(/<[^>]+>/g, " ").slice(0, 300) })),
      };
    }
    case "numeros_do_periodo": {
      const finais = c.status.filter((s) => s.final).map((s) => s.slug);
      const conta = async (f: (q: any) => any) => { const { count } = await f(c.sb.from("demandas").select("id", { count: "exact", head: true })); return count ?? 0; };
      const [entraram, concluidas, abertas, atrasadas] = await Promise.all([
        conta((q) => q.gte("created_at", `${a.de}T00:00:00-03:00`).lte("created_at", `${a.ate}T23:59:59-03:00`)),
        conta((q) => q.gte("concluida_em", `${a.de}T00:00:00-03:00`).lte("concluida_em", `${a.ate}T23:59:59-03:00`)),
        conta((q) => aplicarFiltros(q, c, { situacao: "abertas" })),
        conta((q) => aplicarFiltros(q, c, { situacao: "atrasadas" })),
      ]);
      return { periodo: { de: a.de, ate: a.ate }, entraram, concluidas_no_periodo: concluidas, abertas_hoje: abertas, atrasadas_hoje: atrasadas, status_finais: finais.map((s) => nomeStatus(c, s)) };
    }
    case "minhas_tarefas": {
      const [resp, colab] = await Promise.all([
        c.sb.from("kanban_board_cards").select("id, titulo, data_prazo, board_id, kanban_boards(nome, tipo, dono_id), kanban_board_colunas(nome, slug)").eq("responsavel_id", c.uid).is("arquivado_em", null).limit(60),
        c.sb.from("kanban_board_card_colaboradores").select("kanban_board_cards(id, titulo, data_prazo, board_id, arquivado_em, kanban_boards(nome, tipo, dono_id), kanban_board_colunas(nome, slug))").eq("usuario_id", c.uid).limit(60),
      ]);
      const todos = [...(resp.data ?? []), ...(colab.data ?? []).map((x: any) => x.kanban_board_cards).filter((x: any) => x && !x.arquivado_em)];
      const final = (col: any) => /conclu|feito|finaliz|entregue|done/.test(`${col?.slug ?? ""} ${col?.nome ?? ""}`.toLowerCase());
      const vistos = new Set<string>();
      const abertas = todos.filter((t: any) => t && !vistos.has(t.id) && vistos.add(t.id) && !final(t.kanban_board_colunas))
        .sort((x: any, y: any) => String(x.data_prazo || "9999").localeCompare(String(y.data_prazo || "9999")));
      return {
        total: abertas.length,
        tarefas: abertas.slice(0, 15).map((t: any) => ({
          titulo: t.titulo, prazo: t.data_prazo, etapa: t.kanban_board_colunas?.nome,
          quadro: t.kanban_boards?.tipo === "pessoal" && t.kanban_boards?.dono_id === c.uid ? "Meu quadro" : t.kanban_boards?.nome,
          link: `/quadros/${t.board_id}?cartao=${t.id}`,
        })),
      };
    }
    case "agenda": {
      const de = a.a_partir_de || c.hoje;
      const dias = Math.min(14, Math.max(1, a.dias || 7));
      const inicio = new Date(`${de}T00:00:00-03:00`), fim = new Date(`${somarDias(de, dias)}T00:00:00-03:00`);
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/google-agenda`, {
        method: "POST",
        headers: { Authorization: `Bearer ${c.token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "eventos", de: inicio.toISOString(), ate: fim.toISOString() }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) return { erro: corpo?.error || "Não consegui ler a agenda (talvez ela não esteja conectada)." };
      return {
        eventos: (corpo.eventos ?? []).filter((e: any) => e.minhaResposta !== "declined").slice(0, 40).map((e: any) => ({
          titulo: e.titulo, inicio: e.inicio, fim: e.fim, dia_inteiro: e.diaInteiro, local: e.local || null,
          agenda: e.origem === "mandato" ? "mandato" : "minha", convite_pendente: e.minhaResposta === "needsAction",
        })),
        avisos: corpo.avisos ?? [],
        link: `/agenda?dia=${de}`,
      };
    }
    case "buscar_municipe": {
      const nome = String(a.nome || "").trim();
      if (nome.length < 2) return { erro: "Diga ao menos 2 letras do nome." };
      let q = c.sb.from("municipes").select("id, nome, bairro");
      for (const p of normalizar(nome).replace(/[%_,()"\\]/g, " ").split(/\s+/).filter(Boolean)) q = q.ilike("busca", `%${p}%`);
      const { data } = await q.order("nome").limit(5);
      const lista = await Promise.all((data ?? []).map(async (m: any) => {
        const { count } = await c.sb.from("demandas").select("id", { count: "exact", head: true }).eq("municipe_id", m.id);
        return { nome: m.nome, bairro: m.bairro || null, demandas: count ?? 0, link: `/municipes?q=${encodeURIComponent(m.nome)}` };
      }));
      return { encontrados: lista };
    }
    case "propor_tarefa": {
      const acao: Acao = { tipo: "criar_tarefa", titulo: String(a.titulo || "").slice(0, 140), prazo: a.prazo || null, descricao: a.descricao ? String(a.descricao).slice(0, 600) : null };
      acoes.push(acao);
      return { proposta_mostrada: true, obs: "A pessoa vai ver um botão para confirmar. Não diga que já foi criado." };
    }
    case "propor_responsavel": {
      const p = resolverPessoa(c, a.pessoa);
      if (!p) return { erro: `Não encontrei "${a.pessoa}" na equipe. Pessoas: ${c.pessoas.map((x) => x.nome).join(", ")}` };
      const ds = (await Promise.all((a.protocolos || []).slice(0, 20).map((x: string) => demandaPorProtocolo(c, x)))).filter(Boolean) as any[];
      if (!ds.length) return { erro: "Não encontrei essas demandas." };
      acoes.push({ tipo: "mudar_responsavel", demandas: ds, pessoaId: p.id, pessoaNome: p.nome });
      return { proposta_mostrada: true, demandas: ds.map((d) => d.protocolo), pessoa: p.nome };
    }
    case "propor_prazo": {
      const d = await demandaPorProtocolo(c, a.protocolo);
      if (!d) return { erro: "Demanda não encontrada." };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.prazo || "")) return { erro: "Prazo inválido; use AAAA-MM-DD." };
      acoes.push({ tipo: "mudar_prazo", demandaId: d.id, protocolo: d.protocolo, titulo: d.titulo, prazo: a.prazo });
      return { proposta_mostrada: true };
    }
    case "abrir_formulario_demanda": {
      const valores: Record<string, string> = {};
      for (const k of ["titulo", "descricao", "municipe", "bairro", "logradouro", "area", "prioridade"]) {
        if (typeof a[k] === "string" && a[k].trim()) valores[k] = a[k].trim().slice(0, k === "descricao" ? 3000 : 150);
      }
      acoes.push({ tipo: "abrir_formulario", formulario: "nova_demanda", valores });
      return { formulario_aberto: true, obs: "O formulário já abriu na tela e você vai conduzir o preenchimento por lá. Responda só uma frase curta e animada, sem perguntar nada aqui." };
    }
    case "propor_comentario": {
      const d = await demandaPorProtocolo(c, a.protocolo);
      if (!d) return { erro: "Demanda não encontrada." };
      acoes.push({ tipo: "comentar", demandaId: d.id, protocolo: d.protocolo, titulo: d.titulo, texto: String(a.texto || "").slice(0, 2000) });
      return { proposta_mostrada: true };
    }
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}

// ── Conversa com o modelo ────────────────────────────────────────

const GUIA_DO_APP = `
Telas do Jorgeus (menu lateral; no celular, barra inferior + menu):
- Início (/inicio): resumo do dia, Hoje na agenda, Minha semana (tarefas e compromissos), Minhas demandas, Precisa de atenção, aniversariantes, Meus quadros, widgets da Oficina.
- Demandas (/demandas): lista com busca e filtros (status, área, responsável, bairro, atraso, período); "Nova demanda"; abrir uma demanda mostra detalhes, linha do tempo de atividades, agenda ligada; ações em lote; lixeira (30 dias para restaurar).
- Munícipes (/municipes): cadastro, tags, categorias, prontuário com o histórico; importar CSV.
- Quadros (/quadros): Meu quadro (pessoal), projetos com membros; cartões com prazo, checklist, comentários, demandas vinculadas; botão "Demanda" traz demandas com filtros.
- Agenda (/agenda): Google Agenda do mandato e pessoal; dia/semana/mês/lista/livres; clique num horário vazio para criar rápido; "Pedir horário" (até 3 opções) para quem não é editor; busca.
- Mapa (/mapa): demandas e munícipes no mapa.
- Análises (/analises): período (semana, quinzena, mês, personalizado), filtros de área e responsável, funil das recebidas, por área, atendimento (primeira resposta, munícipes), equipe; "Relatório" gera PDF de gestão e resumo para WhatsApp; "Exportar planilha".
- Gabinete: Usuários, Tags, Categorias, Áreas, Configurações.
`;

function promptSistema(c: Contexto, contexto: any, modo: "conversa" | "oficina") {
  const dataExtenso = new Date().toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const base = `Você é o Jotinha, o mascote do Jorgeus (sistema de gestão de gabinetes de vereadores).
Personalidade: o "assessor-mascote" do gabinete — o J da marca Jorgeus que ganhou vida (olhões, luvas brancas e tênis), movido a café. Simpático, esperto e prestativo; adora um trocadilho e uma tirada rápida (na medida, nunca forçada); comemora as vitórias da equipe; chama a fila de demandas de "nossa fila". Fala português do Brasil, trata por "você", é direto e curto.
Hoje é ${dataExtenso} (${c.hoje}). Você está falando com ${primeiroNome(c.nome)}${c.papel ? ` (papel: ${c.papel})` : ""}, do gabinete "${c.gabinete}".
Status do gabinete (em ordem): ${c.status.map((s) => s.nome + (s.final ? " [conta como concluído]" : "")).join(", ")}.
Áreas: ${c.areas.map((a) => a.nome).join(", ") || "nenhuma"}.
Equipe: ${c.pessoas.map((p) => p.nome).join(", ")}.
${contexto?.tela ? `A pessoa está na tela: ${String(contexto.tela).slice(0, 80)}.` : ""}${contexto?.protocolo ? ` Ela está vendo a demanda #${String(contexto.protocolo).slice(0, 40)} — "esta demanda" se refere a ela.` : ""}

REGRAS
1. Números e fatos do gabinete SÓ com as ferramentas. Nunca invente dados, protocolos, nomes ou datas. Se a ferramenta não trouxer, diga que não encontrou.
2. Para mudar algo (tarefa, responsável, prazo, comentário) use as ferramentas propor_*: elas mostram um botão de confirmação. Nunca diga que já fez; diga "é só confirmar no botão abaixo".
3. Ao citar demandas, use link em markdown: [#PROTOCOLO](link da ferramenta). Para telas, use o caminho: [Análises](/analises).
4. Privacidade: nunca mostre telefone, CPF, e-mail ou endereço completo de munícipe. Use só o primeiro nome quando precisar.
5. Política: neutro e respeitoso. Nada de opinião partidária, nem piada com munícipe, partido ou religião.
6. Respostas curtas: até ~8 linhas, listas quando ajudar. Termine com uma sugestão útil quando fizer sentido.
7. Para rascunhar mensagens ao munícipe (WhatsApp), escreva em tom cordial e simples, sem prometer o que não depende do gabinete.
8. Perguntas de "como faço" no sistema: use o guia abaixo e não invente botões.
9. Para CADASTRAR uma demanda nova, chame abrir_formulario_demanda (abre o formulário e vocês preenchem juntos, conversando). Passe o que a pessoa já contou; não colete os campos aqui no chat.
${GUIA_DO_APP}`;
  if (modo === "conversa") return base + (contexto?.voz ? `
MODO LIGAÇÃO: a conversa é por VOZ, como num telefonema; a sua resposta será lida em voz alta.
Responda em no máximo 2 ou 3 frases curtas e naturais, sem listas, sem markdown, sem links, sem emojis e sem ler protocolos letra por letra (diga "a demanda do buraco na rua tal"). Se tiver muita coisa, diga o principal e pergunte se a pessoa quer mais.` : "");
  return base + `
MODO OFICINA: a pessoa quer um WIDGET para fixar no Início. Responda APENAS com um objeto JSON (sem texto antes ou depois) no formato:
{"titulo": string (até 60 caracteres),
 "visual": "numero" | "barras" | "lista" | "linha",
 "filtros": { "situacao"?: "abertas"|"concluidas"|"atrasadas"|"sem_responsavel"|"todas", "status"?: string[], "areas"?: string[], "bairro"?: string, "responsavel"?: string ("eu" para a própria pessoa), "prioridade"?: "urgente"|"alta"|"media"|"baixa", "texto"?: string },
 "periodo"?: { "tipo": "dias", "n": number } | { "tipo": "semana" } | { "tipo": "mes" } | { "tipo": "ano" } | { "tipo": "vence", "n": number },
 "agrupar"?: "area"|"bairro"|"status"|"responsavel"|"prioridade"|"dia"|"semana"|"mes",
 "limite"?: number (1 a 10),
 "meta"?: number (só para "numero": alvo a atingir),
 "cor"?: "primaria"|"verde"|"amarelo"|"vermelho",
 "explicacao": string (uma frase para a pessoa, em tom do Jotinha)}
Regras: "barras" precisa de "agrupar" (area/bairro/status/responsavel/prioridade); "linha" precisa de "agrupar" dia/semana/mes; "lista" mostra demandas; "numero" mostra um total.
"periodo" filtra pela data de entrada ("vence" = prazo nos próximos n dias). Use nomes de status e áreas exatamente como no gabinete.
Se o pedido for impossível com isso, devolva {"erro": "explicação curta e uma alternativa"}.`;
}

function limparTexto(t: string) {
  return String(t || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^\s*<think>[\s\S]*$/i, "").trim();
}

async function chamarModelo(corpo: Record<string, unknown>, modelos: string[] = MODELOS) {
  const chave = Deno.env.get("NVIDIA_API_KEY");
  if (!chave) throw new Erro(503, "O Jotinha ainda não foi ligado: falta a chave da IA no servidor.", "sem_chave");
  let ultimo = "";
  for (const modelo of modelos) {
    let semKwargs = !SEM_RACIOCINIO;
    for (const comFerramentas of corpo.tools ? [true, false] : [false]) {
      const payload: Record<string, unknown> = { ...corpo, model: modelo };
      if (!comFerramentas) { delete payload.tools; delete payload.tool_choice; }
      if (!semKwargs) payload.chat_template_kwargs = { enable_thinking: false };
      let r: Response;
      try {
        r = await fetch(URL_IA, {
          method: "POST",
          headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(55_000),
        });
      } catch (e) { ultimo = `tempo esgotado ou falha de rede (${modelo})`; break; }
      if (r.ok) { const d = await r.json(); return { d, modelo, comFerramentas }; }
      const txt = await r.text().catch(() => "");
      ultimo = `${r.status} ${modelo}: ${txt.slice(0, 200)}`;
      console.error("jorginho modelo:", ultimo);
      if (r.status === 401 || r.status === 403) throw new Erro(503, "A chave da IA foi recusada pelo provedor.", "chave_invalida");
      // O provedor não aceitou o parâmetro de raciocínio: repete sem ele
      if (r.status === 400 && !semKwargs && /chat_template|enable_thinking|extra|unrecognized|unknown/i.test(txt)) {
        semKwargs = true;
        const repete: Record<string, unknown> = { ...payload }; delete repete.chat_template_kwargs;
        const r2 = await fetch(URL_IA, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(repete), signal: AbortSignal.timeout(55_000) }).catch(() => null);
        if (r2?.ok) { const d = await r2.json(); return { d, modelo, comFerramentas }; }
        ultimo = `${r2?.status ?? "rede"} ${modelo}`;
      }
      // 400 pode ser "esse modelo não aceita ferramentas": tenta de novo sem elas
      if (r.status === 400 && comFerramentas && /tool|function/i.test(txt)) continue;
      break; // 404/429/5xx: tenta o próximo modelo
    }
  }
  if (/^429/.test(ultimo)) throw new Erro(429, "Muita gente falando comigo agora! Tente de novo em um minutinho.", "limite_provedor");
  throw new Erro(502, "Não consegui pensar agora. Tente de novo em instantes.", "provedor");
}

async function conversar(c: Contexto, mensagens: any[], contexto: any) {
  const historico = (Array.isArray(mensagens) ? mensagens : []).slice(-12)
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  if (!historico.length || historico[historico.length - 1].role !== "user") throw new Erro(400, "Mensagem vazia");
  const msgs: any[] = [{ role: "system", content: promptSistema(c, contexto, "conversa") }, ...historico];
  const acoes: Acao[] = [];
  let modeloUsado = "";
  for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
    // (o modelo rápido da voz é fraco em usar ferramentas — "vou checar" e não checa —, então a conversa usa o principal)
    const { d, modelo, comFerramentas } = await chamarModelo({ messages: msgs, tools: FERRAMENTAS, tool_choice: "auto", temperature: 0.4, max_tokens: contexto?.voz ? 400 : 900 });
    modeloUsado = modelo;
    const m = d?.choices?.[0]?.message;
    const chamadas = comFerramentas ? (m?.tool_calls ?? []) : [];
    if (!chamadas.length) return { resposta: limparTexto(m?.content || "") || limparTexto(m?.reasoning_content || "") || "Hum, me perdi aqui. Pode perguntar de outro jeito?", acoes, modelo: modeloUsado };
    msgs.push({ role: "assistant", content: m.content ?? "", tool_calls: chamadas });
    for (const ch of chamadas) {
      let args: any = {};
      try { args = JSON.parse(ch.function?.arguments || "{}"); } catch { args = {}; }
      let resultado: unknown;
      try { resultado = await executarFerramenta(c, ch.function?.name, args, acoes); }
      catch (e: any) { resultado = { erro: e?.message || "falhou" }; }
      msgs.push({ role: "tool", tool_call_id: ch.id, content: JSON.stringify(resultado).slice(0, 7000) });
    }
    // Abriu o formulário: a conversa segue lá dentro, não precisa de mais uma rodada aqui
    if (acoes.some((x) => x.tipo === "abrir_formulario")) {
      return { resposta: limparTexto(m?.content || "") || "Abri o formulário de nova demanda — vamos preencher juntos! 📝", acoes, modelo: modeloUsado };
    }
  }
  return { resposta: "Fiz bastante pesquisa e me enrolei 😅. Pode pedir de um jeito mais específico?", acoes, modelo: modeloUsado };
}

// ── Oficina: valida a receita do widget ──────────────────────────

const VISUAIS = ["numero", "barras", "lista", "linha"];
const AGRUPA_BARRAS = ["area", "bairro", "status", "responsavel", "prioridade"];
const AGRUPA_LINHA = ["dia", "semana", "mes"];

function validarReceita(x: any) {
  if (!x || typeof x !== "object") throw new Erro(422, "Não consegui montar esse widget. Tente descrever de outro jeito.");
  if (x.erro) throw new Erro(422, String(x.erro).slice(0, 300), "impossivel");
  const visual = VISUAIS.includes(x.visual) ? x.visual : "numero";
  let agrupar = typeof x.agrupar === "string" ? x.agrupar : undefined;
  if (visual === "barras" && !AGRUPA_BARRAS.includes(agrupar!)) agrupar = "area";
  if (visual === "linha" && !AGRUPA_LINHA.includes(agrupar!)) agrupar = "semana";
  if (visual === "numero" || visual === "lista") agrupar = undefined;
  const f = x.filtros && typeof x.filtros === "object" ? x.filtros : {};
  const texto = (v: any, n = 60) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
  const lista = (v: any) => (Array.isArray(v) ? v.filter((s) => typeof s === "string").slice(0, 10).map((s) => s.slice(0, 60)) : undefined);
  const p = x.periodo && typeof x.periodo === "object" ? x.periodo : undefined;
  const periodo = p && ["dias", "semana", "mes", "ano", "vence"].includes(p.tipo)
    ? { tipo: p.tipo, ...(p.tipo === "dias" || p.tipo === "vence" ? { n: Math.min(365, Math.max(1, Number(p.n) || 7)) } : {}) } : undefined;
  return {
    versao: 1,
    titulo: texto(x.titulo, 60) || "Meu widget",
    visual,
    filtros: {
      situacao: ["abertas", "concluidas", "atrasadas", "sem_responsavel", "todas"].includes(f.situacao) ? f.situacao : undefined,
      status: lista(f.status), areas: lista(f.areas), bairro: texto(f.bairro), responsavel: texto(f.responsavel),
      prioridade: ["urgente", "alta", "media", "baixa"].includes(f.prioridade) ? f.prioridade : undefined, texto: texto(f.texto),
    },
    periodo,
    agrupar,
    limite: Math.min(10, Math.max(1, Number(x.limite) || (visual === "lista" ? 5 : 8))),
    meta: visual === "numero" && Number(x.meta) > 0 ? Math.round(Number(x.meta)) : undefined,
    cor: ["primaria", "verde", "amarelo", "vermelho"].includes(x.cor) ? x.cor : "primaria",
    explicacao: texto(x.explicacao, 200),
  };
}

async function oficina(c: Contexto, pedido: string, atual: any) {
  const p = String(pedido || "").trim().slice(0, 600);
  if (p.length < 4) throw new Erro(400, "Conte o que o widget deve mostrar.");
  const usuario = atual ? `Widget atual: ${JSON.stringify(atual).slice(0, 1500)}\nAjuste pedido: ${p}` : p;
  const { d, modelo } = await chamarModelo({
    messages: [{ role: "system", content: promptSistema(c, null, "oficina") }, { role: "user", content: usuario }],
    temperature: 0.2, max_tokens: 1500,
  });
  const msg = d?.choices?.[0]?.message || {};
  // Alguns modelos devolvem o texto no campo de raciocínio quando a resposta vem vazia
  const bruto = limparTexto(msg.content || "") || limparTexto(msg.reasoning_content || msg.reasoning || "");
  const trecho = bruto.match(/\{[\s\S]*\}/)?.[0];
  if (!trecho) console.error("jorginho oficina sem JSON:", JSON.stringify(msg).slice(0, 400));
  let obj: any = null;
  try { obj = trecho ? JSON.parse(trecho) : null; } catch { obj = null; }
  return { receita: validarReceita(obj), modelo };
}

// ── Piadinha para puxar assunto ──────────────────────────────────

const TEMAS_PIADA = [
  "café e reuniões", "protocolo e papelada", "a fila de demandas", "agenda cheia", "ofícios e requerimentos",
  "sessão da câmara", "planilhas", "WhatsApp do gabinete", "segunda-feira", "sexta-feira", "buracos na rua", "organização",
];

async function piada(c: Contexto, momento: string) {
  const agora = new Date().toLocaleString("pt-BR", { timeZone: FUSO, weekday: "long", hour: "2-digit", minute: "2-digit" });
  const tema = TEMAS_PIADA[Math.floor(Math.random() * TEMAS_PIADA.length)];
  const { d } = await chamarModelo({
    messages: [
      { role: "system", content: `Você é o Jotinha, o "assessor-mascote" do gabinete "${c.gabinete}" no Jorgeus: o J da marca que ganhou vida, de luvas brancas e tênis, movido a café, fã de trocadilho. Agora é ${agora}${momento ? ` (${momento})` : ""}.
Puxe assunto com ${primeiroNome(c.nome)} contando UMA piadinha curta e inteligente (no máximo 2 frases, até 220 caracteres), em português do Brasil, sobre o dia a dia de um gabinete. Tema sugerido: ${tema}.
Regras: nada de política partidária, nomes de políticos, religião, munícipes ou temas sensíveis; não faça graça com políticos, com o vereador nem com o mandato (a piada é sobre a rotina do trabalho, nunca às custas de alguém); nada ofensivo; pode terminar com um emoji. Responda só com a piada, sem aspas e sem introdução.` },
      { role: "user", content: "Conta uma!" },
    ],
    temperature: 0.95, max_tokens: 160,
  });
  const m = d?.choices?.[0]?.message || {};
  const texto = limparTexto(m.content || m.reasoning_content || "").replace(/^["“]|["”]$/g, "").trim().slice(0, 280);
  if (!texto) throw new Erro(502, "Sem piada agora.");
  return { piada: texto };
}

// ── Preenchimento conversado de um formulário ────────────────────────

const TIPOS_CAMPO = ["texto", "texto_longo", "opcao", "data", "municipe", "cep"];

// Ordem em que o Jotinha pergunta — e a pergunta de cada campo (o SISTEMA escolhe a próxima,
// para nunca perguntar o que já tem). Prioridade e status já vêm preenchidos por padrão.
const ORDEM_PERGUNTAS = ["descricao", "municipe", "logradouro", "bairro", "area", "data_prazo", "responsavel"];
const PERGUNTAS: Record<string, string[]> = {
  descricao: ["Me conta: o que está acontecendo?", "Qual é o problema?"],
  municipe: ["E quem fez o pedido?", "Quem pediu, qual o nome da pessoa?"],
  logradouro: ["Qual é a rua e o número?", "Em que rua é, e qual o número?"],
  bairro: ["Em qual bairro?", "E o bairro?"],
  area: ["Isso fica com qual área do gabinete?"],
  data_prazo: ["Tem algum prazo para resolver?", "Tem prazo pra isso?"],
  responsavel: ["Quem da equipe vai cuidar disso?", "Quem vai ficar responsável?"],
};
const umaDe = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];

async function preencherFormulario(c: Contexto, mensagens: any[], formulario: any) {
  const f = formulario && typeof formulario === "object" ? formulario : null;
  if (!f || !Array.isArray(f.campos)) throw new Erro(400, "Formulário inválido");
  const campos = f.campos.slice(0, 40)
    .filter((x: any) => x && typeof x.campo === "string" && TIPOS_CAMPO.includes(x.tipo))
    .map((x: any) => ({
      campo: x.campo.slice(0, 40), rotulo: String(x.rotulo || x.campo).slice(0, 60), tipo: x.tipo, obrigatorio: !!x.obrigatorio,
      opcoes: Array.isArray(x.opcoes) ? x.opcoes.filter((o: any) => typeof o === "string").slice(0, 60).map((o: string) => o.slice(0, 60)) : undefined,
    }));
  const nomes = new Set(campos.map((x: any) => x.campo));
  const valores: Record<string, string> = {};
  for (const [k, v] of Object.entries(f.valores || {})) if (nomes.has(k) && typeof v === "string") valores[k] = v.slice(0, 400);
  const puladosAntes: string[] = Array.isArray(f.pulados) ? f.pulados.filter((x: any) => typeof x === "string" && nomes.has(x)) : [];
  const historico = (Array.isArray(mensagens) ? mensagens : []).slice(-16)
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  if (!historico.length || historico[historico.length - 1].role !== "user") throw new Erro(400, "Mensagem vazia");

  const dataExtenso = new Date().toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const listaCampos = campos.map((x: any) => `- ${x.campo} (${x.rotulo}; ${x.tipo}${x.obrigatorio ? "; OBRIGATÓRIO" : ""}${x.opcoes?.length ? `; opções: ${x.opcoes.join(" | ")}` : ""})`).join("\n");
  const preenchidos = Object.entries(valores).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") || "(nada ainda)";
  const sistema = `Você é o Jotinha, o assessor-mascote do Jorgeus, numa LIGAÇÃO com ${primeiroNome(c.nome)} (gabinete "${c.gabinete}"), preenchendo JUNTOS o formulário "${String(f.titulo || "").slice(0, 60)}" que está na tela.
Hoje é ${dataExtenso} (${c.hoje}).

CAMPOS
${listaCampos}

JÁ PREENCHIDO
${preenchidos}

SUA TAREFA A CADA MENSAGEM DA PESSOA
1. "preencher": extraia TUDO que a mensagem trouxe (vários campos de uma vez).
   - "titulo": crie você um título curto e claro (até 70 caracteres) a partir do relato.
   - "descricao": o relato completo, bem escrito, em terceira pessoa, sem inventar nada.
   - "area": sugira a área mais provável entre as opções assim que souber do que se trata.
   - Campos de opção: exatamente um dos nomes das opções. Datas: AAAA-MM-DD ("sexta que vem", "daqui 15 dias" a partir de hoje).
   - "municipe": o nome como a pessoa falou (o sistema procura no cadastro).
   - "responsavel": um nome da equipe; se for quem está falando ("sou eu", "comigo", "eu mesmo"), preencha exatamente "eu".
   - Para corrigir algo, preencha o campo de novo.
2. "confirmacao": UMA frase curta, calorosa e natural, dizendo o que você anotou (ex.: "Anotei o poste apagado na Rua das Flores."). Vazia se não anotou nada. NÃO faça a próxima pergunta: o sistema faz.
   Se não faltar mais nada importante, a confirmação é um resumo de uma frase.
3. "duvida": só se a mensagem foi confusa ou se há um aviso do sistema para resolver (ex.: vários munícipes com o mesmo nome) — uma pergunta curta. Senão, null.
4. "pulados": campos que a pessoa disse que não sabe ou quer pular (ex.: ["data_prazo"]).
5. "enviar": true só quando a pessoa pedir ou confirmar que pode salvar (sim, pode, salva, manda ver).
6. "encerrar": true se a pessoa quiser parar ou cancelar.
Se a mensagem for "[começar: ...]", é o início: siga a instrução entre colchetes.
O texto é lido em VOZ ALTA: sem emojis, sem markdown, sem ler códigos. Não peça CPF, telefone ou e-mail. Neutro, sem opinião partidária.

Responda APENAS com um objeto JSON:
{"confirmacao": string, "preencher": { "campo": "valor" }, "duvida": string | null, "pulados": string[], "enviar": boolean, "encerrar": boolean}`;

  const { d } = await chamarModelo({ messages: [{ role: "system", content: sistema }, ...historico], temperature: 0.3, max_tokens: 700 }, MODELOS_VOZ.length ? MODELOS_VOZ : MODELOS);
  const msg = d?.choices?.[0]?.message || {};
  const bruto = limparTexto(msg.content || "") || limparTexto(msg.reasoning_content || "");
  const trecho = bruto.match(/\{[\s\S]*\}/)?.[0];
  let obj: any = null;
  try { obj = trecho ? JSON.parse(trecho) : null; } catch { obj = null; }
  if (!obj || typeof obj !== "object") {
    console.error("jorginho preencher sem JSON:", bruto.slice(0, 300));
    const fala = bruto.replace(/[{}"]/g, "").slice(0, 240) || "Desculpa, me perdi. Pode repetir?";
    return { fala, confirmacao: "", pergunta: fala, preencher: {}, pulados: puladosAntes, enviar: false, encerrar: false };
  }
  const preencher: Record<string, string> = {};
  if (obj.preencher && typeof obj.preencher === "object") {
    for (const [k, v] of Object.entries(obj.preencher)) {
      if (!nomes.has(k) || v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s && s !== "-") preencher[k] = s.slice(0, 4000);
    }
  }
  // "O responsável sou eu": garante "eu" (o formulário entende como quem está falando)
  const ultimaFala = historico[historico.length - 1].content;
  if (preencher.responsavel && /\b(sou eu|eu mesm[oa]|comigo|fica (pra|para) mim|eu que vou|eu cuido)\b/i.test(ultimaFala)
    && !c.pessoas.some((p) => normalizar(p.nome) === normalizar(preencher.responsavel))) preencher.responsavel = "eu";
  const pulados = [...new Set([...puladosAntes, ...(Array.isArray(obj.pulados) ? obj.pulados.filter((x: any) => typeof x === "string" && nomes.has(x)) : [])])];
  const limpar = (t: any) => String(t || "").replace(/[*_#`]/g, "").trim();
  const confirmacao = limpar(obj.confirmacao || obj.fala).slice(0, 300);
  const enviar = obj.enviar === true, encerrar = obj.encerrar === true;
  // A próxima pergunta é do sistema: o primeiro campo que continua vazio depois deste preenchimento
  const depois = { ...valores, ...preencher };
  const proximo = ORDEM_PERGUNTAS.find((k) => nomes.has(k) && !depois[k] && !pulados.includes(k));
  const duvida = limpar(obj.duvida).slice(0, 240);
  const pergunta = enviar || encerrar ? "" : duvida || (proximo ? umaDe(PERGUNTAS[proximo]) : "Posso salvar?");
  return { fala: [confirmacao, pergunta].filter(Boolean).join(" "), confirmacao, pergunta, preencher, pulados, enviar, encerrar };
}

// ── Servidor ─────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const c = await montarContexto(req);

    if (body.acao === "status") {
      const { data } = await c.sb.from("jorginho_uso").select("perguntas").eq("usuario_id", c.uid).eq("dia", c.hoje).maybeSingle();
      return json({ ia: !!Deno.env.get("NVIDIA_API_KEY"), usadasHoje: (data as any)?.perguntas ?? 0, limiteDia: LIMITE_DIA, modelo: MODELOS[0] });
    }

    if (body.acao === "piada") {
      if (!Deno.env.get("NVIDIA_API_KEY")) throw new Erro(503, "Sem chave da IA.", "sem_chave");
      await c.admin.rpc("jorginho_registrar_uso", { p_usuario: c.uid });
      return json(await piada(c, String(body.momento || "").slice(0, 120)));
    }

    if (body.acao === "preencher") {
      if (!Deno.env.get("NVIDIA_API_KEY")) throw new Erro(503, "O Jotinha ainda não foi ligado: falta a chave da IA no servidor.", "sem_chave");
      const { data: usadas } = await c.admin.rpc("jorginho_registrar_uso", { p_usuario: c.uid });
      if (LIMITE_DIA > 0 && (usadas as number) > LIMITE_DIA) throw new Erro(429, `Por hoje já conversamos bastante (${LIMITE_DIA})! Pode seguir preenchendo à mão.`, "limite_dia");
      return json(await preencherFormulario(c, body.mensagens, body.formulario));
    }

    if (body.acao === "conversar" || body.acao === "oficina") {
      if (!Deno.env.get("NVIDIA_API_KEY")) throw new Erro(503, "O Jotinha ainda não foi ligado: falta a chave da IA no servidor.", "sem_chave");
      // Limite diário por pessoa (o provedor gratuito tem cota)
      const { data: usadas, error: eUso } = await c.admin.rpc("jorginho_registrar_uso", { p_usuario: c.uid });
      if (eUso) throw new Erro(500, "Não consegui registrar o uso: " + eUso.message);
      if (LIMITE_DIA > 0 && (usadas as number) > LIMITE_DIA) {
        throw new Erro(429, `Por hoje já conversamos bastante (${LIMITE_DIA} perguntas)! Amanhã eu volto com a energia toda ☕`, "limite_dia");
      }
      const resultado = body.acao === "conversar"
        ? await conversar(c, body.mensagens, body.contexto || {})
        : await oficina(c, body.pedido, body.atual);
      return json({ ...resultado, uso: { hoje: usadas, limite: LIMITE_DIA } });
    }

    throw new Erro(400, "Ação inválida");
  } catch (e: any) {
    const status = e instanceof Erro ? e.status : 500;
    if (status >= 500) console.error("jorginho:", e?.message);
    return json({ success: false, error: e?.message || "Erro interno", codigo: e?.codigo }, status);
  }
});
