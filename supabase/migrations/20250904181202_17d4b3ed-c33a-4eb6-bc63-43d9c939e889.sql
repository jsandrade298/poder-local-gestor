-- Criar bucket para armazenar mídia do WhatsApp
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media', 
  true,
  104857600, -- 100MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'audio/mpeg', 'audio/ogg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Configurar políticas RLS para o bucket whatsapp-media
CREATE POLICY "Permitir upload público" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Permitir leitura pública" ON storage.objects
  FOR SELECT USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Permitir exclusão de arquivos" ON storage.objects
  FOR DELETE USING (bucket_id = 'whatsapp-media');