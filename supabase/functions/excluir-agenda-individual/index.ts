// ============================================================
// excluir-agenda-individual — DESATIVADA em 24/11/2026
//
// Esta função apagava de vez uma agenda (com mensagens e acompanhantes)
// e era chamada por agendamentos do pg_cron, um por agenda. Problemas:
//   - aceitava chamadas sem login (verify_jwt = false): quem tivesse o
//     endereço e o id de uma agenda confirmada/recusada já passada podia
//     apagá-la;
//   - os agendamentos se repetiam todo ano e apagariam agendas existentes.
// Nada no app a usa; os agendamentos foram pausados na migração
// 20261124012322_pausar_agendamentos_parados.
//
// Agora ela não apaga nada e responde 410 (Gone). O código original está
// no histórico do git (commit anterior a este arquivo):
//   git log -- supabase/functions/excluir-agenda-individual/index.ts
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.warn("excluir-agenda-individual chamada, mas está desativada. Nada foi apagado.");

  return new Response(
    JSON.stringify({
      success: false,
      message: "Função desativada: agendas não são mais excluídas automaticamente.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
