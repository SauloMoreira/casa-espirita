ALTER TABLE public.notificacoes_preferencias
  ADD COLUMN IF NOT EXISTS comunicacao_geral_ativa boolean NOT NULL DEFAULT true;

ALTER TYPE public.notif_evento ADD VALUE IF NOT EXISTS 'presenca_registrada';
ALTER TYPE public.notif_evento ADD VALUE IF NOT EXISTS 'falta_registrada';