
-- Table for volunteer functions/roles
CREATE TABLE public.funcoes_voluntariado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_funcao TEXT NOT NULL,
  tipo_voluntario TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.funcoes_voluntariado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage funcoes_voluntariado" ON public.funcoes_voluntariado
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read funcoes_voluntariado" ON public.funcoes_voluntariado
  FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER update_funcoes_voluntariado_updated_at
  BEFORE UPDATE ON public.funcoes_voluntariado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Junction table for volunteer <-> function
CREATE TABLE public.voluntario_funcoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voluntario_id UUID NOT NULL REFERENCES public.voluntarios(id) ON DELETE CASCADE,
  funcao_id UUID NOT NULL REFERENCES public.funcoes_voluntariado(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (voluntario_id, funcao_id)
);

ALTER TABLE public.voluntario_funcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage voluntario_funcoes" ON public.voluntario_funcoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read voluntario_funcoes" ON public.voluntario_funcoes
  FOR SELECT TO authenticated
  USING (true);
