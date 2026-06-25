
-- ============================================================
-- MELHORIA-01: Fluxo oficial de "não poderei comparecer"
-- ============================================================

-- 1) TABELA OFICIAL
CREATE TABLE public.avisos_ausencia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assistido_id uuid NOT NULL REFERENCES public.assistidos(id) ON DELETE CASCADE,
  agenda_id uuid REFERENCES public.agenda_tratamentos_assistido(id) ON DELETE CASCADE,
  entrevista_id uuid REFERENCES public.entrevistas_fraternas(id) ON DELETE CASCADE,
  tipo_compromisso text NOT NULL CHECK (tipo_compromisso IN ('sessao','entrevista')),
  data_compromisso date NOT NULL,
  motivo text,
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','em_tratamento','resolvido','descartado')),
  tratado_por uuid,
  tratado_em timestamptz,
  resolucao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Exatamente um compromisso, coerente com o tipo
  CONSTRAINT avisos_ausencia_compromisso_chk CHECK (
    (tipo_compromisso = 'sessao'     AND agenda_id IS NOT NULL AND entrevista_id IS NULL)
    OR
    (tipo_compromisso = 'entrevista' AND entrevista_id IS NOT NULL AND agenda_id IS NULL)
  )
);

-- Trava estrutural de duplicidade: 1 aviso aberto/em tratamento por compromisso
CREATE UNIQUE INDEX uq_avisos_ausencia_sessao_aberto
  ON public.avisos_ausencia (agenda_id)
  WHERE agenda_id IS NOT NULL AND status IN ('aberto','em_tratamento');

CREATE UNIQUE INDEX uq_avisos_ausencia_entrevista_aberto
  ON public.avisos_ausencia (entrevista_id)
  WHERE entrevista_id IS NOT NULL AND status IN ('aberto','em_tratamento');

CREATE INDEX idx_avisos_ausencia_status ON public.avisos_ausencia (status);
CREATE INDEX idx_avisos_ausencia_assistido ON public.avisos_ausencia (assistido_id);

-- 2) GRANTS
GRANT SELECT ON public.avisos_ausencia TO authenticated;
GRANT ALL ON public.avisos_ausencia TO service_role;

-- 3) RLS
ALTER TABLE public.avisos_ausencia ENABLE ROW LEVEL SECURITY;

-- Assistido vê o próprio aviso (inclui motivo, é conteúdo dele)
CREATE POLICY "Assistido vê os próprios avisos"
  ON public.avisos_ausencia FOR SELECT TO authenticated
  USING (
    assistido_id IN (SELECT a.id FROM public.assistidos a WHERE a.user_id = auth.uid())
  );

-- Equipe autorizada vê tudo (admin, master, coordenação, entrevistador).
-- Tarefeiro propositalmente NÃO tem leitura direta: só acessa metadados via RPC.
CREATE POLICY "Equipe autorizada vê avisos completos"
  ON public.avisos_ausencia FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'administrador_master')
    OR public.has_role(auth.uid(), 'coordenador_de_tratamento')
    OR public.has_role(auth.uid(), 'entrevistador')
  );

