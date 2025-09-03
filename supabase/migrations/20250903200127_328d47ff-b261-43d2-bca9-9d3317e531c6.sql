-- Corrigir a função generate_protocolo para evitar duplicatas
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
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  ano := EXTRACT(YEAR FROM NOW())::TEXT;
  
  LOOP
    -- Buscar o próximo número sequencial disponível
    SELECT COALESCE(MAX(CAST(SUBSTRING(d.protocolo FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO sequencia
    FROM public.demandas d
    WHERE d.protocolo LIKE ano || '%';
    
    novo_protocolo := ano || LPAD(sequencia::TEXT, 6, '0');
    
    -- Verificar se o protocolo já existe
    IF NOT EXISTS (SELECT 1 FROM public.demandas WHERE protocolo = novo_protocolo) THEN
      RETURN novo_protocolo;
    END IF;
    
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      -- Fallback: usar timestamp para garantir unicidade
      novo_protocolo := ano || LPAD(EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT, 10, '0');
      RETURN novo_protocolo;
    END IF;
  END LOOP;
END;
$$;