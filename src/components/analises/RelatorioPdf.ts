import type { useAnalisesData } from "@/hooks/useAnalisesData";
import type { Perfil } from "@/lib/tema";

/**
 * Relatório de Gestão em PDF, com a identidade Jorgeus do gabinete
 * (Brasil! ou Tech). Monta as páginas A4 em HTML fora da tela, desenha
 * cada uma com html2canvas e junta no jsPDF. Sempre em fundo claro
 * (para imprimir bem), com capa escura.
 *
 * Páginas: capa · resumo e destaques · demandas (fluxo, funil, prioridade,
 * canais) · áreas e prazos · pessoas e território (munícipes, primeira
 * resposta, bairros, equipe).
 */

type Dados = NonNullable<ReturnType<typeof useAnalisesData>["dados"]>;

interface Paleta {
  nome: string;
  primaria: string; secundaria: string; terciaria: string; quarta: string;
  escuro: string; escuro2: string; claro: string; texto: string; suave: string; linha: string;
  gradiente: string;
}

const PALETAS: Record<Perfil, Paleta> = {
  brasil: {
    nome: "Brasil!",
    primaria: "#1D4ED8", secundaria: "#10B981", terciaria: "#EAB308", quarta: "#2563EB",
    escuro: "#08182B", escuro2: "#0F2A4D", claro: "#EEF3FF", texto: "#0B1B33", suave: "#5B6577", linha: "#E3E8EF",
    gradiente: "linear-gradient(90deg, #1D4ED8 0%, #10B981 55%, #EAB308 100%)",
  },
  tech: {
    nome: "Tech",
    primaria: "#7E22CE", secundaria: "#EC4899", terciaria: "#84CC16", quarta: "#2563EB",
    escuro: "#100B28", escuro2: "#22124A", claro: "#F4EEFC", texto: "#1A1033", suave: "#625B77", linha: "#E7E3F0",
    gradiente: "linear-gradient(90deg, #7E22CE 0%, #EC4899 50%, #2563EB 100%)",
  },
};

const num = (x: number) => x.toLocaleString("pt-BR");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const tempo = (d: number | null) => (d === null ? "–" : d < 1 ? `${Math.max(1, Math.round(d * 24))} h` : `${Math.round(d)} ${Math.round(d) === 1 ? "dia" : "dias"}`);
const esc = (t: string) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const L = 794, A = 1123; // A4 em px (96 dpi)

/** Frases curtas com o que mais importa no período (escritas a partir dos números). */
function destaques(d: Dados): string[] {
  const f: string[] = [];
  const t = d.totais, r = d.recebidas;
  if (d.comparacao) {
    const dif = t.entraram - d.comparacao.entraram;
    f.push(dif === 0 ? `Entraram <b>${num(t.entraram)}</b> demandas, o mesmo número do período anterior.`
      : `Entraram <b>${num(t.entraram)}</b> demandas, <b>${dif > 0 ? "+" : ""}${num(dif)}</b> em relação ${esc(d.comparacao.rotulo)}.`);
  } else f.push(`Entraram <b>${num(t.entraram)}</b> demandas no período.`);
  if (r.total) f.push(`<b>${pct(r.concluidas / r.total)}</b> das demandas recebidas já foram concluídas; <b>${num(r.abertas)}</b> seguem em andamento.`);
  const top = d.porArea.find((a) => a.id !== "sem");
  if (top && r.total) f.push(`A área com mais pedidos foi <b>${esc(top.nome)}</b>, com ${num(top.recebidas)} (${pct(top.recebidas / r.total)} do total).`);
  if (d.canais[0]) f.push(`O principal canal de entrada foi <b>${esc(d.canais[0].nome)}</b> (${num(d.canais[0].valor)}).`);
  if (d.primeiraResposta?.comResposta) f.push(`O primeiro retorno saiu em <b>${tempo(d.primeiraResposta.medianaDias)}</b> (mediana); ${pct(d.primeiraResposta.ate2Dias / Math.max(1, d.primeiraResposta.base))} foram respondidas em até 2 dias.`);
  if (d.municipesAtendidos.pessoas) f.push(`<b>${num(d.municipesAtendidos.pessoas)}</b> munícipes atendidos, ${num(d.municipesAtendidos.primeiraVez)} pela primeira vez.`);
  if (t.saldo !== 0) f.push(t.saldo > 0 ? `A fila cresceu em <b>${num(t.saldo)}</b>: entraram mais demandas do que foram concluídas.` : `A fila diminuiu em <b>${num(-t.saldo)}</b>: foram concluídas mais demandas do que entraram.`);
  if (d.atrasadasAbertas) {
    const mais90 = d.faixasAtraso[3]?.valor ?? 0;
    f.push(`Hoje há <b>${num(d.atrasadasAbertas)}</b> demandas com o prazo vencido no gabinete${mais90 ? `, ${num(mais90)} delas há mais de 90 dias` : ""}.`);
  }
  return f.slice(0, 7);
}

