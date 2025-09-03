-- Adicionar colunas necessárias à tabela demandas
ALTER TABLE public.demandas 
ADD COLUMN IF NOT EXISTS logradouro TEXT,
ADD COLUMN IF NOT EXISTS numero TEXT,
ADD COLUMN IF NOT EXISTS bairro TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT DEFAULT 'São Paulo',
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS complemento TEXT,
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Criar bucket para anexos de demandas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('demanda-anexos', 'demanda-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para anexos
CREATE POLICY "Usuários autenticados podem visualizar anexos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'demanda-anexos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem fazer upload de anexos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'demanda-anexos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem deletar próprios anexos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'demanda-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Atualizar função de geração de protocolo para evitar ambiguidade
CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ano TEXT;
  sequencia INTEGER;
  novo_protocolo TEXT;
BEGIN
  ano := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(d.protocolo FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO sequencia
  FROM public.demandas d
  WHERE d.protocolo LIKE ano || '%';
  
  novo_protocolo := ano || LPAD(sequencia::TEXT, 6, '0');
  
  RETURN novo_protocolo;
END;
$$;