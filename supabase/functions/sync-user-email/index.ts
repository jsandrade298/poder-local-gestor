// ============================================================
// sync-user-email — DESATIVADA em 23/11/2026.
//
// Trocava o e-mail de qualquer conta sem checar quem chamava
// (bastava o UUID), o que permitia tomar a conta pela recuperação
// de senha. Nada no sistema a utilizava.
//
// Se a troca de e-mail voltar a ser necessária, reimplementar com a
// mesma checagem de reset-password (token verificado + admin do
// mesmo gabinete).
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