function montarPaginas(d: Dados, p: Paleta, perfil: Perfil, gabinete: string, filtros: string, gerado: string) {
  const periodo = maiuscula(d.periodo.rotulo);
  const total = 5;
  const css = `
    .pg{width:${L}px;height:${A}px;position:relative;overflow:hidden;background:#fff;color:${p.texto};font-family:'Inter',system-ui,sans-serif;font-size:12.5px;line-height:1.5}
    .pg *{box-sizing:border-box}
    .tit{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:800;letter-spacing:-0.01em}
    .etq{font-family:'Michroma','Inter',sans-serif;letter-spacing:.18em;text-transform:uppercase;font-size:9px}
    .barra{height:6px;background:${p.gradiente}}
    .cab{display:flex;align-items:center;justify-content:space-between;padding:22px 44px 0}
    .cab img{height:18px}
    .cab .dir{font-size:10px;color:${p.suave};text-align:right}
    .corpo{padding:20px 44px 0}
    .secao{display:flex;align-items:baseline;gap:10px;margin:0 0 12px}
    .secao .n{font-family:'Michroma',sans-serif;font-size:11px;color:${p.primaria}}
    .secao h2{font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:800;margin:0}
    .sub{color:${p.suave};font-size:11px;margin:-6px 0 14px}
    .card{border:1px solid ${p.linha};border-radius:14px;padding:14px 16px;background:#fff;break-inside:avoid}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    .kpi .r{font-size:10px;color:${p.suave}}
    .kpi .v{font-family:'Plus Jakarta Sans',sans-serif;font-size:26px;font-weight:800;line-height:1.1;margin-top:2px}
    .kpi .d{font-size:10px;color:${p.suave};margin-top:2px}
    .alerta{color:#DC2626}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    h3{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;margin:0 0 8px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:${p.suave};font-weight:600;text-align:left;padding:6px 8px;border-bottom:1.5px solid ${p.linha}}
    td{padding:7px 8px;border-bottom:1px solid ${p.linha}}
    tr:nth-child(even) td{background:${p.claro}66}
    .nr{text-align:right;font-variant-numeric:tabular-nums}
    .barras .l{display:grid;grid-template-columns:128px 1fr 70px;align-items:center;gap:10px;margin:0;padding:5px 0;font-size:12px;break-inside:avoid}
    .barras .t{height:11px;border-radius:11px;background:${p.claro}}
    .barras .f{height:11px;border-radius:11px}
    .barras .nome{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rod{position:absolute;left:44px;right:44px;bottom:22px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:${p.suave};border-top:1px solid ${p.linha};padding-top:8px}
    .rod img{height:12px}
    .dest .it{display:flex;gap:10px;align-items:flex-start;margin:0 0 8px;font-size:13px}
    .dest .pt{flex:none;width:7px;height:7px;border-radius:50%;margin-top:7px}
    .pill{display:inline-block;padding:5px 12px;border-radius:999px;font-weight:600}
  `;

  const cab = (titulo: string) => `
    <div class="barra"></div>
    <div class="cab"><img src="/brand/${perfil}-palavra-claro.png" alt="" /><div class="dir"><b>${esc(titulo)}</b><br/>${esc(gabinete || "Gabinete")} · ${esc(periodo)}</div></div>`;
  const rod = (n: number) => `<div class="rod"><span>Relatório de Gestão · ${esc(gabinete || "Gabinete")} · gerado em ${esc(gerado)}</span><span><img src="/brand/${perfil}-icone.png" alt="" style="vertical-align:middle;margin-right:6px"/>Página ${n} de ${total}</span></div>`;
  const kpi = (r: string, v: string, det = "", alerta = false) => `<div class="card kpi"><div class="r">${esc(r)}</div><div class="v${alerta ? " alerta" : ""}">${esc(v)}</div>${det ? `<div class="d">${det}</div>` : ""}</div>`;
  const barras = (itens: { nome: string; valor: number; cor?: string }[], totalRef?: number) => {
    const max = Math.max(...itens.map((i) => i.valor), 1);
    return `<div class="barras">${itens.map((i) => `<div class="l"><span class="nome" title="${esc(i.nome)}">${esc(i.nome)}</span><span class="t"><span class="f" style="display:block;width:${Math.max(2, (i.valor / max) * 100)}%;background:${i.cor || p.primaria}"></span></span><span class="nr"><b>${num(i.valor)}</b>${totalRef ? ` <span style="color:${p.suave}">${pct(i.valor / totalRef)}</span>` : ""}</span></div>`).join("") || `<p style="color:${p.suave}">Sem dados no período.</p>`}</div>`;
  };
  const comp = (agora: number, antes?: number) => {
    if (antes === undefined || !d.comparacao) return "";
    const dif = agora - antes;
    return dif === 0 ? "igual ao período anterior" : `<b style="color:${dif > 0 ? p.secundaria : "#DC2626"}">${dif > 0 ? "▲" : "▼"} ${num(Math.abs(dif))}</b> vs. anterior (${num(antes)})`;
  };
  const t = d.totais, r = d.recebidas, pr = d.primeiraResposta, m = d.municipesAtendidos;

  // ── Capa ──
  const capa = `
  <section class="pg" style="background:${p.escuro};color:#fff">
    <div style="position:absolute;width:620px;height:620px;border-radius:50%;right:-220px;top:-180px;background:linear-gradient(135deg, ${p.primaria}, ${p.escuro2});opacity:.9"></div>
    <div style="position:absolute;width:380px;height:380px;border-radius:50%;right:120px;top:300px;background:linear-gradient(135deg, ${p.secundaria}, transparent);opacity:.55"></div>
    <div style="position:absolute;width:260px;height:260px;border-radius:50%;left:-90px;bottom:120px;background:linear-gradient(135deg, ${p.terciaria}, transparent);opacity:.35"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:10px;background:${p.gradiente}"></div>
    <div style="position:relative;padding:56px 56px 0">
      <img src="/brand/${perfil}-logo-escuro.png" alt="" style="height:88px" />
    </div>
    <div style="position:absolute;left:56px;right:56px;top:390px">
      <div class="etq" style="color:#ffffffb3;font-size:11px">Relatório de gestão</div>
      <div class="tit" style="font-size:44px;line-height:1.08;margin-top:14px">${esc(gabinete || "Gabinete")}</div>
      <div style="margin-top:18px"><span class="pill" style="background:#ffffff1f;border:1px solid #ffffff40;font-size:14px">${esc(periodo)}</span></div>
      ${filtros ? `<div style="margin-top:10px;font-size:12px;color:#ffffffb3">Filtros: ${esc(filtros)}</div>` : ""}
    </div>
    <div style="position:absolute;left:56px;right:56px;bottom:96px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
      ${[["Demandas recebidas", num(t.entraram)], ["Concluídas", num(t.concluidas)], ["Munícipes atendidos", num(m.pessoas)], ["Concluídas no prazo", t.pctNoPrazo === null ? "–" : pct(t.pctNoPrazo)]]
        .map(([rr, v]) => `<div style="border-top:2px solid #ffffff55;padding-top:10px"><div class="tit" style="font-size:34px">${esc(v)}</div><div style="font-size:11px;color:#ffffffb3;margin-top:2px">${esc(rr)}</div></div>`).join("")}
    </div>
    <div style="position:absolute;left:56px;right:56px;bottom:34px;display:flex;justify-content:space-between;font-size:10px;color:#ffffff8c">
      <span>Gerado em ${esc(gerado)}</span><span>Jorgeus · Gestão e Inteligência Parlamentar</span>
    </div>
  </section>`;

  // ── 1. Resumo ──
  const resumo = `
  <section class="pg">${cab("Resumo do período")}
    <div class="corpo">
      <div class="secao"><span class="n">01</span><h2>Resumo do período</h2></div>
      <p class="sub">${esc(periodo)}. Os números consideram as demandas que entraram no período${filtros ? ` e os filtros: ${esc(filtros)}` : ""}.</p>
      <div class="kpis">
        ${kpi("Demandas recebidas", num(t.entraram), comp(t.entraram, d.comparacao?.entraram))}
        ${kpi("Concluídas", num(t.concluidas), comp(t.concluidas, d.comparacao?.concluidas))}
        ${kpi("Saldo da fila", (t.saldo > 0 ? "+" : "") + num(t.saldo), t.saldo > 0 ? "a fila cresceu" : t.saldo < 0 ? "a fila diminuiu" : "fila estável", t.saldo > 0)}
        ${kpi("Concluídas no prazo", t.pctNoPrazo === null ? "–" : pct(t.pctNoPrazo), t.baseNoPrazo ? `de ${num(t.baseNoPrazo)} com prazo` : "nenhuma com prazo")}
        ${kpi("Tempo até concluir", tempo(t.medianaDias), "mediana")}
        ${kpi("Primeira resposta", pr ? tempo(pr.medianaDias) : "–", pr && pr.base ? `${pct(pr.ate2Dias / pr.base)} em até 2 dias` : "")}
        ${kpi("Sem resposta", pr ? num(pr.semRespostaAbertas) : "–", "recebidas e ainda em aberto", !!pr?.semRespostaAbertas)}
        ${kpi("Atrasadas hoje", num(d.atrasadasAbertas), "no gabinete todo", d.atrasadasAbertas > 0)}
      </div>
      <div class="card" style="margin-top:18px;background:${p.claro};border-color:transparent;padding:16px 18px">
        <h3 style="color:${p.primaria};font-size:14px">Destaques</h3>
        <div class="dest">${destaques(d).map((x) => `<div class="it"><span class="pt" style="background:${p.primaria}"></span><span>${x}</span></div>`).join("")}</div>
      </div>
      <div class="card" style="margin-top:18px"><h3>Entrada e conclusão por ${d.escala === "mes" ? "mês" : d.escala === "dia" ? "dia" : "semana"}</h3>
        <div style="display:flex;gap:16px;font-size:11px;color:${p.suave};margin-bottom:6px">
          <span><span style="display:inline-block;width:16px;height:3px;background:${p.primaria};vertical-align:middle;margin-right:5px"></span>Entraram</span>
          <span><span style="display:inline-block;width:16px;height:3px;background:${p.secundaria};vertical-align:middle;margin-right:5px"></span>Concluídas</span>
        </div>
        <canvas data-grafico="fluxo" width="${(L - 122) * 2}" height="${250 * 2}" style="width:${L - 122}px;height:250px"></canvas>
        <p style="font-size:10px;color:${p.suave};margin:6px 0 0">Se a linha de entrada fica acima da de conclusão, a fila está crescendo.</p>
      </div>
    </div>${rod(2)}
  </section>`;

  // ── 2. Demandas ──
  const totalFunil = r.total || 1;
  const demandas = `
  <section class="pg">${cab("Demandas")}
    <div class="corpo">
      <div class="secao"><span class="n">02</span><h2>Demandas</h2></div>
      <p class="sub">Onde estão hoje as demandas que entraram no período, e por onde elas chegaram.</p>
      <div class="grid2">
        <div class="card"><h3>Recebidas por status (hoje)</h3>${barras(d.funilRecebidas.filter((f) => f.valor > 0).map((f) => ({ nome: f.nome + (f.final ? " ✓" : ""), valor: f.valor, cor: f.cor })), totalFunil)}
          <p style="font-size:10px;color:${p.suave};margin:8px 0 0">✓ = status que conta como concluído.</p></div>
        <div class="card"><h3>Situação das recebidas</h3>
          ${barras([
            { nome: "Concluídas", valor: r.concluidas, cor: p.secundaria },
            { nome: "Em andamento", valor: r.abertas - r.atrasadas, cor: p.primaria },
            { nome: "Atrasadas", valor: r.atrasadas, cor: "#DC2626" },
          ], r.total)}
          <table style="margin-top:10px"><tbody>
            <tr><td>Em aberto sem responsável</td><td class="nr"><b>${num(r.semResponsavel)}</b></td></tr>
            <tr><td>Em aberto sem prazo definido</td><td class="nr"><b>${num(r.semPrazo)}</b></td></tr>
          </tbody></table>
        </div>
      </div>
      <div class="grid2" style="margin-top:16px">
        <div class="card"><h3>Por prioridade</h3>${barras(d.prioridades.map((x) => ({ ...x, cor: x.nome === "Urgente" ? "#DC2626" : x.nome === "Alta" ? "#F97316" : x.nome === "Média" ? p.primaria : p.suave })), totalFunil)}</div>
        <div class="card"><h3>Por onde chegaram</h3>${barras(d.canais.slice(0, 6).map((c) => ({ ...c, cor: p.quarta })), totalFunil)}</div>
      </div>
      <div class="card" style="margin-top:16px"><h3>Bairros com mais demandas</h3>${d.coberturaBairro.fracao < 0.2
        ? `<p style="font-size:12px;color:${p.suave};margin:0">Só ${pct(d.coberturaBairro.fracao)} das demandas do período têm bairro preenchido — pouco para um retrato confiável do território. Preencher o bairro ao registrar a demanda melhora esta parte do relatório.</p>`
        : `<div style="columns:2;column-gap:28px">${barras(d.bairros.slice(0, 10).map((b) => ({ ...b, cor: p.secundaria })))}</div>`}</div>
      <div class="card" style="margin-top:16px;background:${p.claro};border-color:transparent"><h3>No total do gabinete</h3>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
          ${[["Demandas registradas", num(d.geral.demandas), `desde ${d.geral.desde}`], ["Concluídas", num(d.geral.concluidas), pct(d.geral.pctConcluidas) + " do total"], ["Abertas hoje", num(d.geral.abertas), ""], ["Munícipes cadastrados", d.geral.municipes === null ? "–" : num(d.geral.municipes), ""]]
            .map(([rr, v, det]) => `<div><div style="font-size:10.5px;color:${p.suave}">${esc(rr)}</div><div class="tit" style="font-size:22px">${esc(v)}</div>${det ? `<div style="font-size:10px;color:${p.suave}">${esc(det)}</div>` : ""}</div>`).join("")}
        </div>
      </div>
    </div>${rod(3)}
  </section>`;

  // ── 3. Áreas e prazos ──
  const areas = d.porArea.slice(0, 16);
  const prazos = `
  <section class="pg">${cab("Áreas e prazos")}
    <div class="corpo">
      <div class="secao"><span class="n">03</span><h2>Áreas e prazos</h2></div>
      <p class="sub">Demandas recebidas no período por área e como estão hoje.</p>
      <div class="card" style="padding:6px 6px 2px">
        <table><thead><tr><th>Área</th><th>Recebidas</th><th class="nr">Concluídas</th><th class="nr">Em aberto</th><th class="nr">Atrasadas</th><th class="nr">% concluída</th></tr></thead>
        <tbody>${(() => { const mx = Math.max(1, ...areas.map((a) => a.recebidas)); return areas.map((a) => `<tr><td>${esc(a.nome)}</td><td><span style="display:inline-block;height:8px;border-radius:8px;vertical-align:middle;margin-right:6px;width:${Math.max(4, (a.recebidas / mx) * 110)}px;background:${p.primaria}"></span><b>${num(a.recebidas)}</b></td><td class="nr">${num(a.concluidas)}</td><td class="nr">${num(a.abertas)}</td><td class="nr" style="${a.atrasadas ? "color:#DC2626;font-weight:600" : ""}">${num(a.atrasadas)}</td><td class="nr">${pct(a.concluidas / a.recebidas)}</td></tr>`).join(""); })() || `<tr><td colspan="6" style="color:${p.suave}">Nenhuma demanda no período.</td></tr>`}</tbody></table>
        ${d.porArea.length > areas.length ? `<p style="font-size:10px;color:${p.suave};margin:6px 8px">e mais ${d.porArea.length - areas.length} áreas</p>` : ""}
      </div>
      <div class="card" style="margin-top:16px"><h3>Prazo vencido, por tempo de atraso</h3>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:4px">
          ${d.faixasAtraso.map((f, i) => `<div style="border-radius:12px;padding:12px 8px;text-align:center;background:${["#FEF3C7", "#FFEDD5", "#FEE2E2", "#FECACA"][i]}"><div class="tit" style="font-size:28px">${num(f.valor)}</div><div style="font-size:10.5px;color:${p.suave}">${esc(f.rotulo)}</div></div>`).join("")}
        </div>
        <p style="font-size:10px;color:${p.suave};margin:8px 0 0">Demandas em aberto no gabinete todo, com o prazo vencido hoje (${num(d.atrasadasAbertas)} no total). Cada demanda conta em uma faixa só.</p>
      </div>
      <div class="card" style="margin-top:16px"><h3>Atrasos por área</h3><div style="columns:2;column-gap:28px">${barras(d.atrasoPorArea.slice(0, 10).map((x) => ({ ...x, cor: "#DC2626" })))}</div></div>
    </div>${rod(4)}
  </section>`;

  // ── 4. Pessoas e equipe ──
  const equipe = d.equipe.slice(0, 14);
  const pessoas = `
  <section class="pg">${cab("Pessoas e equipe")}
    <div class="corpo">
      <div class="secao"><span class="n">04</span><h2>Pessoas e equipe</h2></div>
      <p class="sub">Quem foi atendido, quanto tempo levou o primeiro retorno e como está a carga da equipe.</p>
      <div class="kpis">
        ${kpi("Munícipes atendidos", num(m.pessoas), "pessoas diferentes")}
        ${kpi("Primeira vez", num(m.primeiraVez), "nunca tinham sido atendidas")}
        ${kpi("Já atendidas antes", num(m.jaAtendidosAntes), "voltaram ao gabinete")}
        ${kpi("Mais de uma demanda", num(m.comMaisDeUma), "no mesmo período")}
      </div>
      <div class="grid2" style="margin-top:16px">
        <div class="card"><h3>Primeira resposta</h3>
          ${pr && pr.base ? `<table><tbody>
            <tr><td>Tempo até o primeiro retorno (mediana)</td><td class="nr"><b>${tempo(pr.medianaDias)}</b></td></tr>
            <tr><td>Respondidas em até 2 dias</td><td class="nr"><b>${pct(pr.ate2Dias / pr.base)}</b></td></tr>
            <tr><td>Já tiveram alguma resposta</td><td class="nr"><b>${num(pr.comResposta)}</b> de ${num(pr.base)}</td></tr>
            <tr><td>Em aberto, ainda sem resposta</td><td class="nr" style="${pr.semRespostaAbertas ? "color:#DC2626;font-weight:600" : ""}">${num(pr.semRespostaAbertas)}</td></tr>
          </tbody></table>` : `<p style="font-size:12px;color:${p.suave}">Nenhuma demanda no período.</p>`}
          <p style="font-size:10px;color:${p.suave};margin:8px 0 0">Primeira resposta = primeira atividade registrada na demanda (comentário ou atualização).</p>
        </div>
        <div class="card"><h3>Quem trouxe mais de uma demanda</h3>
          ${m.top.length ? `<table><tbody>${m.top.slice(0, 6).map((x) => `<tr><td>${esc(x.nome)}</td><td class="nr"><b>${num(x.valor)}</b> demandas</td></tr>`).join("")}</tbody></table>`
            : `<p style="font-size:12px;color:${p.suave};margin:0">${m.pessoas ? "Cada pessoa trouxe uma demanda no período." : "Nenhum atendimento no período."}</p>`}
        </div>
      </div>
      <div class="card" style="margin-top:16px;padding:6px 6px 2px">
        <h3 style="margin:8px 8px 4px">Equipe</h3>
        <table><thead><tr><th>Pessoa</th><th>Demandas abertas</th><th class="nr">Atrasadas</th><th class="nr">Concluídas no período</th></tr></thead>
        <tbody>${(() => { const mx = Math.max(1, ...equipe.map((e) => e.abertas)); return equipe.map((e) => `<tr><td>${esc(e.nome)}</td><td><span style="display:inline-block;height:8px;border-radius:8px;vertical-align:middle;margin-right:6px;width:${Math.max(4, (e.abertas / mx) * 120)}px;background:${p.primaria}"></span><b>${num(e.abertas)}</b></td><td class="nr" style="${e.atrasadas ? "color:#DC2626;font-weight:600" : ""}">${num(e.atrasadas)}</td><td class="nr">${num(e.concluidas)}</td></tr>`).join(""); })() || `<tr><td colspan="4" style="color:${p.suave}">Nenhuma demanda com responsável.</td></tr>`}</tbody></table>
        ${d.semResponsavel ? `<p style="font-size:10px;color:${p.suave};margin:6px 8px">${num(d.semResponsavel)} demandas em aberto estão sem responsável.</p>` : ""}
      </div>
      ${d.concluidasEstimadas ? `<p style="font-size:9.5px;color:${p.suave};margin-top:12px">Nota: ${num(d.concluidasEstimadas)} das conclusões do período têm data estimada (concluídas antes de o sistema registrar a data de conclusão, em 26/11/2026).</p>` : ""}
    </div>${rod(5)}
  </section>`;

  return { css, html: capa + resumo + demandas + prazos + pessoas };
}

/** Gráfico de linhas (entrada × conclusão) desenhado direto no canvas da página. */
function desenharFluxo(c: HTMLCanvasElement, d: Dados, p: Paleta) {
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const W = c.width, H = c.height, s = 2;
  const m = { e: 36 * s, d: 8 * s, t: 10 * s, b: 22 * s };
  const pts = d.fluxo;
  const max = Math.max(1, ...pts.flatMap((x) => [x.entrada ?? 0, x.conclusao ?? 0]));
  const x = (i: number) => m.e + (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * (W - m.e - m.d));
  const y = (v: number) => H - m.b - (v / max) * (H - m.t - m.b);
  ctx.font = `${11 * s}px Inter, sans-serif`;
  ctx.fillStyle = p.suave; ctx.strokeStyle = p.linha; ctx.lineWidth = 1 * s;
  for (let k = 0; k <= 4; k++) {
    const v = Math.round((max * k) / 4);
    ctx.beginPath(); ctx.moveTo(m.e, y(v)); ctx.lineTo(W - m.d, y(v)); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText(String(v), m.e - 6 * s, y(v) + 3 * s);
  }
  const passo = Math.max(1, Math.ceil(pts.length / 10));
  ctx.textAlign = "center";
  pts.forEach((pt, i) => { if (i % passo === 0 || i === pts.length - 1) ctx.fillText(pt.rotulo, x(i), H - 6 * s); });
  const linha = (campo: "entrada" | "conclusao", cor: string) => {
    ctx.strokeStyle = cor; ctx.lineWidth = 2.5 * s; ctx.lineJoin = "round"; ctx.beginPath();
    let comecou = false;
    pts.forEach((pt, i) => {
      const v = pt[campo];
      if (v === null || v === undefined) return;
      if (!comecou) { ctx.moveTo(x(i), y(v)); comecou = true; } else ctx.lineTo(x(i), y(v));
    });
    ctx.stroke();
    if (pts.length <= 31) pts.forEach((pt, i) => { const v = pt[campo]; if (v === null || v === undefined) return; ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(x(i), y(v), 2.6 * s, 0, Math.PI * 2); ctx.fill(); });
  };
  linha("entrada", p.primaria);
  linha("conclusao", p.secundaria);
}

export async function gerarRelatorioPdf(d: Dados, opcoes: { perfil: Perfil; gabinete: string; filtros: string; nomeArquivo: string }) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const p = PALETAS[opcoes.perfil];
  const gerado = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const { css, html } = montarPaginas(d, p, opcoes.perfil, opcoes.gabinete, opcoes.filtros, gerado);

  // Fora da tela, mas no mesmo documento (fontes e imagens já carregadas)
  const caixa = document.createElement("div");
  caixa.setAttribute("aria-hidden", "true");
  caixa.style.cssText = `position:fixed;left:-${L + 4000}px;top:0;width:${L}px;z-index:-1;pointer-events:none`;
  caixa.innerHTML = `<style>${css}</style>${html}`;
  document.body.appendChild(caixa);
  try {
    caixa.querySelectorAll<HTMLCanvasElement>('canvas[data-grafico="fluxo"]').forEach((c) => desenharFluxo(c, d, p));
    await Promise.all(Array.from(caixa.querySelectorAll("img")).map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null); }))));
    try { await (document as any).fonts?.ready; } catch { /* segue com as fontes do sistema */ }

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const paginas = Array.from(caixa.querySelectorAll<HTMLElement>("section.pg"));
    for (let i = 0; i < paginas.length; i++) {
      const canvas = await html2canvas(paginas[i], { scale: 2, useCORS: true, backgroundColor: null, logging: false, width: L, height: A, windowWidth: L });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }
    pdf.setProperties({ title: `Relatório de Gestão — ${opcoes.gabinete}`, subject: d.periodo.rotulo, creator: "Jorgeus" });
    pdf.save(opcoes.nomeArquivo);
  } finally {
    caixa.remove();
  }
}
