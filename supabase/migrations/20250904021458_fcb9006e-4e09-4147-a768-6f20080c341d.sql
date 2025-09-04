-- Adicionar política para permitir que usuários deletem suas próprias notificações
CREATE POLICY "Users can delete own notifications"
ON public.notificacoes
FOR DELETE
USING (auth.uid() = destinatario_id);