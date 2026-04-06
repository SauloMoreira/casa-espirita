
CREATE TABLE public.voluntarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo text NOT NULL,
  celular text NOT NULL,
  cpf text NOT NULL,
  email text NOT NULL,
  rg text,
  data_nascimento date NOT NULL,
  cep text NOT NULL,
  logradouro text NOT NULL,
  numero text NOT NULL,
  complemento text,
  bairro text NOT NULL,
  cidade text NOT NULL,
  estado text NOT NULL,
  foto_url text,
  data_ingresso_sistema date NOT NULL DEFAULT CURRENT_DATE,
  data_adesao_voluntariado date,
  tipos_voluntario text[] NOT NULL DEFAULT '{}'::text[],
  atuacao_detalhada text,
  status text NOT NULL DEFAULT 'ativo',
  data_desligamento date,
  observacoes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT voluntarios_cpf_unique UNIQUE (cpf)
);

ALTER TABLE public.voluntarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage voluntarios"
  ON public.voluntarios FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_voluntarios_updated_at
  BEFORE UPDATE ON public.voluntarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_voluntarios
  AFTER INSERT OR UPDATE OR DELETE ON public.voluntarios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_trigger();
