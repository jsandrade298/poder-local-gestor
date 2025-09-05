-- Criar bucket para documentos modelo
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos-modelo', 'documentos-modelo', false);

-- Criar tabela para metadados dos documentos modelo
CREATE TABLE public.documentos_modelo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL,
  tamanho_arquivo INTEGER,
  url_arquivo TEXT NOT NULL,
  conteudo_extraido TEXT,
  uploaded_by UUID NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.documentos_modelo ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view documentos modelo" 
ON public.documentos_modelo 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can upload documentos modelo" 
ON public.documentos_modelo 
FOR INSERT 
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update own documentos modelo" 
ON public.documentos_modelo 
FOR UPDATE 
USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Users can delete own documentos modelo" 
ON public.documentos_modelo 
FOR DELETE 
USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_documentos_modelo_updated_at
BEFORE UPDATE ON public.documentos_modelo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Políticas de storage para documentos modelo
CREATE POLICY "Users can view documentos modelo files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'documentos-modelo' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload documentos modelo files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'documentos-modelo' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own documentos modelo files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'documentos-modelo' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documentos modelo files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'documentos-modelo' AND auth.uid()::text = (storage.foldername(name))[1]);