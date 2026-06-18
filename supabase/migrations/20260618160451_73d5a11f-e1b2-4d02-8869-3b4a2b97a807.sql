ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS contexto_data date,
  ADD COLUMN IF NOT EXISTS contexto_atividade text;