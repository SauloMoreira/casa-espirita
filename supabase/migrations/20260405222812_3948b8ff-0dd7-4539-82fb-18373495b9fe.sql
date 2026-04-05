
-- 1. Add new role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador_de_tratamento';

-- 2. Add coordenador_responsavel_id to tipos_tratamento
ALTER TABLE public.tipos_tratamento
ADD COLUMN IF NOT EXISTS coordenador_responsavel_id uuid;

-- 3. Add agendado_por to assistido_tratamentos
ALTER TABLE public.assistido_tratamentos
ADD COLUMN IF NOT EXISTS agendado_por uuid;
