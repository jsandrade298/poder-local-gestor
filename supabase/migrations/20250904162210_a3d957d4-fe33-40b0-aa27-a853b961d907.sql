-- Add link_propositura field to demanda_atividades table
ALTER TABLE public.demanda_atividades 
ADD COLUMN IF NOT EXISTS link_propositura text;