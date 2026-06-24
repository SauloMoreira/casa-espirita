-- Novo tipo de evento da fila: mensagem manual controlada (ação humana administrativa)
ALTER TYPE public.notif_evento ADD VALUE IF NOT EXISTS 'mensagem_manual';