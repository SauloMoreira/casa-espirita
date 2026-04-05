
ALTER TABLE public.tipos_tratamento
  ADD COLUMN IF NOT EXISTS ordem_tratamento integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tratamento_livre boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueia_proximo_tratamento boolean NOT NULL DEFAULT false;
