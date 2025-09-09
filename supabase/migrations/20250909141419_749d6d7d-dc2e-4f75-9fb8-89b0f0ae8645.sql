-- Adicionar campo para identificar o tipo/dono do kanban
ALTER TABLE public.demandas 
ADD COLUMN kanban_type text DEFAULT NULL;

-- Atualizar demandas existentes no kanban para 'producao-legislativa'
UPDATE public.demandas 
SET kanban_type = 'producao-legislativa' 
WHERE kanban_position IS NOT NULL;