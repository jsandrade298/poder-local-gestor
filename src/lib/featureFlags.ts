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
} as const;
