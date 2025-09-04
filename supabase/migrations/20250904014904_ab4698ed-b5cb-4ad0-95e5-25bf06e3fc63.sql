-- Criar política para permitir visualizar profiles no contexto de atividades
CREATE POLICY "Users can view profiles for activity context"
ON public.profiles
FOR SELECT
USING (true);