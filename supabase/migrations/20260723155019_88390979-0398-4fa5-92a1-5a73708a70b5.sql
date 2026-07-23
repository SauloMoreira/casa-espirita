ALTER TABLE public.assistido_tratamentos
  DROP CONSTRAINT IF EXISTS assistido_tratamentos_origem_check;

ALTER TABLE public.assistido_tratamentos
  ADD CONSTRAINT assistido_tratamentos_origem_check
  CHECK (origem IN ('normal', 'legado', 'entrevista', 'manual'));
