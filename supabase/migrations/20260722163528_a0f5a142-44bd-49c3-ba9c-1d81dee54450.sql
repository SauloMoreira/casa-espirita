ALTER TABLE public.assistido_tratamentos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'entrevista'
  CHECK (origem IN ('entrevista', 'manual', 'legado'));

UPDATE public.assistido_tratamentos
SET origem = 'legado'
WHERE entrevista_id IS NULL;