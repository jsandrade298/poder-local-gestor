-- Restaurar políticas de autenticação para produção
-- Reverter as políticas públicas temporárias

-- Restaurar política original de demandas
DROP POLICY IF EXISTS "Public can view demandas" ON public.demandas;
CREATE POLICY "Authenticated users can view demandas" 
ON public.demandas 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Restaurar política original de munícipes
DROP POLICY IF EXISTS "Public can view municipes" ON public.municipes;
CREATE POLICY "Authenticated users can view municipes" 
ON public.municipes 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Restaurar política original de areas
DROP POLICY IF EXISTS "Public can view areas" ON public.areas;
CREATE POLICY "Authenticated users can view areas" 
ON public.areas 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Restaurar política original de tags
DROP POLICY IF EXISTS "Public can view tags" ON public.tags;
CREATE POLICY "Authenticated users can view tags" 
ON public.tags 
FOR SELECT 
USING (auth.role() = 'authenticated');