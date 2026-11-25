// Desativada em 25/11/2026: substituída por google-agenda e
// google-agenda-callback (conexão segura, token no Vault).
// A versão antiga aceitava um user_id qualquer sem conferir o login.
Deno.serve(() =>
  new Response(JSON.stringify({ error: "Função desativada. Use a nova integração do Google Agenda do Jorgeus." }), {
    status: 410,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
);
