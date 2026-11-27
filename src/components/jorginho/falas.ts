/**
 * Falas do Jotinha que NÃO usam a IA (não gastam cota): cumprimentos,
 * dicas da tela em que a pessoa está, comemorações e "gracinhas" leves.
 * Regras do tom: nada partidário, nada sobre munícipes, sem cobrança.
 */

const sorteio = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export function cumprimento(nome: string) {
  const h = new Date().getHours();
  const n = nome ? `, ${nome}` : "";
  if (h < 5) return sorteio([`Madrugada${n}? Eu também não durmo, mas eu sou um mascote 😴`, `Tá tarde${n}! Que tal deixar o resto para amanhã?`]);
  if (h < 12) return sorteio([`Bom dia${n}! ☀️ Bora fazer a cidade andar?`, `Bom dia${n}! Café na mão e demanda na fila ☕`, `Bom dia${n}! Se precisar, é só me chamar.`]);
  if (h < 18) return sorteio([`Boa tarde${n}! Como está o ritmo por aí?`, `Boa tarde${n}! Me pergunte qualquer coisa do gabinete.`, `Boa tarde${n}! Precisando de uma mão, tô aqui 👋`]);
  return sorteio([`Boa noite${n}! Ainda no batente? 🌙`, `Boa noite${n}! Que tal um resumo do dia antes de sair?`]);
}

/** Dica por tela (aparece no máximo uma vez por dia em cada uma). */
export const DICAS: Record<string, string[]> = {
  "/inicio": [
    "Dica: me pergunte \"o que eu tenho amanhã?\" que eu olho sua agenda e suas tarefas.",
    "Sabia que dá para criar um widget só seu aqui no Início? Abra a Oficina comigo 🛠️",
  ],
  "/demandas": [
    "Quer saber quantas demandas de uma área estão atrasadas? É só me perguntar.",
    "Abrindo uma demanda, eu resumo a linha do tempo e rascunho a resposta ao munícipe.",
  ],
  "/municipes": ["Posso dizer quantas demandas um munícipe já trouxe — me fala o nome."],
  "/quadros": ["Me diga \"cria uma tarefa para sexta\" que eu deixo pronta para você confirmar."],
  "/agenda": ["Clique num horário vazio para criar um compromisso rapidinho. Ou me pergunte o que tem na semana."],
  "/analises": ["O botão Relatório gera um PDF caprichado para apresentar. Eu ajudaria a apresentar, mas não tenho pernas 😅"],
  "/mapa": ["No mapa dá para ver onde as demandas se concentram. Bairro preenchido ajuda muito!"],
};

export function dicaDaTela(caminho: string) {
  const chave = Object.keys(DICAS).find((k) => caminho === k || caminho.startsWith(k + "/"));
  return chave ? sorteio(DICAS[chave]) : null;
}

/** Brincadeiras leves para quando a pessoa clica nele sem pedir nada. */
export const GRACINHAS = [
  "Eu ia contar uma piada sobre burocracia, mas ela ainda está em análise. 📎",
  "Fato: toda demanda resolvida faz um munícipe sorrir. E um mascote também 😄",
  "Se eu tivesse um protocolo, seria #JORGINHO-001.",
  "Eu não tomo café, mas torço por quem toma ☕",
  "Organização é tipo academia: ninguém gosta no começo, todo mundo ama o resultado 💪",
  "Já pensou num quadro chamado \"coisas que eu juro que vou fazer hoje\"? Eu teria vários cartões.",
  "Meu hobby? Contar demandas concluídas. Meu sonho? Zerar as atrasadas.",
];

export const COMEMORACOES = {
  tarefa: ["Tarefa concluída! 🎉 Mais uma pra conta.", "Mandou bem! ✅ Uma a menos na lista.", "Isso aí! Riscou mais uma 🙌"],
  demanda: ["Demanda resolvida! Um munícipe mais feliz hoje 🎉", "Concluída! O gabinete agradece 👏"],
  cartao: ["Cartão na etapa final! 🏁", "Chegou lá! Mais um cartão concluído 🎯"],
};

export const comemorar = (tipo: keyof typeof COMEMORACOES) => sorteio(COMEMORACOES[tipo]);
export const gracinha = () => sorteio(GRACINHAS);
