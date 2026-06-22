CREATE OR REPLACE FUNCTION public.fn_fila_motivo_inelegivel(p_fila_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item record;
  v_part text;
  v_agenda_id uuid;
  v_ag record;
  v_inst timestamptz;
BEGIN
  SELECT * INTO v_item FROM notificacoes_fila WHERE id = p_fila_id;
  IF NOT FOUND THEN RETURN 'item_inexistente'; END IF;
  IF v_item.evento_origem NOT IN ('sessao_lembrete','sessao_criada') THEN RETURN NULL; END IF;
  v_part := split_part(v_item.dedupe_key, ':', 2);
  IF length(v_part) != 36 THEN RETURN 'sessao_inexistente'; END IF;
  BEGIN
    v_agenda_id := v_part::uuid;
  EXCEPTION WHEN others THEN RETURN 'sessao_inexistente'; END;
  SELECT * INTO v_ag FROM agenda_tratamentos_assistido WHERE id = v_agenda_id;
  IF NOT FOUND THEN RETURN 'sessao_inexistente'; END IF;
  IF v_ag.status = 'substituida_plano' THEN RETURN 'sessao_substituida'; END IF;
  IF v_ag.status = 'cancelado' THEN RETURN 'sessao_cancelada'; END IF;
  IF v_ag.status != 'agendado' THEN RETURN 'sessao_nao_agendada'; END IF;
  v_inst := (v_ag.data_sessao::timestamp + COALESCE(v_ag.horario, '08:00'::time)) AT TIME ZONE 'America/Sao_Paulo';
  IF greatest(now(), v_inst) = now() THEN RETURN 'lembrete_vencido'; END IF;
  RETURN NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.fn_fila_motivo_inelegivel(uuid) TO authenticated, service_role;