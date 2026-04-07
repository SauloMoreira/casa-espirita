
-- Add public work parameterization fields to tipos_tratamento
ALTER TABLE public.tipos_tratamento
  ADD COLUMN IF NOT EXISTS trabalho_publico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_entrada_sem_agendamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exige_controle_presenca boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS modo_checkin text NOT NULL DEFAULT 'qr_do_dia',
  ADD COLUMN IF NOT EXISTS permite_cadastro_rapido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_registro_manual boolean NOT NULL DEFAULT false;

-- Create sessoes_publicas table
CREATE TABLE public.sessoes_publicas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tratamento_id uuid NOT NULL REFERENCES public.tipos_tratamento(id) ON DELETE CASCADE,
  data_sessao date NOT NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  horario_inicio time,
  horario_fim time,
  status text NOT NULL DEFAULT 'aberta',
  total_presentes integer NOT NULL DEFAULT 0,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tratamento_id, data_sessao)
);

ALTER TABLE public.sessoes_publicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sessoes_publicas" ON public.sessoes_publicas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tarefeiros manage sessoes_publicas" ON public.sessoes_publicas FOR ALL TO authenticated USING (has_role(auth.uid(), 'tarefeiro'::app_role));
CREATE POLICY "Authenticated read sessoes_publicas" ON public.sessoes_publicas FOR SELECT TO authenticated USING (true);

-- Create checkins_publicos table
CREATE TABLE public.checkins_publicos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sessao_id uuid NOT NULL REFERENCES public.sessoes_publicas(id) ON DELETE CASCADE,
  assistido_id uuid REFERENCES public.assistidos(id),
  nome_participante text,
  celular text,
  faixa_etaria text,
  modo_checkin text NOT NULL DEFAULT 'qr',
  cadastro_rapido boolean NOT NULL DEFAULT false,
  checkin_at timestamptz NOT NULL DEFAULT now(),
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkins_publicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage checkins_publicos" ON public.checkins_publicos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tarefeiros manage checkins_publicos" ON public.checkins_publicos FOR ALL TO authenticated USING (has_role(auth.uid(), 'tarefeiro'::app_role));
CREATE POLICY "Authenticated insert own checkin" ON public.checkins_publicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated read checkins" ON public.checkins_publicos FOR SELECT TO authenticated USING (true);

-- Create unique index to prevent duplicate checkins
CREATE UNIQUE INDEX idx_checkin_unique_assistido ON public.checkins_publicos (sessao_id, assistido_id) WHERE assistido_id IS NOT NULL;
CREATE UNIQUE INDEX idx_checkin_unique_celular ON public.checkins_publicos (sessao_id, celular) WHERE celular IS NOT NULL AND assistido_id IS NULL;

-- Trigger to update total_presentes
CREATE OR REPLACE FUNCTION public.update_sessao_total_presentes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sessoes_publicas
  SET total_presentes = (SELECT count(*) FROM checkins_publicos WHERE sessao_id = COALESCE(NEW.sessao_id, OLD.sessao_id)),
      updated_at = now()
  WHERE id = COALESCE(NEW.sessao_id, OLD.sessao_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_sessao_total
AFTER INSERT OR DELETE ON public.checkins_publicos
FOR EACH ROW EXECUTE FUNCTION public.update_sessao_total_presentes();

-- Updated_at trigger for sessoes_publicas
CREATE TRIGGER update_sessoes_publicas_updated_at
BEFORE UPDATE ON public.sessoes_publicas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
