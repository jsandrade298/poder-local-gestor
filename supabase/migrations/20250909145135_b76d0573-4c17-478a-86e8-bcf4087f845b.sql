-- Criar tabela para tarefas pessoais do kanban
CREATE TABLE public.tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media',
  kanban_position TEXT NOT NULL DEFAULT 'a_fazer',
  kanban_type TEXT NOT NULL, -- ID do usuário ou tipo do kanban (ex: "producao-legislativa")
  created_by UUID NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

-- Política para visualizar tarefas (qualquer usuário autenticado pode ver)
CREATE POLICY "Authenticated users can view tarefas" 
ON public.tarefas 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

-- Política para criar tarefas (usuário deve ser o criador)
CREATE POLICY "Users can create their own tarefas" 
ON public.tarefas 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Política para atualizar tarefas (usuário deve ser o criador ou admin/gestor)
CREATE POLICY "Users can update their own tarefas" 
ON public.tarefas 
FOR UPDATE 
USING (
  (auth.uid() = created_by) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);

-- Política para deletar tarefas (usuário deve ser o criador ou admin/gestor)
CREATE POLICY "Users can delete their own tarefas" 
ON public.tarefas 
FOR DELETE 
USING (
  (auth.uid() = created_by) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);

-- Trigger para atualizar o campo updated_at
CREATE TRIGGER update_tarefas_updated_at
BEFORE UPDATE ON public.tarefas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_tarefas_kanban_type ON public.tarefas(kanban_type);
CREATE INDEX idx_tarefas_created_by ON public.tarefas(created_by);
CREATE INDEX idx_tarefas_position ON public.tarefas(kanban_position);