
CREATE OR REPLACE FUNCTION public.pts_desfazer_presenca(p_vinculo_id uuid, p_data date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_presenca RECORD;
  v_vinc RECORD;
  v_etapa_realizada RECORD;
  v_etapa_seguinte RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.' USING ERRCODE='42501'; END IF;
  IF NOT public.fn_eh_staff(v_uid) THEN RAISE EXCEPTION 'Acesso negado: requer perfil de equipe.' USING ERRCODE='42501'; END IF;
  IF p_data <> CURRENT_DATE THEN
    RAISE EXCEPTION 'Só é possível desfazer um registro feito no mesmo dia.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_presenca FROM presencas_tratamentos
  WHERE assistido_tratamento_id = p_vinculo_id AND data = p_data AND status_presenca = 'presente'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum registro de presença encontrado para desfazer.'; END IF;

  SELECT * INTO v_vinc FROM assistido_tratamentos WHERE id = p_vinculo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo não encontrado.'; END IF;

  SELECT * INTO v_etapa_realizada FROM plano_tratamento_sessoes
  WHERE assistido_tratamento_id = p_vinculo_id AND status_etapa = 'realizada'
  ORDER BY numero_etapa DESC LIMIT 1;

  IF v_etapa_realizada.id IS NOT NULL THEN
    SELECT * INTO v_etapa_seguinte FROM plano_tratamento_sessoes
    WHERE assistido_tratamento_id = p_vinculo_id
      AND numero_etapa = v_etapa_realizada.numero_etapa + 1
      AND status_etapa = 'ativa';

    IF v_etapa_seguinte.id IS NOT NULL THEN
      UPDATE plano_tratamento_sessoes
        SET status_etapa = 'prevista', agenda_sessao_id = NULL, updated_at = now()
      WHERE id = v_etapa_seguinte.id;
      IF v_etapa_seguinte.agenda_sessao_id IS NOT NULL THEN
        DELETE FROM agenda_tratamentos_assistido
        WHERE id = v_etapa_seguinte.agenda_sessao_id AND status = 'agendado';
      END IF;
    END IF;

    UPDATE plano_tratamento_sessoes SET status_etapa = 'ativa', updated_at = now()
    WHERE id = v_etapa_realizada.id;

    IF v_etapa_realizada.agenda_sessao_id IS NOT NULL THEN
      UPDATE agenda_tratamentos_assistido SET status = 'agendado', updated_at = now()
      WHERE id = v_etapa_realizada.agenda_sessao_id;
    END IF;
  END IF;

  DELETE FROM presencas_tratamentos WHERE id = v_presenca.id;

  UPDATE assistido_tratamentos SET
    quantidade_realizada = GREATEST(quantidade_realizada - 1, 0),
    status = CASE WHEN status = 'concluido' THEN 'em_andamento' ELSE status END,
    ultima_presenca_em = (
      SELECT MAX(data) FROM presencas_tratamentos
      WHERE assistido_tratamento_id = p_vinculo_id AND status_presenca = 'presente'
    ),
    ultimo_status_operacional = NULL
  WHERE id = p_vinculo_id;

  UPDATE assistido_tratamentos SET status = 'aguardando_inicio'
  WHERE id = p_vinculo_id AND quantidade_realizada = 0
    AND NOT EXISTS (SELECT 1 FROM presencas_tratamentos WHERE assistido_tratamento_id = p_vinculo_id AND status_presenca = 'presente');

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (v_uid, 'plano_tratamento_sessoes', 'PLANO_PRESENCA_DESFEITA', p_vinculo_id, jsonb_build_object('data', p_data));

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pts_desfazer_ausencia(p_vinculo_id uuid, p_data date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_presenca RECORD;
  v_vinc RECORD;
  v_etapa RECORD;
  v_agenda_original RECORD;
  v_agenda_nova_id uuid;
  v_refs_restantes int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.' USING ERRCODE='42501'; END IF;
  IF NOT public.fn_eh_staff(v_uid) THEN RAISE EXCEPTION 'Acesso negado: requer perfil de equipe.' USING ERRCODE='42501'; END IF;
  IF p_data <> CURRENT_DATE THEN
    RAISE EXCEPTION 'Só é possível desfazer um registro feito no mesmo dia.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_presenca FROM presencas_tratamentos
  WHERE assistido_tratamento_id = p_vinculo_id AND data = p_data AND status_presenca = 'ausente'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum registro de ausência encontrado para desfazer.'; END IF;

  SELECT * INTO v_vinc FROM assistido_tratamentos WHERE id = p_vinculo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo não encontrado.'; END IF;

  SELECT * INTO v_agenda_original FROM agenda_tratamentos_assistido
  WHERE assistido_tratamento_id = p_vinculo_id AND data_sessao = p_data AND status = 'ausente'
  LIMIT 1;

  IF v_vinc.status = 'suspenso' THEN
    SELECT * INTO v_etapa FROM plano_tratamento_sessoes
    WHERE assistido_tratamento_id = p_vinculo_id AND status_etapa = 'suspensa'
    ORDER BY numero_etapa DESC LIMIT 1;

    IF v_etapa.id IS NOT NULL THEN
      UPDATE plano_tratamento_sessoes SET status_etapa = 'ativa', updated_at = now() WHERE id = v_etapa.id;
      IF v_etapa.agenda_sessao_id IS NOT NULL THEN
        UPDATE agenda_tratamentos_assistido SET status = 'agendado', updated_at = now() WHERE id = v_etapa.agenda_sessao_id;
      END IF;
    END IF;

    UPDATE assistido_tratamentos SET status = 'em_andamento' WHERE id = p_vinculo_id;
  ELSE
    SELECT * INTO v_etapa FROM plano_tratamento_sessoes
    WHERE assistido_tratamento_id = p_vinculo_id AND status_etapa = 'ativa'
    ORDER BY numero_etapa LIMIT 1;

    IF v_etapa.id IS NOT NULL AND v_agenda_original.id IS NOT NULL AND v_etapa.agenda_sessao_id IS DISTINCT FROM v_agenda_original.id THEN
      v_agenda_nova_id := v_etapa.agenda_sessao_id;

      UPDATE plano_tratamento_sessoes
        SET agenda_sessao_id = v_agenda_original.id, data_prevista = v_agenda_original.data_sessao,
            horario_previsto = v_agenda_original.horario, updated_at = now()
      WHERE id = v_etapa.id;

      UPDATE agenda_tratamentos_assistido SET status = 'agendado', updated_at = now()
      WHERE id = v_agenda_original.id;

      IF v_agenda_nova_id IS NOT NULL THEN
        SELECT count(*) INTO v_refs_restantes FROM plano_tratamento_sessoes WHERE agenda_sessao_id = v_agenda_nova_id;
        IF v_refs_restantes = 0 THEN
          DELETE FROM agenda_tratamentos_assistido WHERE id = v_agenda_nova_id AND status = 'agendado';
        END IF;
      END IF;
    END IF;
  END IF;

  DELETE FROM presencas_tratamentos WHERE id = v_presenca.id;

  UPDATE assistido_tratamentos SET
    faltas_consecutivas = GREATEST(faltas_consecutivas - 1, 0),
    remarcacoes_automaticas = GREATEST(remarcacoes_automaticas - 1, 0),
    ultimo_status_operacional = NULL
  WHERE id = p_vinculo_id;

  DELETE FROM notificacoes_fila
  WHERE status = 'pendente'
    AND dedupe_key IN (
      'tratamento_remarca:'||p_vinculo_id||':'||p_data::text,
      'tratamento_suspenso:'||p_vinculo_id||':'||p_data::text
    );

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (v_uid, 'plano_tratamento_sessoes', 'PLANO_AUSENCIA_DESFEITA', p_vinculo_id, jsonb_build_object('data', p_data));

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.desfazer_presenca_legado(p_vinculo_id uuid, p_data date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_presenca RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.' USING ERRCODE='42501'; END IF;
  IF NOT (has_role(v_uid,'tarefeiro'::app_role) OR has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'administrador_master'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para desfazer presença';
  END IF;
  IF p_data <> CURRENT_DATE THEN
    RAISE EXCEPTION 'Só é possível desfazer um registro feito no mesmo dia.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_presenca FROM presencas_tratamentos
  WHERE assistido_tratamento_id = p_vinculo_id AND data = p_data
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum registro encontrado para desfazer.'; END IF;

  IF v_presenca.status_presenca = 'presente' THEN
    UPDATE assistido_tratamentos SET quantidade_realizada = GREATEST(quantidade_realizada - 1, 0)
    WHERE id = p_vinculo_id;
    UPDATE assistido_tratamentos SET status = 'aguardando_inicio'
    WHERE id = p_vinculo_id AND quantidade_realizada = 0;
  END IF;

  DELETE FROM presencas_tratamentos WHERE id = v_presenca.id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.pts_desfazer_presenca(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pts_desfazer_ausencia(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.desfazer_presenca_legado(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pts_desfazer_presenca(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pts_desfazer_ausencia(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_presenca_legado(uuid, date) TO authenticated;
