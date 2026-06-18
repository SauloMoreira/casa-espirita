-- ============ EXCEÇÕES OPERACIONAIS ============
CREATE TABLE public.excecoes_operacionais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL DEFAULT 'publico',                 -- publico | tratamento | entrevista | outro
  atividade text NOT NULL,                              -- nome da atividade/tratamento/item afetado
  tratamento_id uuid REFERENCES public.tipos_tratamento(id) ON DELETE SET NULL,
  data_excecao date NOT NULL,
  horario_afetado time,
  status text NOT NULL DEFAULT 'cancelado',             -- mantido | cancelado | remarcado | excepcional
  nova_data date,
  novo_horario time,
  motivo text,
  observacao_interna text,
  mensagem_ia text,                                     -- mensagem sugerida para a IA
  prioridade integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.excecoes_operacionais TO authenticated;
GRANT ALL ON public.excecoes_operacionais TO service_role;

ALTER TABLE public.excecoes_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff podem ver excecoes operacionais"
  ON public.excecoes_operacionais FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'coordenador_de_tratamento')
    OR has_role(auth.uid(), 'entrevistador')
    OR has_role(auth.uid(), 'tarefeiro')
  );

CREATE POLICY "Admin e coordenador gerenciam excecoes - insert"
  ON public.excecoes_operacionais FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_de_tratamento'));

CREATE POLICY "Admin e coordenador gerenciam excecoes - update"
  ON public.excecoes_operacionais FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_de_tratamento'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_de_tratamento'));

CREATE POLICY "Admin e coordenador gerenciam excecoes - delete"
  ON public.excecoes_operacionais FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_de_tratamento'));

CREATE TRIGGER trg_excecoes_updated_at
  BEFORE UPDATE ON public.excecoes_operacionais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_excecoes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.excecoes_operacionais
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE INDEX idx_excecoes_data ON public.excecoes_operacionais (data_excecao) WHERE ativo;
CREATE INDEX idx_excecoes_tratamento ON public.excecoes_operacionais (tratamento_id);

-- ============ PROGRAMAÇÃO PADRÃO DA CASA ============
CREATE TABLE public.programacao_padrao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL DEFAULT 'publico',                 -- publico | tratamento | entrevista | outro
  atividade text NOT NULL,
  tratamento_id uuid REFERENCES public.tipos_tratamento(id) ON DELETE SET NULL,
  dia_semana integer NOT NULL,                          -- 0=domingo .. 6=sabado
  horario time,
  frequencia text,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programacao_padrao TO authenticated;
GRANT ALL ON public.programacao_padrao TO service_role;

ALTER TABLE public.programacao_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff podem ver programacao padrao"
  ON public.programacao_padrao FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'coordenador_de_tratamento')
    OR has_role(auth.uid(), 'entrevistador')
    OR has_role(auth.uid(), 'tarefeiro')
  );

CREATE POLICY "Admin e coordenador gerenciam programacao - insert"
  ON public.programacao_padrao FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_de_tratamento'));

CREATE POLICY "Admin e coordenador gerenciam programacao - update"
  ON public.programacao_padrao FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_de_tratamento'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_de_tratamento'));

CREATE POLICY "Admin e coordenador gerenciam programacao - delete"
  ON public.programacao_padrao FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_de_tratamento'));

CREATE TRIGGER trg_programacao_updated_at
  BEFORE UPDATE ON public.programacao_padrao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_programacao_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.programacao_padrao
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE INDEX idx_programacao_dia ON public.programacao_padrao (dia_semana) WHERE ativo;