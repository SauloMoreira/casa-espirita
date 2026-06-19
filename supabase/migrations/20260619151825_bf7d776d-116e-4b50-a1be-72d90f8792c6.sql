-- ============================================================
-- Módulo 1: Ação Social — Lista de Alimentos
-- ============================================================
CREATE TABLE public.acao_social_alimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  unidade text,
  quantidade_necessaria numeric,
  quantidade_faltante numeric,
  observacao text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acao_social_alimentos TO authenticated;
GRANT ALL ON public.acao_social_alimentos TO service_role;

ALTER TABLE public.acao_social_alimentos ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode visualizar itens ativos (área do assistido).
CREATE POLICY "Autenticados veem alimentos ativos"
  ON public.acao_social_alimentos FOR SELECT TO authenticated
  USING (ativo = true OR public.has_role(auth.uid(), 'admin'));

-- Apenas administradores gerenciam.
CREATE POLICY "Admins gerenciam alimentos (insert)"
  ON public.acao_social_alimentos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gerenciam alimentos (update)"
  ON public.acao_social_alimentos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gerenciam alimentos (delete)"
  ON public.acao_social_alimentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Timestamps + autoria (reaproveita funções existentes).
CREATE TRIGGER update_acao_social_alimentos_updated_at
  BEFORE UPDATE ON public.acao_social_alimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER stamp_actor_acao_social_alimentos
  BEFORE INSERT OR UPDATE ON public.acao_social_alimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_actor();

-- Auditoria detalhada (reaproveita trigger de auditoria existente).
CREATE TRIGGER audit_acao_social_alimentos
  AFTER INSERT OR UPDATE OR DELETE ON public.acao_social_alimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE INDEX idx_acao_social_alimentos_ativo_ordem
  ON public.acao_social_alimentos (ativo, ordem);