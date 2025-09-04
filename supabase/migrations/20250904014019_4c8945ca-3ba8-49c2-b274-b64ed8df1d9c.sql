-- Criar tabela de atividades para demandas
CREATE TABLE public.demanda_atividades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demanda_id UUID NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  tipo_atividade TEXT NOT NULL DEFAULT 'comentario', -- comentario, email, telefone, reuniao, visita, atualizacao
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_atividade TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_demanda_atividades_demanda_id ON public.demanda_atividades(demanda_id);
CREATE INDEX idx_demanda_atividades_data ON public.demanda_atividades(data_atividade DESC);

-- RLS policies
ALTER TABLE public.demanda_atividades ENABLE ROW LEVEL SECURITY;

-- Política para visualizar atividades
CREATE POLICY "Authenticated users can view demanda activities" 
ON public.demanda_atividades 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

-- Política para criar atividades
CREATE POLICY "Users can create activities" 
ON public.demanda_atividades 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Política para atualizar próprias atividades
CREATE POLICY "Users can update own activities" 
ON public.demanda_atividades 
FOR UPDATE 
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Política para deletar próprias atividades
CREATE POLICY "Users can delete own activities" 
ON public.demanda_atividades 
FOR DELETE 
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_demanda_atividades_updated_at
BEFORE UPDATE ON public.demanda_atividades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();