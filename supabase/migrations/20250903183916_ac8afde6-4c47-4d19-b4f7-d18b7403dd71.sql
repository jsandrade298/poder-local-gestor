-- Corrigir os warnings de segurança - adicionar search_path nas funções

-- 1. Corrigir função generate_protocolo
CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ano TEXT;
  sequencia INTEGER;
  protocolo TEXT;
BEGIN
  ano := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(protocolo FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO sequencia
  FROM public.demandas
  WHERE protocolo LIKE ano || '%';
  
  protocolo := ano || LPAD(sequencia::TEXT, 6, '0');
  
  RETURN protocolo;
END;
$$;

-- 2. Corrigir função set_protocolo
CREATE OR REPLACE FUNCTION public.set_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.protocolo IS NULL OR NEW.protocolo = '' THEN
    NEW.protocolo := public.generate_protocolo();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Corrigir função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;