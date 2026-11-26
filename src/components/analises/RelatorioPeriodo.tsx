import { useMemo, useState } from "react";
import { Check, Copy, Download, FileText, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { useAnalisesData } from "@/hooks/useAnalisesData";
import { useTema } from "@/lib/tema";
import { MarcaIcone } from "@/components/marca/Marca";

/**
 * Relatório do período: o documento completo em PDF (capa e páginas com a
 * identidade Jorgeus do gabinete — Brasil! ou Tech) e o resumo para o
 * WhatsApp. Usa os mesmos números da tela, com o período e os filtros escolhidos.
 */

type Dados = NonNullable<ReturnType<typeof useAnalisesData>["dados"]>;

const num = (x: number) => x.toLocaleString("pt-BR");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const dias = (x: number | null) => (x === null ? "–" : x < 1 ? `${Math.max(1, Math.round(x * 24))} h` : `${Math.round(x)} ${Math.round(x) === 1 ? "dia" : "dias"}`);

function montarTexto(d: Dados, gabinete: string, filtros: string) {
  const comp = (agora: number, antes?: number) => {
    if (antes === undefined || !d.comparacao) return "";
    const dif = agora - antes;
    return dif === 0 ? ` (igual ${d.comparacao.rotulo})` : ` (${dif > 0 ? "+" : ""}${num(dif)} em relação ${d.comparacao.rotulo})`;
  };
  const r = d.recebidas, pr = d.primeiraResposta, m = d.municipesAtendidos;
  const linhas: string[] = [
    `*Relatório do gabinete${gabinete ? ` · ${gabinete}` : ""}*`,
    `_${d.periodo.rotulo.charAt(0).toUpperCase() + d.periodo.rotulo.slice(1)}_${filtros ? `\n_Filtros: ${filtros}_` : ""}`,
    "",
    `📥 *Recebidas:* ${num(d.totais.entraram)}${comp(d.totais.entraram, d.comparacao?.entraram)}`,
    `✅ *Concluídas:* ${num(d.totais.concluidas)}${comp(d.totais.concluidas, d.comparacao?.concluidas)}`,
    d.totais.pctNoPrazo !== null ? `🎯 *No prazo:* ${pct(d.totais.pctNoPrazo)} das concluídas que tinham prazo` : "",
    d.totais.medianaDias !== null ? `⏱️ *Tempo até concluir (mediana):* ${dias(d.totais.medianaDias)}` : "",
    pr && pr.comResposta ? `💬 *Primeira resposta (mediana):* ${dias(pr.medianaDias)} · ${pct(pr.ate2Dias / Math.max(1, pr.base))} respondidas em até 2 dias` : "",
    pr && pr.semRespostaAbertas ? `🔕 *Ainda sem resposta:* ${num(pr.semRespostaAbertas)}` : "",
    `👥 *Munícipes atendidos:* ${num(m.pessoas)} (${num(m.primeiraVez)} pela primeira vez)`,
    `📌 *Situação das recebidas hoje:* ${num(r.concluidas)} concluídas · ${num(r.abertas)} em andamento${r.atrasadas ? ` · ${num(r.atrasadas)} atrasadas` : ""}`,
    `⚠️ *Atrasadas no gabinete (hoje):* ${num(d.atrasadasAbertas)}`,
  ].filter((l) => l !== "");
  if (d.porArea.length) {
    linhas.push("", "*Por área* (recebidas · concluídas)");
    d.porArea.slice(0, 8).forEach((a) => linhas.push(`• ${a.nome}: ${num(a.recebidas)} · ${num(a.concluidas)}`));
    if (d.porArea.length > 8) linhas.push(`• e mais ${d.porArea.length - 8} áreas`);
  }
  if (d.canais.length) {
    linhas.push("", "*Por onde chegaram*");
    d.canais.slice(0, 5).forEach((c) => linhas.push(`• ${c.nome}: ${num(c.valor)}`));
  }
  linhas.push("", "_Gerado no Jorgeus_");
  return linhas.join("\n");
}

export function RelatorioPeriodo({ dados, gabinete, filtros }: { dados: Dados; gabinete: string; filtros: string }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const { perfil } = useTema();
  const texto = useMemo(() => (aberto ? montarTexto(dados, gabinete, filtros) : ""), [aberto, dados, gabinete, filtros]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { toast.error("Não foi possível copiar. Selecione o texto e copie."); }
  };
  const baixarPdf = async () => {
    setGerando(true);
    try {
      const { gerarRelatorioPdf } = await import("./RelatorioPdf");
      const base = `relatorio-${gabinete || "gabinete"}-${dados.periodo.rotulo}`.normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await gerarRelatorioPdf(dados, { perfil, gabinete, filtros, nomeArquivo: `${base || "relatorio"}.pdf` });
      toast.success("Relatório em PDF baixado");
    } catch (e: any) {
      toast.error("Não foi possível gerar o PDF: " + (e?.message || "erro"));
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAberto(true)}>
        <FileText className="h-3.5 w-3.5" /> Relatório
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-xl max-h-[92vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Relatório do período</DialogTitle>
            <DialogDescription>
              {dados.periodo.rotulo.charAt(0).toUpperCase() + dados.periodo.rotulo.slice(1)}{filtros ? ` · ${filtros}` : ""}. Mude o período ou os filtros na tela antes, se precisar.
            </DialogDescription>
          </DialogHeader>

          {/* Documento em PDF */}
          <section className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-4">
            <div className="flex items-start gap-3">
              <MarcaIcone className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Relatório de Gestão em PDF</p>
                <p className="text-xs text-muted-foreground leading-snug">
                  Documento completo para apresentar: capa, resumo com destaques, demandas, áreas e prazos, munícipes, território e equipe —
                  com a identidade {perfil === "tech" ? "Tech" : "Brasil!"} do gabinete.
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={baixarPdf} disabled={gerando} className="gap-1.5">
                {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {gerando ? "Montando o PDF…" : "Baixar PDF"}
              </Button>
            </div>
          </section>

          {/* Resumo para WhatsApp */}
          <section className="flex min-h-0 flex-1 flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-muted-foreground" /> Resumo para o WhatsApp</p>
            <pre className="min-h-[8rem] flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-sans text-[13px] leading-relaxed [overflow-wrap:anywhere]">{texto}</pre>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"><Send className="h-4 w-4" /> Enviar no WhatsApp</a>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copiar}>{copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copiado ? "Copiado" : "Copiar texto"}</Button>
            </div>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
