-- Criar trigger para notificação de mudanças de status de demandas
-- Este trigger complementa o sistema em tempo real via WebSocket

CREATE OR REPLACE FUNCTION public.trigger_notificar_atualizacao_demanda()
RETURNS TRIGGER AS $$
DECLARE
    config_instancia text;
    config_mensagem text;
    config_ativo boolean;
    municipe_nome text;
    municipe_telefone text;
    status_texto text;
BEGIN
    -- Verificar se o status mudou
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Buscar configurações
    SELECT valor INTO config_instancia FROM configuracoes WHERE chave = 'whatsapp_instancia_demandas';
    SELECT valor INTO config_mensagem FROM configuracoes WHERE chave = 'whatsapp_mensagem_demandas';
    SELECT (valor = 'true') INTO config_ativo FROM configuracoes WHERE chave = 'whatsapp_demandas_ativo';
    
    -- Se não estiver ativo, sair
    IF NOT config_ativo OR config_instancia IS NULL OR config_mensagem IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Buscar dados do munícipe
    SELECT nome, telefone INTO municipe_nome, municipe_telefone 
    FROM municipes 
    WHERE id = NEW.municipe_id;
    
    -- Se não tem telefone, sair
    IF municipe_telefone IS NULL OR municipe_telefone = '' THEN
        RETURN NEW;
    END IF;
    
    -- Converter status para texto amigável
    CASE NEW.status
        WHEN 'aberta' THEN status_texto := 'Aberta';
        WHEN 'em_andamento' THEN status_texto := 'Em Andamento';
        WHEN 'resolvida' THEN status_texto := 'Resolvida';
        WHEN 'cancelada' THEN status_texto := 'Cancelada';
        ELSE status_texto := NEW.status::text;
    END CASE;
    
    -- Inserir notificação na tabela de notificações de demanda
    INSERT INTO demanda_notifications (
        demanda_id,
        demanda_titulo,
        municipe_nome,
        telefone,
        novo_status,
        instance_name,
        status,
        created_at
    ) VALUES (
        NEW.id,
        NEW.titulo,
        municipe_nome,
        municipe_telefone,
        status_texto,
        config_instancia,
        'pending',
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar tabela para armazenar notificações de demanda
CREATE TABLE IF NOT EXISTS public.demanda_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    demanda_id UUID NOT NULL,
    demanda_titulo TEXT,
    municipe_nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    novo_status TEXT NOT NULL,
    instance_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'error')),
    error_message TEXT,
    countdown INTEGER DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.demanda_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para demanda_notifications
CREATE POLICY "Users can view their own notification records" ON public.demanda_notifications
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert notification records" ON public.demanda_notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own notification records" ON public.demanda_notifications
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_demanda_status_change ON public.demandas;
CREATE TRIGGER trigger_demanda_status_change
    AFTER UPDATE ON public.demandas
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_notificar_atualizacao_demanda();

-- Função para atualizar updated_at
CREATE TRIGGER update_demanda_notifications_updated_at
    BEFORE UPDATE ON public.demanda_notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();