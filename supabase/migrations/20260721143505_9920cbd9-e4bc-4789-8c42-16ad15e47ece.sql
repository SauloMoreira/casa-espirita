
ALTER TABLE public.assistidos
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_cpf text,
  ADD COLUMN IF NOT EXISTS responsavel_celular text,
  ADD COLUMN IF NOT EXISTS responsavel_user_id uuid REFERENCES public.profiles(user_id);

UPDATE public.assistidos
SET responsavel_nome = 'Cristiana Fátima Martins Coelho',
    responsavel_cpf = (SELECT cpf FROM public.profiles WHERE user_id = 'f2bd5b0b-028f-4b96-b741-ff42fa1c8a42'),
    responsavel_celular = '21964132123',
    responsavel_user_id = 'f2bd5b0b-028f-4b96-b741-ff42fa1c8a42'
WHERE id = '16b43f03-d7f9-45f9-a9a2-802a45ca813d';

CREATE OR REPLACE FUNCTION public.reconciliar_assistido_com_conta_existente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidato RECORD;
  qtd_candidatos int;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.data_nascimento IS NOT NULL AND NEW.data_nascimento > (CURRENT_DATE - INTERVAL '18 years') THEN
    RETURN NEW;
  END IF;
  IF NEW.cpf IS NOT NULL AND NEW.cpf <> '' THEN
    SELECT count(*) INTO qtd_candidatos
    FROM public.profiles p
    WHERE p.cpf = NEW.cpf
      AND NOT EXISTS (SELECT 1 FROM public.assistidos a2 WHERE a2.user_id = p.user_id);
    IF qtd_candidatos = 1 THEN
      SELECT p.user_id INTO candidato
      FROM public.profiles p
      WHERE p.cpf = NEW.cpf
        AND NOT EXISTS (SELECT 1 FROM public.assistidos a2 WHERE a2.user_id = p.user_id)
      LIMIT 1;
      NEW.user_id := candidato.user_id;
      INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
      VALUES (candidato.user_id, 'reconciliacao_automatica_pos_migracao', 'assistidos', NEW.id,
              jsonb_build_object('match_por', 'cpf'));
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.celular IS NOT NULL AND NEW.celular <> '' THEN
    SELECT count(*) INTO qtd_candidatos
    FROM public.profiles p
    WHERE p.celular = NEW.celular
      AND NOT EXISTS (SELECT 1 FROM public.assistidos a2 WHERE a2.user_id = p.user_id);
    IF qtd_candidatos = 1 THEN
      SELECT p.user_id INTO candidato
      FROM public.profiles p
      WHERE p.celular = NEW.celular
        AND NOT EXISTS (SELECT 1 FROM public.assistidos a2 WHERE a2.user_id = p.user_id)
      LIMIT 1;
      NEW.user_id := candidato.user_id;
      INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
      VALUES (candidato.user_id, 'reconciliacao_automatica_pos_migracao', 'assistidos', NEW.id,
              jsonb_build_object('match_por', 'celular'));
      RETURN NEW;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_meus_dependentes()
RETURNS TABLE (
  id uuid, nome text, data_nascimento date, status text,
  quantidade_palestras integer, cadastro_completo boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.nome, a.data_nascimento, a.status, a.quantidade_palestras, a.cadastro_completo
  FROM public.assistidos a
  WHERE a.responsavel_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_meus_dependentes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meus_dependentes() TO authenticated;

CREATE OR REPLACE FUNCTION public.contar_publico_elegivel(p_versao text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'nao autorizado';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.assistidos a
  LEFT JOIN public.notificacoes_preferencias p ON p.assistido_id = a.id
  WHERE a.deleted_at IS NULL
    AND COALESCE(NULLIF(a.responsavel_celular, ''), NULLIF(a.celular, ''), NULLIF(a.telefone, '')) IS NOT NULL
    AND COALESCE(p.consentimento_status, 'concedido') <> 'revogado'
    AND COALESCE(p.whatsapp_ativo, true) = true;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.preparar_envio_institucional(
  p_comunicacao_id uuid,
  p_versao text,
  p_janela_dias integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_com RECORD;
  v_janela integer := GREATEST(COALESCE(p_janela_dias, 7), 0);
  v_total integer := 0;
  v_bloqueados integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem preparar o envio.');
  END IF;
  SELECT * INTO v_com FROM comunicacoes_institucionais WHERE id = p_comunicacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Comunicação não encontrada.');
  END IF;
  IF v_com.status <> 'aprovada' THEN
    RETURN jsonb_build_object('error', 'A comunicação precisa estar aprovada antes do envio.');
  END IF;
  IF v_com.envio_status NOT IN ('nao_iniciado', 'preparado') THEN
    RETURN jsonb_build_object('error', 'O envio desta comunicação já foi iniciado ou concluído.');
  END IF;
  INSERT INTO comunicacoes_institucionais_envios (
    comunicacao_id, assistido_id, telefone_normalizado, status, motivo
  )
  SELECT
    p_comunicacao_id,
    a.id,
    fn_normalize_phone(COALESCE(NULLIF(a.responsavel_celular, ''), NULLIF(a.celular, ''), NULLIF(a.telefone, ''))),
    CASE
      WHEN v_janela > 0 AND EXISTS (
        SELECT 1 FROM comunicacoes_institucionais_envios e
        WHERE e.assistido_id = a.id
          AND e.status = 'enviado'
          AND e.sent_at >= now() - make_interval(days => v_janela)
      ) THEN 'bloqueado'
      ELSE 'pendente'
    END,
    CASE
      WHEN v_janela > 0 AND EXISTS (
        SELECT 1 FROM comunicacoes_institucionais_envios e
        WHERE e.assistido_id = a.id
          AND e.status = 'enviado'
          AND e.sent_at >= now() - make_interval(days => v_janela)
      ) THEN 'limite_frequencia'
      ELSE NULL
    END
  FROM assistidos a
  LEFT JOIN notificacoes_preferencias p ON p.assistido_id = a.id
  WHERE a.deleted_at IS NULL
    AND COALESCE(NULLIF(a.responsavel_celular, ''), NULLIF(a.celular, ''), NULLIF(a.telefone, '')) IS NOT NULL
    AND COALESCE(p.consentimento_status, 'concedido') <> 'revogado'
    AND COALESCE(p.whatsapp_ativo, true) = true
  ON CONFLICT (comunicacao_id, assistido_id) DO NOTHING;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'bloqueado')
  INTO v_total, v_bloqueados
  FROM comunicacoes_institucionais_envios
  WHERE comunicacao_id = p_comunicacao_id;

  UPDATE comunicacoes_institucionais
  SET envio_status = 'preparado',
      total_destinatarios = v_total,
      total_bloqueados = v_bloqueados
  WHERE id = p_comunicacao_id;

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (auth.uid(), 'comunicacoes_institucionais', 'ENVIO_PREPARADO', p_comunicacao_id,
    jsonb_build_object('total', v_total, 'bloqueados', v_bloqueados, 'janela_dias', v_janela, 'modelo', 'opt-out+responsavel'));

  RETURN jsonb_build_object('success', true, 'total', v_total, 'bloqueados', v_bloqueados);
END;
$$;
