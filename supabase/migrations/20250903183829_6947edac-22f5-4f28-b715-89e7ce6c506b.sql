-- Criação do schema completo para o sistema de gestão de gabinete

-- 1. Enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'atendente', 'usuario');

-- 2. Enum para status de demandas
CREATE TYPE public.status_demanda AS ENUM ('aberta', 'em_andamento', 'aguardando', 'resolvida', 'cancelada');

-- 3. Enum para prioridade de demandas
CREATE TYPE public.prioridade_demanda AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- 4. Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  cargo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de roles de usuário
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'usuario',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- 6. Tabela de áreas
CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  responsavel_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela de tags
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabela de munícipes
CREATE TABLE public.municipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  rg TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT DEFAULT 'São Paulo',
  cep TEXT,
  data_nascimento DATE,
  profissao TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabela de demandas
CREATE TABLE public.demandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status status_demanda DEFAULT 'aberta',
  prioridade prioridade_demanda DEFAULT 'media',
  municipe_id UUID REFERENCES public.municipes(id) NOT NULL,
  area_id UUID REFERENCES public.areas(id),
  responsavel_id UUID REFERENCES auth.users(id),
  criado_por UUID REFERENCES auth.users(id) NOT NULL,
  data_prazo DATE,
  resolucao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Tabela de relacionamento demandas-tags
CREATE TABLE public.demanda_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID REFERENCES public.demandas(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (demanda_id, tag_id)
);

-- 11. Tabela de anexos
CREATE TABLE public.anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID REFERENCES public.demandas(id) ON DELETE CASCADE NOT NULL,
  nome_arquivo TEXT NOT NULL,
  url_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT,
  tamanho_arquivo INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Tabela de configurações do sistema
CREATE TABLE public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Função para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 14. Função para gerar protocolo automático
CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  ano TEXT;
  sequencia INTEGER;
  protocolo TEXT;
BEGIN
  ano := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(protocolo FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO sequencia
  FROM public.demandas
  WHERE protocolo LIKE ano || '%';
  
  protocolo := ano || LPAD(sequencia::TEXT, 6, '0');
  
  RETURN protocolo;
END;
$$;

-- 15. Trigger para gerar protocolo automaticamente
CREATE OR REPLACE FUNCTION public.set_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.protocolo IS NULL OR NEW.protocolo = '' THEN
    NEW.protocolo := public.generate_protocolo();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_protocolo
  BEFORE INSERT ON public.demandas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_protocolo();

-- 16. Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'usuario');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 17. Função para atualizar timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 18. Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_areas_updated_at
  BEFORE UPDATE ON public.areas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_municipes_updated_at
  BEFORE UPDATE ON public.municipes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_demandas_updated_at
  BEFORE UPDATE ON public.demandas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 19. Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demanda_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- 20. Políticas RLS para profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 21. Políticas RLS para user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 22. Políticas RLS para areas
CREATE POLICY "Authenticated users can view areas" ON public.areas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestores can manage areas" ON public.areas
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor')
  );

-- 23. Políticas RLS para tags
CREATE POLICY "Authenticated users can view tags" ON public.tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestores can manage tags" ON public.tags
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor')
  );

-- 24. Políticas RLS para municipes
CREATE POLICY "Authenticated users can view municipes" ON public.municipes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create municipes" ON public.municipes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins and gestores can manage municipes" ON public.municipes
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor')
  );

-- 25. Políticas RLS para demandas
CREATE POLICY "Authenticated users can view demandas" ON public.demandas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create demandas" ON public.demandas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Users can update assigned demandas" ON public.demandas
  FOR UPDATE USING (
    auth.uid() = responsavel_id OR 
    auth.uid() = criado_por OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor')
  );

-- 26. Políticas RLS para demanda_tags
CREATE POLICY "Authenticated users can view demanda tags" ON public.demanda_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage demanda tags" ON public.demanda_tags
  FOR ALL TO authenticated USING (true);

-- 27. Políticas RLS para anexos
CREATE POLICY "Authenticated users can view anexos" ON public.anexos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can upload anexos" ON public.anexos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader and admins can manage anexos" ON public.anexos
  FOR ALL USING (
    auth.uid() = uploaded_by OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor')
  );

-- 28. Políticas RLS para configuracoes
CREATE POLICY "Authenticated users can view configurations" ON public.configuracoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage configurations" ON public.configuracoes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 29. Inserir dados iniciais
INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('sistema_nome', 'Sistema de Gestão de Gabinete', 'Nome do sistema'),
  ('email_notificacoes', 'admin@gabinete.com', 'Email para notificações do sistema'),
  ('prazo_padrao_dias', '30', 'Prazo padrão em dias para resolução de demandas');

INSERT INTO public.tags (nome, cor) VALUES
  ('Urgente', '#EF4444'),
  ('Saúde', '#10B981'),
  ('Educação', '#3B82F6'),
  ('Infraestrutura', '#F59E0B'),
  ('Assistência Social', '#8B5CF6');

-- 30. Criar índices para performance
CREATE INDEX idx_demandas_protocolo ON public.demandas(protocolo);
CREATE INDEX idx_demandas_status ON public.demandas(status);
CREATE INDEX idx_demandas_municipe ON public.demandas(municipe_id);
CREATE INDEX idx_demandas_area ON public.demandas(area_id);
CREATE INDEX idx_demandas_responsavel ON public.demandas(responsavel_id);
CREATE INDEX idx_demandas_created_at ON public.demandas(created_at);
CREATE INDEX idx_municipes_cpf ON public.municipes(cpf);
CREATE INDEX idx_municipes_nome ON public.municipes(nome);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);