-- updated_at trigger
CREATE TRIGGER trg_avisos_ausencia_updated_at
  BEFORE UPDATE ON public.avisos_ausencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4) RPC: registrar aviso (assistido)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_registrar_aviso_ausencia(
  p_tipo_compromisso text,
  p_compromisso_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_assistido_id uuid;
  v_assistido_nome text;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_data date;
  v_aviso_id uuid;
  v_entrevistador uuid;
  v_dest uuid;
  v_titulo text := 'Aviso de não comparecimento';
  v_msg text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado';
  END IF;

  IF v_motivo IS NOT NULL AND char_length(v_motivo) > 500 THEN
    RAISE EXCEPTION 'motivo_muito_longo' USING HINT = 'Limite de 500 caracteres.';
  END IF;

  -- Titularidade: o aviso é sempre do assistido autenticado
  SELECT a.id, a.nome INTO v_assistido_id, v_assistido_nome
  FROM public.assistidos a WHERE a.user_id = v_uid;
  IF v_assistido_id IS NULL THEN
    RAISE EXCEPTION 'assistido_invalido' USING HINT = 'Usuário não vinculado a um assistido.';
  END IF;

  IF p_tipo_compromisso = 'sessao' THEN
    -- Compromisso real, do próprio assistido e elegível (agendado e futuro)
    SELECT s.data_sessao INTO v_data
    FROM public.agenda_tratamentos_assistido s
    WHERE s.id = p_compromisso_id AND s.assistido_id = v_assistido_id;
    IF v_data IS NULL THEN
      RAISE EXCEPTION 'compromisso_invalido' USING HINT = 'Sessão não encontrada para este assistido.';
    END IF;
    PERFORM 1 FROM public.agenda_tratamentos_assistido s
      WHERE s.id = p_compromisso_id AND s.status = 'agendado' AND s.data_sessao >= current_date;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'compromisso_inelegivel' USING HINT = 'A sessão precisa estar agendada e ser futura.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.avisos_ausencia
      WHERE agenda_id = p_compromisso_id AND status IN ('aberto','em_tratamento')
    ) THEN
      RAISE EXCEPTION 'aviso_duplicado' USING HINT = 'Já existe um aviso em aberto para esta sessão.';
    END IF;

    INSERT INTO public.avisos_ausencia (assistido_id, agenda_id, tipo_compromisso, data_compromisso, motivo)
    VALUES (v_assistido_id, p_compromisso_id, 'sessao', v_data, v_motivo)
    RETURNING id INTO v_aviso_id;

  ELSIF p_tipo_compromisso = 'entrevista' THEN
    SELECT e.data::date, e.entrevistador_id INTO v_data, v_entrevistador
    FROM public.entrevistas_fraternas e
    WHERE e.id = p_compromisso_id AND e.assistido_id = v_assistido_id;
    IF v_data IS NULL THEN
      RAISE EXCEPTION 'compromisso_invalido' USING HINT = 'Entrevista não encontrada para este assistido.';
    END IF;
    PERFORM 1 FROM public.entrevistas_fraternas e
      WHERE e.id = p_compromisso_id AND e.status = 'agendada' AND e.data >= now();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'compromisso_inelegivel' USING HINT = 'A entrevista precisa estar agendada e ser futura.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.avisos_ausencia
      WHERE entrevista_id = p_compromisso_id AND status IN ('aberto','em_tratamento')
    ) THEN
      RAISE EXCEPTION 'aviso_duplicado' USING HINT = 'Já existe um aviso em aberto para esta entrevista.';
    END IF;

    INSERT INTO public.avisos_ausencia (assistido_id, entrevista_id, tipo_compromisso, data_compromisso, motivo)
    VALUES (v_assistido_id, p_compromisso_id, 'entrevista', v_data, v_motivo)
    RETURNING id INTO v_aviso_id;
  ELSE
    RAISE EXCEPTION 'tipo_invalido' USING HINT = 'Tipo de compromisso inválido.';
  END IF;

  -- ALERTA OPERACIONAL (sem motivo). Coordenação sempre; entrevistador quando houver.
  v_msg := v_assistido_nome || ' avisou que não poderá comparecer ('
    || CASE WHEN p_tipo_compromisso = 'sessao' THEN 'sessão' ELSE 'entrevista' END
    || ' em ' || to_char(v_data, 'DD/MM/YYYY') || ').';

  FOR v_dest IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    WHERE ur.role IN ('admin','administrador_master','coordenador_de_tratamento')
    UNION
    SELECT v_entrevistador WHERE v_entrevistador IS NOT NULL
  LOOP
    IF v_dest IS NOT NULL AND v_dest <> v_uid THEN
      INSERT INTO public.avisos_internos (destinatario_id, tipo, titulo, mensagem, created_by)
      VALUES (v_dest, 'aviso_ausencia', v_titulo, v_msg, v_uid);
    END IF;
  END LOOP;

  -- AUDITORIA (trilha privilegiada)
  INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
  VALUES (v_uid, 'aviso_ausencia_registrado', 'avisos_ausencia', v_aviso_id,
    jsonb_build_object(
      'tipo_compromisso', p_tipo_compromisso,
      'compromisso_id', p_compromisso_id,
      'data_compromisso', v_data,
      'tem_motivo', (v_motivo IS NOT NULL)
    ));

  RETURN jsonb_build_object('id', v_aviso_id, 'status', 'aberto');
