ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS imagem_formato text NOT NULL DEFAULT 'card';
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS imagem_formato text NOT NULL DEFAULT 'card';