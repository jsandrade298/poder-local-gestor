-- Simplificar a função generate_protocolo para evitar overflow
CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ano TEXT;
  sequencia INTEGER;
  novo_protocolo TEXT;
BEGIN
  ano := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Buscar o próximo número sequencial baseado apenas nos protocolos do ano atual
  SELECT COALESCE(COUNT(*), 0) + 1
  INTO sequencia
  FROM public.demandas d
  WHERE d.protocolo LIKE ano || '%';
  
  novo_protocolo := ano || LPAD(sequencia::TEXT, 6, '0');
  
  -- Se por acaso já existir, adicionar timestamp para garantir unicidade
  WHILE EXISTS (SELECT 1 FROM public.demandas WHERE protocolo = novo_protocolo) LOOP
    sequencia := sequencia + 1;
    novo_protocolo := ano || LPAD(sequencia::TEXT, 6, '0');
  END LOOP;
  
  RETURN novo_protocolo;
END;
$$;