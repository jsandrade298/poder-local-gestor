-- ============================================================
-- Busca por campo — munícipes e demandas
--
-- A coluna `busca` junta todos os campos, então buscar "joão" trazia
-- também quem mora no bairro "João Ramalho". Esta migração acrescenta
-- `busca_campos` (jsonb) com cada campo normalizado separadamente, para
-- o app filtrar só nos campos que o usuário escolher:
--   busca_campos->>'nome' ILIKE '%joao%'
--
-- `busca` continua existindo e é usada quando a opção é "Todos os campos".
-- Mesmas garantias da migração anterior: recalcular não muda updated_at
-- e não dispara avisos.
-- ============================================================

ALTER TABLE public.municipes ADD COLUMN IF NOT EXISTS busca_campos jsonb;
ALTER TABLE public.demandas  ADD COLUMN IF NOT EXISTS busca_campos jsonb;


-- Munícipes
CREATE OR REPLACE FUNCTION public.municipes_atualizar_busca()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tel text := nullif(regexp_replace(coalesce(NEW.telefone, ''), '\D', '', 'g'), '');
  v_cpf text := nullif(regexp_replace(coalesce(NEW.cpf, ''), '\D', '', 'g'), '');
BEGIN
  NEW.busca := concat_ws(' ',
    public.normalizar_busca(concat_ws(' ', NEW.nome, NEW.email, NEW.cpf, NEW.bairro, NEW.endereco, NEW.cidade)),
    v_tel,
    v_cpf
  );

  NEW.busca_campos := jsonb_strip_nulls(jsonb_build_object(
    'nome',     nullif(public.normalizar_busca(NEW.nome), ''),
    'telefone', v_tel,
    'email',    nullif(public.normalizar_busca(NEW.email), ''),
    'cpf',      v_cpf,
    'bairro',   nullif(public.normalizar_busca(NEW.bairro), ''),
    'endereco', nullif(public.normalizar_busca(concat_ws(' ', NEW.endereco, NEW.cep)), ''),
    'cidade',   nullif(public.normalizar_busca(NEW.cidade), '')
  ));

  -- Se a única mudança foi o recálculo da busca, preserva updated_at
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - 'busca' - 'busca_campos' - 'updated_at')
       = (to_jsonb(OLD) - 'busca' - 'busca_campos' - 'updated_at') THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;


-- Demandas
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

  NEW.busca_campos := jsonb_strip_nulls(jsonb_build_object(
    'protocolo', nullif(public.normalizar_busca(NEW.protocolo), ''),
    'titulo',    nullif(public.normalizar_busca(NEW.titulo), ''),
    'descricao', nullif(public.normalizar_busca(NEW.descricao), ''),
    'municipe',  nullif(public.normalizar_busca(v_municipe_nome), ''),
    'bairro',    nullif(public.normalizar_busca(NEW.bairro), ''),
    'endereco',  nullif(public.normalizar_busca(concat_ws(' ', NEW.logradouro, NEW.numero, NEW.complemento, NEW.cep)), ''),
    'cidade',    nullif(public.normalizar_busca(NEW.cidade), '')
  ));

  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - 'busca' - 'busca_campos' - 'updated_at')
       = (to_jsonb(OLD) - 'busca' - 'busca_campos' - 'updated_at') THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.demandas_atualizar_busca() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.municipes_atualizar_busca() FROM PUBLIC, anon, authenticated;


-- Preenche as linhas existentes (triggers recalculam; updated_at é preservado)
UPDATE public.municipes SET busca_campos = NULL;
UPDATE public.demandas  SET busca_campos = NULL;
