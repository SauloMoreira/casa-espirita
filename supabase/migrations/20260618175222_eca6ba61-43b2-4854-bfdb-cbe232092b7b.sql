CREATE TABLE public.cadastro_solicitacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  nome_completo text NOT NULL,
  email text NOT NULL,
  cpf text,
  celular text,
  status text NOT NULL DEFAULT 'pendente',
  motivo_rejeicao text,
  decidido_por uuid,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadastro_solicitacoes TO authenticated;
GRANT ALL ON public.cadastro_solicitacoes TO service_role;

ALTER TABLE public.cadastro_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver solicitacoes de cadastro"
ON public.cadastro_solicitacoes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_cadastro_solicitacoes_status ON public.cadastro_solicitacoes (status, created_at DESC);

CREATE TRIGGER update_cadastro_solicitacoes_updated_at
BEFORE UPDATE ON public.cadastro_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();