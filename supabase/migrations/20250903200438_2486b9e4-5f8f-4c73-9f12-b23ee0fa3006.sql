-- Corrigir a função generate_protocolo para gerar valores dentro do range de text
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
  
  -- Buscar o próximo número sequencial disponível
  SELECT COALESCE(MAX(CAST(SUBSTRING(d.protocolo FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO sequencia
  FROM public.demandas d
  WHERE d.protocolo ~ ('^' || ano || '[0-9]+$')
  AND LENGTH(d.protocolo) <= 10; -- Limitar a protocolos de até 10 dígitos
  
  novo_protocolo := ano || LPAD(sequencia::TEXT, 6, '0');
  
  RETURN novo_protocolo;
END;
$$;