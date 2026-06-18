
ALTER TABLE public.whatsapp_conversas ADD COLUMN IF NOT EXISTS ultima_mensagem text;
ALTER TABLE public.whatsapp_handoffs ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'ia';
