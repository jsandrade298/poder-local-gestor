-- Alterar o campo responsavel_id para responsavel (texto) na tabela planos_acao
ALTER TABLE public.planos_acao 
ADD COLUMN responsavel TEXT;

-- Migrar dados existentes (opcional - manter referência aos nomes dos usuários)
UPDATE public.planos_acao 
SET responsavel = profiles.nome 
FROM public.profiles 
WHERE planos_acao.responsavel_id = profiles.id;

-- Remover a coluna responsavel_id (comentado para preservar dados)
-- ALTER TABLE public.planos_acao DROP COLUMN responsavel_id;