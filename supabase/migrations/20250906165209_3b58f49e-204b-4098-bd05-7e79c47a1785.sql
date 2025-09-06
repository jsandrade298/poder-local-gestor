-- Criar tabelas auxiliares para dropdowns
CREATE TABLE public.eixos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.temas_acao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  eixo_id UUID REFERENCES public.eixos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.prioridades_acao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  nivel INTEGER NOT NULL,
  cor TEXT DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.status_acao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#10B981',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela principal do plano de ação
CREATE TABLE public.planos_acao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  eixo_id UUID REFERENCES public.eixos(id),
  prioridade_id UUID REFERENCES public.prioridades_acao(id),
  tema_id UUID REFERENCES public.temas_acao(id),
  acao TEXT NOT NULL,
  responsavel_id UUID REFERENCES public.profiles(id),
  apoio TEXT,
  status_id UUID REFERENCES public.status_acao(id),
  prazo DATE,
  atualizacao TEXT,
  concluida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) NOT NULL
);

-- Índices para melhor performance
CREATE INDEX idx_planos_acao_eixo ON public.planos_acao(eixo_id);
CREATE INDEX idx_planos_acao_responsavel ON public.planos_acao(responsavel_id);
CREATE INDEX idx_planos_acao_status ON public.planos_acao(status_id);
CREATE INDEX idx_planos_acao_concluida ON public.planos_acao(concluida);

-- Triggers para updated_at
CREATE TRIGGER update_eixos_updated_at
  BEFORE UPDATE ON public.eixos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_temas_acao_updated_at
  BEFORE UPDATE ON public.temas_acao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planos_acao_updated_at
  BEFORE UPDATE ON public.planos_acao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Dados iniciais
INSERT INTO public.eixos (nome, descricao, cor) VALUES
('Infraestrutura', 'Obras, saneamento, urbanização', '#EF4444'),
('Saúde', 'Saúde pública, atendimento médico', '#10B981'),
('Educação', 'Ensino, cultura, esporte', '#3B82F6'),
('Segurança', 'Segurança pública, trânsito', '#F59E0B'),
('Social', 'Assistência social, habitação', '#8B5CF6'),
('Meio Ambiente', 'Sustentabilidade, preservação', '#059669');

INSERT INTO public.prioridades_acao (nome, nivel, cor) VALUES
('Baixa', 1, '#6B7280'),
('Média', 2, '#F59E0B'),
('Alta', 3, '#EF4444'),
('Crítica', 4, '#DC2626');

INSERT INTO public.status_acao (nome, cor) VALUES
('Não Iniciada', '#6B7280'),
('Em Planejamento', '#3B82F6'),
('Em Andamento', '#F59E0B'),
('Concluída', '#10B981'),
('Pausada', '#8B5CF6'),
('Cancelada', '#EF4444');

-- Inserir alguns temas exemplo
INSERT INTO public.temas_acao (nome, eixo_id) 
SELECT 'Pavimentação', id FROM public.eixos WHERE nome = 'Infraestrutura'
UNION ALL
SELECT 'Saneamento', id FROM public.eixos WHERE nome = 'Infraestrutura'
UNION ALL
SELECT 'UBS', id FROM public.eixos WHERE nome = 'Saúde'
UNION ALL
SELECT 'Escolas', id FROM public.eixos WHERE nome = 'Educação';

-- RLS Policies
ALTER TABLE public.eixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temas_acao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_acao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_acao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos_acao ENABLE ROW LEVEL SECURITY;

-- Policies para visualização (todos autenticados podem ver)
CREATE POLICY "Authenticated users can view eixos" ON public.eixos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view temas" ON public.temas_acao FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view prioridades" ON public.prioridades_acao FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view status" ON public.status_acao FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view planos" ON public.planos_acao FOR SELECT USING (auth.role() = 'authenticated');

-- Policies para gestão (admins e gestores)
CREATE POLICY "Admins can manage eixos" ON public.eixos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can manage temas" ON public.temas_acao FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can manage prioridades" ON public.prioridades_acao FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can manage status" ON public.status_acao FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Policies para planos de ação
CREATE POLICY "Users can create planos" ON public.planos_acao FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update assigned planos" ON public.planos_acao FOR UPDATE USING (
  auth.uid() = responsavel_id OR 
  auth.uid() = created_by OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);
CREATE POLICY "Users can delete assigned planos" ON public.planos_acao FOR DELETE USING (
  auth.uid() = created_by OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);