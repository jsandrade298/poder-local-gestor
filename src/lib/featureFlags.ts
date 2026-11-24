/**
 * Funcionalidades ocultas da navegação.
 *
 * "Ocultar" aqui significa apenas esconder os pontos de entrada (menu, abas,
 * botões). Rotas, páginas, código e dados continuam existindo — quem tiver o
 * link direto ainda consegue abrir. Para reativar, basta trocar para `true`.
 */
export const FEATURES = {
  planoAcao: false,
  rotas: false,
  assessorIAWhatsApp: false,
  googleAgenda: false,
  assessorIA: false,
  disparosWhatsApp: false,
  // Substituídos pela tela Análises (Fase 2)
  visaoGeral: false,
  balancoDemandas: false,
  // Kanban antigo: tarefas e demandas foram trazidas para os Quadros em
  // 24/11/2026. As tabelas antigas não recebem mais nada; se reativar,
  // o que for feito lá NÃO aparece nos Quadros. Abre em /kanban-antigo.
  kanbanAntigo: false,
} as const;
