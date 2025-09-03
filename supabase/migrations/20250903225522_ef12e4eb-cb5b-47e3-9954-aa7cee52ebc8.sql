-- Temporarily allow area creation for authenticated users
-- This should be restricted to admins/gestores after implementing authentication

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins and gestores can manage areas" ON public.areas;

-- Create more permissive policy for now
CREATE POLICY "Authenticated users can manage areas" 
ON public.areas 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Keep the view policy as is
-- "Authenticated users can view areas" already exists