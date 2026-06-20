ALTER TABLE public.assistidos
  ADD COLUMN IF NOT EXISTS origem_cadastro text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS migrado_legado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_migracao timestamptz,
  ADD COLUMN IF NOT EXISTS observacao_migracao text;

ALTER TABLE public.assistidos
  DROP CONSTRAINT IF EXISTS assistidos_origem_cadastro_check;
ALTER TABLE public.assistidos
  ADD CONSTRAINT assistidos_origem_cadastro_check CHECK (origem_cadastro IN ('normal','legado'));

ALTER TABLE public.assistido_tratamentos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS observacao_migracao text;

ALTER TABLE public.assistido_tratamentos
  DROP CONSTRAINT IF EXISTS assistido_tratamentos_origem_check;
ALTER TABLE public.assistido_tratamentos
  ADD CONSTRAINT assistido_tratamentos_origem_check CHECK (origem IN ('normal','legado'));