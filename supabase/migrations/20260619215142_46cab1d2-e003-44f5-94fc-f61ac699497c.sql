ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS contexto_conversa jsonb;