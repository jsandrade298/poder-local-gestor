-- Remover a associação entre temas_acao e eixos
-- Tornando eixo_id nullable na tabela temas_acao
ALTER TABLE public.temas_acao 
ALTER COLUMN eixo_id DROP NOT NULL;