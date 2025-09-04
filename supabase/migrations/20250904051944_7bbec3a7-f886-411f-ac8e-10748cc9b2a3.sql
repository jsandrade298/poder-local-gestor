-- Criar tabela para gerenciar instâncias do WhatsApp
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected',
  profile_name TEXT,
  profile_picture_url TEXT,
  phone_number TEXT,
  qr_code TEXT,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view instances" 
ON public.whatsapp_instances 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage instances" 
ON public.whatsapp_instances 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the existing instances
INSERT INTO public.whatsapp_instances (instance_name, display_name) VALUES
('gabinete-whats-01', 'WhatsApp Principal'),
('gabinete-whats-02', 'WhatsApp Secundário'),
('gabinete-whats-03', 'WhatsApp Terceiro');