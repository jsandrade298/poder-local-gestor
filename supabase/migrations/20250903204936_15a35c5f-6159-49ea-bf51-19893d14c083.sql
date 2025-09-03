-- Adicionar política de DELETE para demandas
CREATE POLICY "Users can delete assigned demandas" 
ON public.demandas 
FOR DELETE 
USING (
  (auth.uid() = responsavel_id) OR 
  (auth.uid() = criado_por) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);