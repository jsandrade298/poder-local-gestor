-- Verificar e corrigir políticas da tabela municipe_tags
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'municipe_tags';