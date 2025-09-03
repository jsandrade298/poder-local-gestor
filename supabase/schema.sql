-- Configuração do banco de dados para o Sistema de Gestão de Gabinetes
-- Execute este script no SQL Editor do Supabase

-- 1. Criação das tabelas principais
-- Usuarios (administradores do sistema)
CREATE TABLE usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    ativo BOOLEAN DEFAULT true,
    papel VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES usuarios(id)
);

-- Municipes (cidadãos cadastrados)
CREATE TABLE municipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    data_nascimento DATE,
    end_logradouro VARCHAR(255),
    end_numero VARCHAR(20),
    end_complemento VARCHAR(100),
    end_bairro VARCHAR(100),
    end_cidade VARCHAR(100),
    end_cep VARCHAR(10),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES usuarios(id)
);

-- Tags para categorização dos munícipes
CREATE TABLE tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT,
    cor VARCHAR(7) DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES usuarios(id)
);

-- Relacionamento N:N entre munícipes e tags
CREATE TABLE municipes_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    municipe_id UUID REFERENCES municipes(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(municipe_id, tag_id)
);

-- Áreas de atuação do gabinete
CREATE TABLE areas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT,
    cor VARCHAR(7) DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES usuarios(id)
);

-- Demandas/solicitações dos munícipes
CREATE TABLE demandas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    area_id UUID REFERENCES areas(id),
    end_logradouro VARCHAR(255),
    end_numero VARCHAR(20),
    end_complemento VARCHAR(100),
    end_bairro VARCHAR(100),
    end_cidade VARCHAR(100),
    end_cep VARCHAR(10),
    responsavel_id UUID REFERENCES usuarios(id),
    status VARCHAR(20) DEFAULT 'solicitado' CHECK (status IN ('solicitado', 'em_andamento', 'nao_atendido', 'arquivado', 'concluido')),
    municipe_id UUID REFERENCES municipes(id),
    prazo_entrega DATE,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES usuarios(id)
);

-- Anexos das demandas (arquivos PDF/JPG/PNG)
CREATE TABLE anexos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    demanda_id UUID REFERENCES demandas(id) ON DELETE CASCADE,
    arquivo_url TEXT NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    tipo_mime VARCHAR(100),
    tamanho_bytes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES usuarios(id)
);

-- Configurações do sistema/gabinete
CREATE TABLE configuracoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    tipo VARCHAR(50) DEFAULT 'string',
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Índices para otimização de performance
CREATE INDEX idx_municipes_email ON municipes(email);
CREATE INDEX idx_municipes_bairro ON municipes(end_bairro);
CREATE INDEX idx_demandas_status ON demandas(status);
CREATE INDEX idx_demandas_area ON demandas(area_id);
CREATE INDEX idx_demandas_responsavel ON demandas(responsavel_id);
CREATE INDEX idx_demandas_municipe ON demandas(municipe_id);
CREATE INDEX idx_demandas_created_at ON demandas(created_at);
CREATE INDEX idx_demandas_bairro ON demandas(end_bairro);

-- 3. Triggers para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_municipes_updated_at BEFORE UPDATE ON municipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_demandas_updated_at BEFORE UPDATE ON demandas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_configuracoes_updated_at BEFORE UPDATE ON configuracoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Dados iniciais
-- Inserir configurações padrão
INSERT INTO configuracoes (chave, valor, tipo, descricao) VALUES
('gabinete_nome', 'Gabinete do Vereador', 'string', 'Nome oficial do gabinete'),
('gabinete_email', 'contato@gabinete.gov.br', 'string', 'Email oficial do gabinete'),
('cor_primaria', '#3b82f6', 'string', 'Cor primária do tema'),
('cor_secundaria', '#10b981', 'string', 'Cor secundária do tema'),
('limite_upload_mb', '10', 'number', 'Limite de upload em MB'),
('timezone', 'America/Sao_Paulo', 'string', 'Fuso horário do sistema');

-- Inserir áreas padrão
INSERT INTO areas (nome, descricao, cor) VALUES
('Infraestrutura', 'Reparos urbanos, pavimentação, iluminação pública', '#3b82f6'),
('Trânsito', 'Sinalização, semáforos, controle de tráfego', '#f59e0b'),
('Saúde', 'Postos de saúde, atendimento médico, campanhas', '#10b981'),
('Educação', 'Escolas, creches, programas educacionais', '#8b5cf6'),
('Meio Ambiente', 'Limpeza urbana, áreas verdes, sustentabilidade', '#22c55e'),
('Segurança', 'Policiamento, guardas municipais, prevenção', '#ef4444');

-- Inserir tags padrão
INSERT INTO tags (nome, descricao, cor) VALUES
('Idoso', 'Munícipes com mais de 60 anos', '#3b82f6'),
('Deficiente', 'Munícipes com necessidades especiais', '#10b981'),
('Comerciante', 'Proprietários de estabelecimentos comerciais', '#f59e0b'),
('Jovem', 'Munícipes de 18 a 30 anos', '#8b5cf6'),
('Estudante', 'Estudantes de ensino médio e superior', '#ef4444');

-- 5. Políticas RLS (Row Level Security)
-- Habilitar RLS em todas as tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipes_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE demandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários autenticados (todos têm acesso admin no MVP)
CREATE POLICY "Permitir tudo para usuários autenticados" ON usuarios
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir tudo para usuários autenticados" ON municipes
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir tudo para usuários autenticados" ON tags
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir tudo para usuários autenticados" ON municipes_tags
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir tudo para usuários autenticados" ON areas
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir tudo para usuários autenticados" ON demandas
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir tudo para usuários autenticados" ON anexos
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir tudo para usuários autenticados" ON configuracoes
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 6. Bucket de storage para anexos
-- Executar no Storage -> Create bucket
-- Nome: anexos-demandas
-- Público: false
-- Políticas no storage:
-- INSERT: auth.uid() IS NOT NULL
-- SELECT: auth.uid() IS NOT NULL  
-- UPDATE: auth.uid() IS NOT NULL
-- DELETE: auth.uid() IS NOT NULL