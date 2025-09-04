-- Criar tabela de notificações
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destinatario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'mencao', -- mencao, atribuicao, status_change, comentario
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  url_destino TEXT, -- URL para redirecionar quando clicar na notificação
  demanda_id UUID REFERENCES public.demandas(id) ON DELETE CASCADE,
  atividade_id UUID REFERENCES public.demanda_atividades(id) ON DELETE CASCADE,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_notificacoes_destinatario ON public.notificacoes(destinatario_id);
CREATE INDEX idx_notificacoes_lida ON public.notificacoes(lida);
CREATE INDEX idx_notificacoes_created_at ON public.notificacoes(created_at DESC);

-- RLS policies
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Política para visualizar próprias notificações
CREATE POLICY "Users can view own notifications" 
ON public.notificacoes 
FOR SELECT 
USING (auth.uid() = destinatario_id);

-- Política para criar notificações
CREATE POLICY "Users can create notifications" 
ON public.notificacoes 
FOR INSERT 
WITH CHECK (auth.uid() = remetente_id);

-- Política para marcar notificações como lidas
CREATE POLICY "Users can update own notifications" 
ON public.notificacoes 
FOR UPDATE 
USING (auth.uid() = destinatario_id);

-- Trigger para updated_at
CREATE TRIGGER update_notificacoes_updated_at
BEFORE UPDATE ON public.notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();