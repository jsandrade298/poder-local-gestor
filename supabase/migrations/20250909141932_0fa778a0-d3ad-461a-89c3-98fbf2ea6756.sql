-- Criar tabela para mapear demandas em múltiplos kanbans
CREATE TABLE public.demanda_kanbans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demanda_id UUID NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  kanban_type TEXT NOT NULL, -- 'producao-legislativa' ou user_id
  kanban_position TEXT NOT NULL CHECK (kanban_position IN ('a_fazer', 'em_progresso', 'feito')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(demanda_id, kanban_type) -- Uma demanda só pode estar uma vez em cada kanban
);

-- Habilitar RLS
ALTER TABLE public.demanda_kanbans ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view demanda kanbans" 
ON public.demanda_kanbans 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage demanda kanbans" 
ON public.demanda_kanbans 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Migrar dados existentes
INSERT INTO public.demanda_kanbans (demanda_id, kanban_type, kanban_position)
SELECT id, 
       COALESCE(kanban_type, 'producao-legislativa') as kanban_type, 
       kanban_position
FROM public.demandas 
WHERE kanban_position IS NOT NULL;

-- Trigger para updated_at
CREATE TRIGGER update_demanda_kanbans_updated_at
BEFORE UPDATE ON public.demanda_kanbans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();