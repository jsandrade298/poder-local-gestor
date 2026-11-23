// ============================================================
// confirm-user-email — DESATIVADA em 23/11/2026.
//
// Confirmava o e-mail de qualquer conta sem checar quem chamava.
// Nada no sistema a utilizava: as funções que criam usuários já
// criam com o e-mail confirmado (email_confirm: true).
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ success: false, error: "Função desativada" }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
