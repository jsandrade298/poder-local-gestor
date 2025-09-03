-- Verificar se a tabela municipe_tags existe
-- Se não existir, vamos criá-la para relacionar munícipes com tags

-- Criar tabela de relacionamento entre munícipes e tags
CREATE TABLE IF NOT EXISTS public.municipe_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipe_id UUID NOT NULL REFERENCES public.municipes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(municipe_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.municipe_tags ENABLE ROW LEVEL SECURITY;

-- Create policies para municipe_tags
CREATE POLICY "Authenticated users can view municipe tags" 
ON public.municipe_tags 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and gestores can manage municipe tags" 
ON public.municipe_tags 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Users can create municipe tags" 
ON public.municipe_tags 
FOR INSERT 
WITH CHECK (true);