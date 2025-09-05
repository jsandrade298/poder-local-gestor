-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar tabela para registrar histórico de envios de aniversário
CREATE TABLE IF NOT EXISTS public.logs_aniversario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_envio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  quantidade INTEGER,
  teste BOOLEAN DEFAULT false,
  aniversariantes JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela
ALTER TABLE public.logs_aniversario ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir acesso a usuários autenticados
CREATE POLICY "Authenticated users can view logs" ON public.logs_aniversario
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert logs" ON public.logs_aniversario
  FOR INSERT WITH CHECK (true);

-- Inserir configurações padrão para aniversários (se não existirem)
INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('whatsapp_instancia_aniversario', '', 'Instância WhatsApp para mensagens de aniversário'),
  ('whatsapp_mensagem_aniversario', 'Feliz aniversário, {nome}! 🎉🎂 Desejamos um dia repleto de alegria e felicidade!', 'Mensagem padrão de aniversário - use {nome} para personalizar'),
  ('whatsapp_aniversario_ativo', 'false', 'Ativar/desativar envio automático de mensagens de aniversário')
ON CONFLICT (chave) DO NOTHING;

-- Remover job existente se houver (ignorar erro se não existir)
SELECT cron.unschedule('enviar-aniversarios-diarios');

-- Criar cron job para executar todos os dias às 9h00 (horário UTC)
SELECT cron.schedule(
  'enviar-aniversarios-diarios',
  '0 9 * * *', -- Executa às 9h00 UTC todos os dias
  $$
  SELECT net.http_post(
    url := 'https://nsoedzefrqjmbgahukub.supabase.co/functions/v1/enviar-whatsapp-aniversario',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2VkemVmcnFqbWJnYWh1a3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQ1NjgsImV4cCI6MjA3MjQ5MDU2OH0.ucqQ7-hskVwAd-UkyKk9rB7FCEPPH8hkm7k8evzoU_4"}'::jsonb,
    body := '{"teste": false}'::jsonb
  );
  $$
);