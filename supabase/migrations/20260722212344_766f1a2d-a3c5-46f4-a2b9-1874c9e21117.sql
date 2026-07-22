
-- Storage policies for the acao-social-documentos bucket
CREATE POLICY "Staff acao social le documentos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'acao-social-documentos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'))
  );

CREATE POLICY "Staff acao social envia documentos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'acao-social-documentos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'))
  );

CREATE POLICY "Staff acao social remove documentos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'acao-social-documentos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'))
  );

-- Beneficiarios
CREATE TABLE public.acao_social_beneficiarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistido_id uuid REFERENCES public.assistidos(id),
  nome text NOT NULL,
  data_nascimento date,
  cpf text,
  rg text,
  celular text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  situacao_moradia text CHECK (situacao_moradia IN ('propria','alugada','cedida','outra')),
  renda_familiar numeric,
  bens text,
  gasto_luz numeric,
  gasto_agua numeric,
  gasto_gas numeric,
  gasto_alimentacao numeric,
  foto_url text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  beneficio_desde date NOT NULL DEFAULT CURRENT_DATE,
  prorrogado boolean NOT NULL DEFAULT false,
  motivo_prorrogacao text,
  nova_data_limite date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(user_id),
  updated_by uuid REFERENCES public.profiles(user_id),
  CONSTRAINT acao_social_prorrogacao_exige_motivo
    CHECK (prorrogado = false OR (motivo_prorrogacao IS NOT NULL AND length(trim(motivo_prorrogacao)) > 0))
);
CREATE INDEX idx_acao_social_beneficiarios_ativo ON public.acao_social_beneficiarios(ativo);

CREATE TABLE public.acao_social_parentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiario_id uuid NOT NULL REFERENCES public.acao_social_beneficiarios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('esposa','marido','filho','filha','agregado','outro')),
  data_nascimento date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.acao_social_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiario_id uuid NOT NULL REFERENCES public.acao_social_beneficiarios(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  entregue boolean NOT NULL DEFAULT false,
  entregue_em timestamptz,
  entregue_por uuid REFERENCES public.profiles(user_id),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (beneficiario_id, competencia)
);

CREATE TABLE public.acao_social_cesta_aviso_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_inicio_aviso integer NOT NULL DEFAULT 25 CHECK (dia_inicio_aviso BETWEEN 1 AND 28),
  dias_duracao_aviso integer NOT NULL DEFAULT 10 CHECK (dias_duracao_aviso BETWEEN 1 AND 28),
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(user_id)
);
INSERT INTO public.acao_social_cesta_aviso_config (dia_inicio_aviso, dias_duracao_aviso)
VALUES (25, 10);

CREATE TABLE public.acao_social_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiario_id uuid NOT NULL REFERENCES public.acao_social_beneficiarios(id) ON DELETE CASCADE,
  parente_id uuid REFERENCES public.acao_social_parentes(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL CHECK (tipo_documento IN (
    'comprovante_endereco', 'cpf', 'certidao_nascimento', 'carteira_vacinacao', 'comprovante_matricula', 'outro'
  )),
  storage_path text NOT NULL,
  nome_arquivo text NOT NULL,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(user_id)
);
CREATE INDEX idx_acao_social_documentos_beneficiario ON public.acao_social_documentos(beneficiario_id);

GRANT ALL ON public.acao_social_beneficiarios TO authenticated, service_role;
GRANT ALL ON public.acao_social_parentes TO authenticated, service_role;
GRANT ALL ON public.acao_social_entregas TO authenticated, service_role;
GRANT ALL ON public.acao_social_cesta_aviso_config TO authenticated, service_role;
GRANT ALL ON public.acao_social_documentos TO authenticated, service_role;

ALTER TABLE public.acao_social_beneficiarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gerencia beneficiarios acao social"
  ON public.acao_social_beneficiarios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'));

ALTER TABLE public.acao_social_parentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gerencia parentes acao social"
  ON public.acao_social_parentes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'));

ALTER TABLE public.acao_social_entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gerencia entregas acao social"
  ON public.acao_social_entregas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'));

ALTER TABLE public.acao_social_cesta_aviso_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia config aviso cesta"
  ON public.acao_social_cesta_aviso_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff le config aviso cesta"
  ON public.acao_social_cesta_aviso_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'));

ALTER TABLE public.acao_social_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gerencia documentos acao social"
  ON public.acao_social_documentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agente_acao_social'));

CREATE OR REPLACE FUNCTION public.proteger_datas_beneficio_acao_social()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.beneficio_desde IS DISTINCT FROM OLD.beneficio_desde
     OR NEW.nova_data_limite IS DISTINCT FROM OLD.nova_data_limite THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar as datas de início/limite do benefício após o cadastro.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proteger_datas_beneficio
BEFORE UPDATE ON public.acao_social_beneficiarios
FOR EACH ROW
EXECUTE FUNCTION public.proteger_datas_beneficio_acao_social();
