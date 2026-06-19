-- ============================================================
-- Módulo 2: Campanhas da Casa
-- ============================================================
CREATE TABLE public.campanhas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  subtitulo text,
  descricao_curta text,
  descricao_completa text,
  imagem_url text,
  imagem_origem text NOT NULL DEFAULT 'manual',
  ordem integer NOT NULL DEFAULT 0,
  destaque boolean NOT NULL DEFAULT false,
  data_inicio date,
  data_fim date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO authenticated;
GRANT ALL ON public.campanhas TO service_role;

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

-- Autenticados veem campanhas ativas dentro do período; admins veem tudo.
CREATE POLICY "Autenticados veem campanhas vigentes"
  ON public.campanhas FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      ativo = true
      AND (data_inicio IS NULL OR data_inicio <= CURRENT_DATE)
      AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
    )
  );

CREATE POLICY "Admins gerenciam campanhas (insert)"
  ON public.campanhas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gerenciam campanhas (update)"
  ON public.campanhas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gerenciam campanhas (delete)"
  ON public.campanhas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_campanhas_updated_at
  BEFORE UPDATE ON public.campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER stamp_actor_campanhas
  BEFORE INSERT OR UPDATE ON public.campanhas
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_actor();

CREATE TRIGGER audit_campanhas
  AFTER INSERT OR UPDATE OR DELETE ON public.campanhas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE INDEX idx_campanhas_ativo_ordem ON public.campanhas (ativo, ordem);