END;
$function$;

-- ============================================================
-- 5) RPC: tratar aviso (equipe)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_tratar_aviso_ausencia(
  p_aviso_id uuid,
  p_novo_status text,
  p_resolucao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_resolucao text := nullif(btrim(coalesce(p_resolucao, '')), '');
  v_status_anterior text;
BEGIN
  IF v_uid IS NULL
     OR NOT (
       public.has_role(v_uid, 'admin')
       OR public.has_role(v_uid, 'administrador_master')
       OR public.has_role(v_uid, 'coordenador_de_tratamento')
       OR public.has_role(v_uid, 'entrevistador')
     ) THEN
    RAISE EXCEPTION 'permissao_negada' USING HINT = 'Sem permissão para tratar avisos.';
  END IF;

  IF p_novo_status NOT IN ('em_tratamento','resolvido','descartado') THEN
    RAISE EXCEPTION 'status_invalido' USING HINT = 'Status de tratamento inválido.';
  END IF;

  IF v_resolucao IS NOT NULL AND char_length(v_resolucao) > 1000 THEN
    RAISE EXCEPTION 'resolucao_muito_longa' USING HINT = 'Limite de 1000 caracteres.';
  END IF;

  SELECT status INTO v_status_anterior FROM public.avisos_ausencia WHERE id = p_aviso_id;
  IF v_status_anterior IS NULL THEN
    RAISE EXCEPTION 'aviso_inexistente';
  END IF;

  UPDATE public.avisos_ausencia
  SET status = p_novo_status,
      tratado_por = v_uid,
      tratado_em = now(),
      resolucao = COALESCE(v_resolucao, resolucao)
  WHERE id = p_aviso_id;

  INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_anteriores, dados_novos)
  VALUES (v_uid, 'aviso_ausencia_tratado', 'avisos_ausencia', p_aviso_id,
    jsonb_build_object('status', v_status_anterior),
    jsonb_build_object('status', p_novo_status));

  RETURN jsonb_build_object('id', p_aviso_id, 'status', p_novo_status);
END;
$function$;

-- ============================================================
-- 6) RPC: listar avisos pendentes (payload por perfil)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_avisos_ausencia_pendentes(
  p_incluir_resolvidos boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  assistido_id uuid,
  assistido_nome text,
  tipo_compromisso text,
  data_compromisso date,
  status text,
  tratado_por uuid,
  tratado_em timestamptz,
  created_at timestamptz,
  motivo text,
  resolucao text,
  pode_ver_conteudo boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_autorizado boolean;
  v_tarefeiro boolean;
BEGIN
  v_autorizado := public.has_role(v_uid, 'admin')
    OR public.has_role(v_uid, 'administrador_master')
    OR public.has_role(v_uid, 'coordenador_de_tratamento')
    OR public.has_role(v_uid, 'entrevistador');
  v_tarefeiro := public.has_role(v_uid, 'tarefeiro');

  -- Apenas equipe (autorizada ou tarefeiro) pode listar
  IF NOT (v_autorizado OR v_tarefeiro) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    av.id,
    av.assistido_id,
    a.nome AS assistido_nome,
    av.tipo_compromisso,
    av.data_compromisso,
    av.status,
    av.tratado_por,
    av.tratado_em,
    av.created_at,
    -- Conteúdo sensível somente para perfis autorizados
    CASE WHEN v_autorizado THEN av.motivo ELSE NULL END AS motivo,
    CASE WHEN v_autorizado THEN av.resolucao ELSE NULL END AS resolucao,
    v_autorizado AS pode_ver_conteudo
  FROM public.avisos_ausencia av
  JOIN public.assistidos a ON a.id = av.assistido_id
  WHERE (p_incluir_resolvidos OR av.status IN ('aberto','em_tratamento'))
  ORDER BY av.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_registrar_aviso_ausencia(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_tratar_aviso_ausencia(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_avisos_ausencia_pendentes(boolean) TO authenticated;
