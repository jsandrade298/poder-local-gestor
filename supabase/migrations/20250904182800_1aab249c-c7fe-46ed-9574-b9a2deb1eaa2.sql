-- Atualizar tipos MIME permitidos no bucket para incluir M4A e outros formatos
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'image/jpeg', 
  'image/png', 
  'image/gif', 
  'image/webp',
  'video/mp4', 
  'video/quicktime',
  'video/webm',
  'audio/mpeg', 
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a', -- Adicionar suporte a M4A
  'audio/m4a',
  'audio/aac',
  'audio/ogg', 
  'audio/wav',
  'audio/webm',
  'application/pdf', 
  'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
WHERE id = 'whatsapp-media';