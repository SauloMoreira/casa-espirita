CREATE TABLE public.acao_social_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prazo_final_entrega date,
  observacao_prazo text,
  exibir_prazo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acao_social_config TO authenticated;
GRANT ALL ON public.acao_social_config TO service_role;

ALTER TABLE public.acao_social_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem config da acao social"
  ON public.acao_social_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins inserem config da acao social"
  ON public.acao_social_config FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins atualizam config da acao social"
  ON public.acao_social_config FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins excluem config da acao social"
  ON public.acao_social_config FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_acao_social_config_updated_at
  BEFORE UPDATE ON public.acao_social_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.acao_social_config (exibir_prazo) VALUES (true);