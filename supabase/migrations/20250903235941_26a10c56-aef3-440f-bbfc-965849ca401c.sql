-- Temporariamente permitir acesso público aos dados principais para desenvolvimento
-- ATENÇÃO: Isso é apenas para desenvolvimento, não usar em produção!

-- Permitir leitura pública de demandas
DROP POLICY IF EXISTS "Authenticated users can view demandas" ON public.demandas;
CREATE POLICY "Public can view demandas" 
ON public.demandas 
FOR SELECT 
USING (true);

-- Permitir leitura pública de munícipes  
DROP POLICY IF EXISTS "Authenticated users can view municipes" ON public.municipes;
CREATE POLICY "Public can view municipes" 
ON public.municipes 
FOR SELECT 
USING (true);

-- Permitir leitura pública de areas
DROP POLICY IF EXISTS "Authenticated users can view areas" ON public.areas;
CREATE POLICY "Public can view areas" 
ON public.areas 
FOR SELECT 
USING (true);

-- Permitir leitura pública de tags
DROP POLICY IF EXISTS "Authenticated users can view tags" ON public.tags;
CREATE POLICY "Public can view tags" 
ON public.tags 
FOR SELECT 
USING (true);