-- 1) Metadados de governança em regras_operacionais
ALTER TABLE public.regras_operacionais
  ADD COLUMN IF NOT EXISTS nome_amigavel text,
  ADD COLUMN IF NOT EXISTS impacto text,
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'inteiro',
  ADD COLUMN IF NOT EXISTS valor_padrao text,
  ADD COLUMN IF NOT EXISTS valor_min numeric,
  ADD COLUMN IF NOT EXISTS valor_max numeric,
  ADD COLUMN IF NOT EXISTS opcoes jsonb,
  ADD COLUMN IF NOT EXISTS sensivel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmacao_reforcada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS governavel boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'regras_operacionais_tipo_check'
  ) THEN
    ALTER TABLE public.regras_operacionais
      ADD CONSTRAINT regras_operacionais_tipo_check
      CHECK (tipo IN ('booleano','inteiro','texto','enum','json'));
  END IF;
END $$;

-- 2) Metadados dos 3 parâmetros iniciais governados
UPDATE public.regras_operacionais SET
  tipo = 'booleano',
  nome_amigavel = 'Confirmação imediata de agendamento (tratamentos)',
  impacto = 'Ligar esta flag reativa a confirmação imediata de agendamento para tratamentos, alterando a política atual da casa. Por padrão, tratamentos devem receber apenas o lembrete da próxima sessão real, e não uma mensagem no momento do agendamento.',
  valor_padrao = 'false',
  sensivel = true,
  confirmacao_reforcada = true,
  governavel = true
WHERE chave = 'tratamento_confirmacao_agendamento_ativa';

UPDATE public.regras_operacionais SET
  tipo = 'inteiro',
  nome_amigavel = 'Antecedência do lembrete de tratamento (horas)',
  impacto = 'Define com quantas horas de antecedência o lembrete de tratamento é gerado antes da sessão. Valor padrão: 24 horas. Faixa permitida: 1 a 168 horas (até 7 dias).',
  valor_padrao = '24',
  valor_min = 1,
  valor_max = 168,
  sensivel = false,
  confirmacao_reforcada = false,
  governavel = true
WHERE chave = 'tratamento_lembrete_antecedencia_horas';

UPDATE public.regras_operacionais SET
  tipo = 'booleano',
  nome_amigavel = 'Notificação por exceção operacional (kill switch)',
  impacto = 'Contenção crítica. Desligar pausa imediatamente o processamento de notificações por exceção operacional, inclusive a reconciliação no cron, sem afetar a agenda já registrada. Ligar reativa o fluxo normal de notificações por exceção.',
  valor_padrao = 'true',
  sensivel = true,
  confirmacao_reforcada = true,
  governavel = true
WHERE chave = 'excecao_notificacao_ativa';

-- 3) Listagem oficial dos parâmetros governados
CREATE OR REPLACE FUNCTION public.fn_listar_parametros_operacionais()
RETURNS TABLE (
  id uuid,
  chave text,
  nome_amigavel text,
  descricao text,
  impacto text,
  tipo text,
  valor text,
  valor_padrao text,
  valor_min numeric,
  valor_max numeric,
  opcoes jsonb,
  sensivel boolean,
  confirmacao_reforcada boolean,
  ativo boolean,
  updated_at timestamptz,
  updated_by uuid,
  alterado_por_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id, r.chave, r.nome_amigavel, r.descricao, r.impacto, r.tipo,
    r.valor, r.valor_padrao, r.valor_min, r.valor_max, r.opcoes,
    r.sensivel, r.confirmacao_reforcada, r.ativo,
    r.updated_at, r.updated_by, p.nome_completo
  FROM public.regras_operacionais r
  LEFT JOIN public.profiles p ON p.user_id = r.updated_by
  WHERE r.governavel = true
    AND (public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'administrador_master'))
  ORDER BY r.sensivel DESC, r.nome_amigavel;
$$;

-- 4) Alteração oficial e auditada
CREATE OR REPLACE FUNCTION public.fn_atualizar_parametro_operacional(
  p_chave text,
  p_valor text,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.regras_operacionais%ROWTYPE;
  v_valor text;
  v_num numeric;
  v_anterior text;
BEGIN
  -- Permissão no backend
  IF NOT (public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'administrador_master')) THEN
    RAISE EXCEPTION 'Permissão negada: apenas administradores podem alterar parâmetros operacionais';
  END IF;

  SELECT * INTO v_row FROM public.regras_operacionais WHERE chave = p_chave;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parâmetro "%" não encontrado', p_chave;
  END IF;
  IF v_row.governavel IS NOT TRUE THEN
    RAISE EXCEPTION 'Parâmetro "%" não é governável pelo painel', p_chave;
  END IF;

  v_valor := btrim(coalesce(p_valor, ''));

  -- Validação de tipo / faixa
  IF v_row.tipo = 'booleano' THEN
    IF v_valor NOT IN ('true','false') THEN
      RAISE EXCEPTION 'Valor inválido para flag booleana: %. Use true ou false', p_valor;
    END IF;
  ELSIF v_row.tipo = 'inteiro' THEN
    IF v_valor !~ '^-?\d+$' THEN
      RAISE EXCEPTION 'Valor inválido para parâmetro numérico inteiro: %', p_valor;
    END IF;
    v_num := v_valor::numeric;
    IF v_row.valor_min IS NOT NULL AND v_num < v_row.valor_min THEN
      RAISE EXCEPTION 'Valor % abaixo do mínimo permitido (%)', v_valor, v_row.valor_min;
    END IF;
    IF v_row.valor_max IS NOT NULL AND v_num > v_row.valor_max THEN
      RAISE EXCEPTION 'Valor % acima do máximo permitido (%)', v_valor, v_row.valor_max;
    END IF;
  ELSIF v_row.tipo = 'enum' THEN
    IF v_row.opcoes IS NULL OR NOT (v_row.opcoes ? v_valor) THEN
      RAISE EXCEPTION 'Valor "%" não está entre as opções permitidas', v_valor;
    END IF;
  ELSIF v_row.tipo = 'json' THEN
    BEGIN
      PERFORM v_valor::jsonb;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Valor inválido: JSON malformado';
    END;
  END IF;
  -- 'texto' aceita qualquer string

  v_anterior := v_row.valor;

  UPDATE public.regras_operacionais
     SET valor = v_valor,
         updated_by = auth.uid(),
         updated_at = now()
   WHERE id = v_row.id
   RETURNING * INTO v_row;

  -- Auditoria completa
  INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_anteriores, dados_novos)
  VALUES (
    auth.uid(),
    'atualizar_parametro_operacional',
    'regras_operacionais',
    v_row.id,
    jsonb_build_object('chave', p_chave, 'valor', v_anterior),
    jsonb_build_object(
      'chave', p_chave,
      'valor', v_valor,
      'origem', 'painel_governanca',
      'observacao', nullif(btrim(coalesce(p_observacao, '')), '')
    )
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'chave', v_row.chave,
    'valor', v_row.valor,
    'valor_anterior', v_anterior,
    'updated_at', v_row.updated_at,
    'updated_by', v_row.updated_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_listar_parametros_operacionais() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_atualizar_parametro_operacional(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_listar_parametros_operacionais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_atualizar_parametro_operacional(text, text, text) TO authenticated;