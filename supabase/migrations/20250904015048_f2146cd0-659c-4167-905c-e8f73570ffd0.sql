-- Adicionar constraint de foreign key para created_by na tabela demanda_atividades
ALTER TABLE public.demanda_atividades 
ADD CONSTRAINT fk_demanda_atividades_created_by 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;