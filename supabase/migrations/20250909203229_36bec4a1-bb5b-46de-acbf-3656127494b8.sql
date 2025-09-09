-- Adicionar campo de ordem na tabela eixos
ALTER TABLE public.eixos ADD COLUMN ordem INTEGER;

-- Definir ordem inicial baseada na ordem alfabética atual
UPDATE public.eixos 
SET ordem = row_number() OVER (ORDER BY nome);