-- ============================================================
-- Busca normalizada — munícipes e demandas
--
-- Cria uma coluna `busca` em municipes e demandas com o texto dos
-- campos pesquisáveis já normalizado (minúsculas, sem acento) e o
-- telefone/CPF só com dígitos. O app filtra com uma condição
-- `busca ILIKE '%palavra%'` por palavra digitada, então:
--   - "joao silva" acha "João da Silva" (acento, maiúsculas, ordem)
--   - "(11) 99999-1111" e "11999991111" acham o mesmo munícipe
--   - buscar demanda pelo nome do munícipe não precisa mais colar
--     uma lista de IDs na URL
--
-- A coluna é mantida por trigger. Atualizações que só recalculam
-- `busca` NÃO mudam `updated_at` (usado no tempo até conclusão) e
-- não disparam avisos: os triggers de notificação de demanda só
-- agem quando o status muda.
-- ============================================================

-- 1. Normalização: minúsculas e sem acento (IMMUTABLE, sem extensão)
CREATE OR REPLACE FUNCTION public.normalizar_busca(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT lower(translate(
    coalesce(t, ''),
    'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
  ));
$$;


-- 2. Colunas
ALTER TABLE public.municipes ADD COLUMN IF NOT EXISTS busca text;
ALTER TABLE public.demandas  ADD COLUMN IF NOT EXISTS busca text;


-- 3. Munícipes: nome, e-mail, CPF, bairro, endereço, cidade + dígitos do telefone e CPF
CREATE OR REPLACE FUNCTION public.municipes_atualizar_busca()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.busca := concat_ws(' ',
    public.normalizar_busca(concat_ws(' ', NEW.nome, NEW.email, NEW.cpf, NEW.bairro, NEW.endereco, NEW.cidade)),
    nullif(regexp_replace(coalesce(NEW.telefone, ''), '\D', '', 'g'), ''),
    nullif(regexp_replace(coalesce(NEW.cpf, ''), '\D', '', 'g'), '')
  );

  -- Se a única mudança foi o recálculo da busca, preserva updated_at
  -- (o trigger update_municipes_updated_at roda antes deste: ordem alfabética)
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - 'busca' - 'updated_at') = (to_jsonb(OLD) - 'busca' - 'updated_at') THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_municipes_busca ON public.municipes;
CREATE TRIGGER zz_municipes_busca
  BEFORE INSERT OR UPDATE ON public.municipes
  FOR EACH ROW EXECUTE FUNCTION public.municipes_atualizar_busca();


-- 4. Demandas: protocolo, título, descrição, endereço + nome do munícipe
--    SECURITY DEFINER só para ler o nome do munícipe vinculado.
CREATE OR REPLACE FUNCTION public.demandas_atualizar_busca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_municipe_nome text;
BEGIN
  IF NEW.municipe_id IS NOT NULL THEN
    SELECT m.nome INTO v_municipe_nome FROM public.municipes m WHERE m.id = NEW.municipe_id;
  END IF;

  NEW.busca := public.normalizar_busca(concat_ws(' ',
    NEW.protocolo, NEW.titulo, NEW.descricao,
    NEW.logradouro, NEW.numero, NEW.bairro, NEW.cidade,
    v_municipe_nome
  ));

  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - 'busca' - 'updated_at') = (to_jsonb(OLD) - 'busca' - 'updated_at') THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.demandas_atualizar_busca() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_demandas_busca ON public.demandas;
CREATE TRIGGER zz_demandas_busca
  BEFORE INSERT OR UPDATE ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.demandas_atualizar_busca();


-- 5. Nome do munícipe mudou → recalcula a busca das demandas dele.
--    SECURITY DEFINER: quem edita o munícipe pode não ter permissão de
--    editar demandas; a atualização só toca a coluna busca.
CREATE OR REPLACE FUNCTION public.municipes_propagar_busca_demandas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.demandas SET busca = NULL WHERE municipe_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.municipes_propagar_busca_demandas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.municipes_atualizar_busca() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_municipes_propagar_busca ON public.municipes;
CREATE TRIGGER zz_municipes_propagar_busca
  AFTER UPDATE OF nome ON public.municipes
  FOR EACH ROW EXECUTE FUNCTION public.municipes_propagar_busca_demandas();


-- 6. Preenche as linhas existentes (os triggers calculam; updated_at é preservado)
UPDATE public.municipes SET busca = NULL;
UPDATE public.demandas  SET busca = NULL;
