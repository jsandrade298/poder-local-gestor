-- Corrigir a função generate_protocolo para evitar duplicatas definitivamente
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
  max_attempts INTEGER := 100;
  attempt INTEGER := 0;
BEGIN
  ano := EXTRACT(YEAR FROM NOW())::TEXT;
  
  LOOP
    -- Buscar o próximo número sequencial disponível
    SELECT COALESCE(MAX(CAST(SUBSTRING(d.protocolo FROM '[0-9]+$') AS INTEGER)), 0) + 1 + attempt
    INTO sequencia
    FROM public.demandas d
    WHERE d.protocolo ~ ('^' || ano || '[0-9]+$');
    
    novo_protocolo := ano || LPAD(sequencia::TEXT, 6, '0');
    
    -- Verificar se o protocolo já existe
    IF NOT EXISTS (SELECT 1 FROM public.demandas WHERE protocolo = novo_protocolo) THEN
      RETURN novo_protocolo;
    END IF;
    
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      -- Fallback: usar um número aleatório grande
      sequencia := (EXTRACT(EPOCH FROM NOW())::INTEGER % 900000) + 100000;
      novo_protocolo := ano || sequencia::TEXT;
      IF NOT EXISTS (SELECT 1 FROM public.demandas WHERE protocolo = novo_protocolo) THEN
        RETURN novo_protocolo;
      END IF;
    END IF;
  END LOOP;
END;
$$;