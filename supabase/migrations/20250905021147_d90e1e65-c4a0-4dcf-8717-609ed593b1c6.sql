-- Criar enum para status das agendas
CREATE TYPE status_agenda AS ENUM ('pendente', 'confirmado', 'recusado', 'remarcar');

-- Criar tabela de agendas
CREATE TABLE public.agendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitante_id UUID NOT NULL,
  validador_id UUID NOT NULL,
  data_pedido TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_hora_proposta TIMESTAMP WITH TIME ZONE NOT NULL,
  duracao_prevista TEXT NOT NULL,
  participantes TEXT NOT NULL,
  local_endereco TEXT NOT NULL,
  descricao_objetivo TEXT NOT NULL,
  pauta_sugerida TEXT NOT NULL,
  material_apoio TEXT,
  observacoes TEXT,
  status status_agenda NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para relacionar agendas com usuários que acompanham pelo mandato
CREATE TABLE public.agenda_acompanhantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agenda_id UUID NOT NULL,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agenda_id, usuario_id)
);

-- Criar tabela de mensagens de chat das agendas
CREATE TABLE public.agenda_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agenda_id UUID NOT NULL,
  remetente_id UUID NOT NULL,
  mensagem TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX idx_agendas_solicitante ON public.agendas(solicitante_id);
CREATE INDEX idx_agendas_validador ON public.agendas(validador_id);
CREATE INDEX idx_agendas_status ON public.agendas(status);
CREATE INDEX idx_agenda_acompanhantes_agenda ON public.agenda_acompanhantes(agenda_id);
CREATE INDEX idx_agenda_acompanhantes_usuario ON public.agenda_acompanhantes(usuario_id);
CREATE INDEX idx_agenda_mensagens_agenda ON public.agenda_mensagens(agenda_id);
CREATE INDEX idx_agenda_mensagens_remetente ON public.agenda_mensagens(remetente_id);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_acompanhantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_mensagens ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para agendas
CREATE POLICY "Solicitantes podem criar agendas" 
ON public.agendas 
FOR INSERT 
WITH CHECK (auth.uid() = solicitante_id);

CREATE POLICY "Participantes podem ver agendas" 
ON public.agendas 
FOR SELECT 
USING (
  auth.uid() = solicitante_id OR 
  auth.uid() = validador_id OR 
  EXISTS (
    SELECT 1 FROM public.agenda_acompanhantes 
    WHERE agenda_id = id AND usuario_id = auth.uid()
  )
);

CREATE POLICY "Validadores podem atualizar status" 
ON public.agendas 
FOR UPDATE 
USING (auth.uid() = validador_id);

-- Políticas RLS para acompanhantes
CREATE POLICY "Solicitantes podem adicionar acompanhantes" 
ON public.agenda_acompanhantes 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agendas 
    WHERE id = agenda_id AND solicitante_id = auth.uid()
  )
);

CREATE POLICY "Participantes podem ver acompanhantes" 
ON public.agenda_acompanhantes 
FOR SELECT 
USING (
  auth.uid() = usuario_id OR
  EXISTS (
    SELECT 1 FROM public.agendas 
    WHERE id = agenda_id AND (solicitante_id = auth.uid() OR validador_id = auth.uid())
  )
);

-- Políticas RLS para mensagens
CREATE POLICY "Participantes podem criar mensagens" 
ON public.agenda_mensagens 
FOR INSERT 
WITH CHECK (
  auth.uid() = remetente_id AND
  EXISTS (
    SELECT 1 FROM public.agendas a
    WHERE a.id = agenda_id AND (
      a.solicitante_id = auth.uid() OR 
      a.validador_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.agenda_acompanhantes aa
        WHERE aa.agenda_id = a.id AND aa.usuario_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Participantes podem ver mensagens" 
ON public.agenda_mensagens 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.agendas a
    WHERE a.id = agenda_id AND (
      a.solicitante_id = auth.uid() OR 
      a.validador_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.agenda_acompanhantes aa
        WHERE aa.agenda_id = a.id AND aa.usuario_id = auth.uid()
      )
    )
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_agendas_updated_at
BEFORE UPDATE ON public.agendas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agenda_mensagens_updated_at
BEFORE UPDATE ON public.agenda_mensagens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();