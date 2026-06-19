CREATE TABLE public.eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  subtitulo text,
  descricao_curta text,
  descricao_completa text,
  imagem_url text,
  imagem_origem text NOT NULL DEFAULT 'manual',
  local text,
  data_evento timestamptz,
  data_evento_fim timestamptz,
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos TO authenticated;
GRANT ALL ON public.eventos TO service_role;

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem eventos vigentes"
  ON public.eventos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      ativo = true
      AND (data_inicio IS NULL OR data_inicio <= CURRENT_DATE)
      AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
    )
  );

CREATE POLICY "Admins gerenciam eventos (insert)"
  ON public.eventos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gerenciam eventos (update)"
  ON public.eventos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gerenciam eventos (delete)"
  ON public.eventos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_eventos_updated_at
  BEFORE UPDATE ON public.eventos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER stamp_actor_eventos
  BEFORE INSERT OR UPDATE ON public.eventos
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_actor();

CREATE TRIGGER audit_eventos
  AFTER INSERT OR UPDATE OR DELETE ON public.eventos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE INDEX idx_eventos_ativo_ordem ON public.eventos (ativo, ordem);
CREATE INDEX idx_eventos_data_evento ON public.eventos (data_evento);