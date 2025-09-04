-- Garantir que a tabela existe com todos os campos necessários
CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255),
    instance_token TEXT NOT NULL,
    api_url TEXT NOT NULL,
    webhook_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir/Atualizar instância 1
INSERT INTO whatsapp_instances (
    instance_name,
    display_name,
    instance_id,
    instance_token,
    api_url,
    active
) VALUES (
    'gabinete-whats-01',
    'WhatsApp Principal',
    '4be2e95b-4a71-408e-9447-2a733e800e1f',
    '9c24f99f-2626-4613-b98a-cfbc5b279762',
    'https://api.evoapicloud.com',
    true
) ON CONFLICT (instance_name) 
DO UPDATE SET
    instance_id = EXCLUDED.instance_id,
    instance_token = EXCLUDED.instance_token,
    api_url = EXCLUDED.api_url,
    updated_at = NOW();

-- Inserir/Atualizar instância 2
INSERT INTO whatsapp_instances (
    instance_name,
    display_name,
    instance_id,
    instance_token,
    api_url,
    active
) VALUES (
    'gabinete-whats-02',
    'WhatsApp Secundário',
    '06331c62-88b5-4d67-844c-aba9c41ef417',
    'AAC55AAC988A-4E56-90E3-694CBE9CD17A',
    'https://api.evoapicloud.com',
    true
) ON CONFLICT (instance_name) 
DO UPDATE SET
    instance_id = EXCLUDED.instance_id,
    instance_token = EXCLUDED.instance_token,
    api_url = EXCLUDED.api_url,
    updated_at = NOW();

-- Inserir/Atualizar instância 3
INSERT INTO whatsapp_instances (
    instance_name,
    display_name,
    instance_id,
    instance_token,
    api_url,
    active
) VALUES (
    'gabinete-whats-03',
    'WhatsApp Terceiro',
    '31bd8444-42ae-400a-9b63-1759cda9ca3b',
    '455EB620E6CA-414C-BB10-32DB46272BF1',
    'https://api.evoapicloud.com',
    true
) ON CONFLICT (instance_name) 
DO UPDATE SET
    instance_id = EXCLUDED.instance_id,
    instance_token = EXCLUDED.instance_token,
    api_url = EXCLUDED.api_url,
    updated_at = NOW();