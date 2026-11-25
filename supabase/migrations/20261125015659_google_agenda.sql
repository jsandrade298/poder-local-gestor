-- ============================================================
-- Google Agenda (25/11/2026)
--
-- Duas agendas por pessoa no Jorgeus:
--   - "mandato": a agenda do vereador, conectada uma vez por gabinete.
--     Toda a equipe vê; só quem o super admin escolher (agenda_editores)
--     cria, edita e exclui eventos.
--   - "pessoal": a conta Google de cada pessoa. Só o dono mexe; convites
--     recebidos podem ser aceitos/recusados.
--
-- Segurança: o token de renovação do Google fica no Vault (criptografado);
-- nenhuma tela lê estas tabelas diretamente — tudo passa pelas funções
-- do servidor (google-agenda, google-agenda-callback), com service role.
-- Nenhum registro existente é alterado.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.google_agenda_contas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('mandato', 'pessoal')),
  usuario_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE, -- dono (pessoal) ou quem conectou (mandato)
  google_email  text,
  token_id      uuid,          -- vault.secrets.id do refresh token
  calendarios   jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{id, nome, cor}] agendas escolhidas para aparecer
  conectado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS google_agenda_mandato_unico ON public.google_agenda_contas (tenant_id) WHERE tipo = 'mandato';
CREATE UNIQUE INDEX IF NOT EXISTS google_agenda_pessoal_unico ON public.google_agenda_contas (usuario_id) WHERE tipo = 'pessoal';
ALTER TABLE public.google_agenda_contas ENABLE ROW LEVEL SECURITY;  -- sem políticas: só o servidor

-- Pedidos de conexão em andamento (o "state" do OAuth): duram minutos
CREATE TABLE IF NOT EXISTS public.google_agenda_estados (
  estado      text PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  usuario_id  uuid NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('mandato', 'pessoal')),
  voltar_para text NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_agenda_estados ENABLE ROW LEVEL SECURITY;  -- sem políticas: só o servidor

-- Quem pode criar/editar/excluir na agenda do mandato (definido pelo super admin)
CREATE TABLE IF NOT EXISTS public.agenda_editores (
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  concedido_por uuid,
  concedido_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, usuario_id)
);
ALTER TABLE public.agenda_editores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenda_editores_ver ON public.agenda_editores;
CREATE POLICY agenda_editores_ver ON public.agenda_editores FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_my_tenant_id()) OR public.is_superadmin());
GRANT SELECT ON public.agenda_editores TO authenticated;

-- Super admin define os editores de um gabinete (substitui a lista)
CREATE OR REPLACE FUNCTION public.admin_definir_editores_agenda(p_tenant_id uuid, p_usuarios uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Apenas o super admin define quem edita a agenda'; END IF;
  DELETE FROM public.agenda_editores WHERE tenant_id = p_tenant_id AND NOT (usuario_id = ANY(coalesce(p_usuarios, '{}')));
  INSERT INTO public.agenda_editores (tenant_id, usuario_id, concedido_por)
    SELECT p_tenant_id, u, auth.uid() FROM unnest(coalesce(p_usuarios, '{}')) u
     WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u AND p.tenant_id = p_tenant_id)
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO n FROM public.agenda_editores WHERE tenant_id = p_tenant_id;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.admin_definir_editores_agenda(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_definir_editores_agenda(uuid, uuid[]) TO authenticated;

-- Token no Vault: só o servidor (service_role) grava e lê
CREATE OR REPLACE FUNCTION public.google_agenda_guardar_token(p_conta uuid, p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE atual uuid;
BEGIN
  SELECT token_id INTO atual FROM public.google_agenda_contas WHERE id = p_conta;
  IF atual IS NOT NULL AND EXISTS (SELECT 1 FROM vault.secrets WHERE id = atual) THEN
    PERFORM vault.update_secret(atual, p_token);
  ELSE
    atual := vault.create_secret(p_token, 'google_agenda_' || p_conta::text, 'Token do Google Agenda (Jorgeus)');
    UPDATE public.google_agenda_contas SET token_id = atual WHERE id = p_conta;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.google_agenda_ler_token(p_conta uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT s.decrypted_secret FROM public.google_agenda_contas c
    JOIN vault.decrypted_secrets s ON s.id = c.token_id
   WHERE c.id = p_conta;
$$;

CREATE OR REPLACE FUNCTION public.google_agenda_apagar_conta(p_conta uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE t uuid;
BEGIN
  SELECT token_id INTO t FROM public.google_agenda_contas WHERE id = p_conta;
  DELETE FROM public.google_agenda_contas WHERE id = p_conta;
  IF t IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = t; END IF;
END $$;

REVOKE ALL ON FUNCTION public.google_agenda_guardar_token(uuid, text), public.google_agenda_ler_token(uuid),
  public.google_agenda_apagar_conta(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.google_agenda_guardar_token(uuid, text), public.google_agenda_ler_token(uuid),
  public.google_agenda_apagar_conta(uuid) TO service_role;

-- Limpeza: pedidos de conexão abandonados (mais de 1 hora)
CREATE OR REPLACE FUNCTION public.google_agenda_limpar_estados()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.google_agenda_estados WHERE criado_em < now() - interval '1 hour';
$$;
REVOKE ALL ON FUNCTION public.google_agenda_limpar_estados() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.google_agenda_limpar_estados() TO service_role;
