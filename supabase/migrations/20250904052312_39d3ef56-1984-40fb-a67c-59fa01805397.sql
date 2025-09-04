-- Adicionar colunas para configurações específicas de cada instância
ALTER TABLE public.whatsapp_instances 
ADD COLUMN api_url TEXT,
ADD COLUMN instance_id TEXT,
ADD COLUMN instance_token TEXT;

-- Atualizar as instâncias existentes com as configurações fornecidas
UPDATE public.whatsapp_instances 
SET 
  api_url = 'https://api.evoapicloud.com',
  instance_id = '4be2e95b-4a71-408e-9447-2a733e800e1f',
  instance_token = '9c24f99f-2626-4613-b98a-cfbc5b279762'
WHERE instance_name = 'gabinete-whats-01';

UPDATE public.whatsapp_instances 
SET 
  api_url = 'https://api.evoapicloud.com',
  instance_id = '06331c62-88b5-4d67-844c-aba9c41ef417',
  instance_token = 'AAC55AAC988A-4E56-90E3-694CBE9CD17A'
WHERE instance_name = 'gabinete-whats-02';

UPDATE public.whatsapp_instances 
SET 
  api_url = 'https://api.evoapicloud.com',
  instance_id = '31bd8444-42ae-400a-9b63-1759cda9ca3b',
  instance_token = '455EB620E6CA-414C-BB10-32DB46272BF1'
WHERE instance_name = 'gabinete-whats-03';