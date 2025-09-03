-- Adicionar foreign key constraint entre demandas e profiles
ALTER TABLE public.demandas 
ADD CONSTRAINT demandas_responsavel_id_fkey 
FOREIGN KEY (responsavel_id) REFERENCES public.profiles(id);

-- Adicionar foreign key constraint entre demandas e areas
ALTER TABLE public.demandas 
ADD CONSTRAINT demandas_area_id_fkey 
FOREIGN KEY (area_id) REFERENCES public.areas(id);

-- Adicionar foreign key constraint entre demandas e municipes
ALTER TABLE public.demandas 
ADD CONSTRAINT demandas_municipe_id_fkey 
FOREIGN KEY (municipe_id) REFERENCES public.municipes(id);

-- Adicionar foreign key constraint entre demandas e profiles (criado_por)
ALTER TABLE public.demandas 
ADD CONSTRAINT demandas_criado_por_fkey 
FOREIGN KEY (criado_por) REFERENCES public.profiles(id);