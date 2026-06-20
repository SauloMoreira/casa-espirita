CREATE TABLE public.ia_site_documentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL UNIQUE,
  titulo text NOT NULL DEFAULT '',
  resumo text NOT NULL DEFAULT '',
  corpo text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'outros'
    CHECK (categoria IN ('tratamento','institucional','contato','doacao','campanha','evento','comunicado','outros')),
  prioridade text NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('alta','media','baixa','condicionada')),
  temporal boolean NOT NULL DEFAULT false,
  data_conteudo date,
  usar_na_ia boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','ativo','inativo')),
  hash text,
  captured_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_site_documentos TO authenticated;
GRANT ALL ON public.ia_site_documentos TO service_role;

ALTER TABLE public.ia_site_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam base do site"
  ON public.ia_site_documentos
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ia_site_documentos_updated_at
  BEFORE UPDATE ON public.ia_site_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ia_site_documentos_stamp_actor
  BEFORE INSERT OR UPDATE ON public.ia_site_documentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_actor();

CREATE TRIGGER trg_ia_site_documentos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ia_site_documentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE INDEX idx_ia_site_documentos_status ON public.ia_site_documentos (status);
CREATE INDEX idx_ia_site_documentos_categoria ON public.ia_site_documentos (categoria);
CREATE INDEX idx_ia_site_documentos_usar ON public.ia_site_documentos (usar_na_ia);

INSERT INTO public.regras_operacionais (chave, valor, ativo, descricao)
VALUES
  ('site_ia_ativo', 'true', true,
   'Liga/desliga a consulta à base de conhecimento do site institucional pela IA.'),
  ('site_ia_max_documentos', '3', true,
   'Quantidade máxima de documentos do site usados como contexto pela IA.')
ON CONFLICT (chave) DO NOTHING;