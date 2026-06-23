DO $$
DECLARE
  v_assistido uuid := 'a1100000-0000-4000-8000-000000000001';
  v_at uuid := 'a1100000-0000-4000-8000-000000000006';
  v_ag uuid := 'a1100000-0000-4000-8000-000000000007';
  v_exc uuid := 'a1100000-0000-4000-8000-00000000000c';
  v_trat_magn uuid := '08a8dbc2-d943-4072-9f05-adfd02fb98fa';
  v_creator uuid := '47762708-951e-439d-b8e6-3c12151c321a';
  r jsonb;
BEGIN
  INSERT INTO assistido_tratamentos (id, assistido_id, tratamento_id, quantidade_total, status, created_by, data_inicio)
  VALUES (v_at, v_assistido, v_trat_magn, 1, 'em_andamento', v_creator, '2026-07-15')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO agenda_tratamentos_assistido (id, assistido_id, assistido_tratamento_id, tratamento_id, data_sessao, horario, status, registrado_por)
  VALUES (v_ag, v_assistido, v_at, v_trat_magn, '2026-07-15', '19:00', 'agendado', v_creator)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO excecoes_operacionais (id, tipo, atividade, tratamento_id, data_excecao, horario_afetado, status, nova_data, novo_horario, prioridade, ativo, motivo, criado_por)
  VALUES (v_exc, 'tratamento', 'Magnetismo', v_trat_magn, '2026-07-15', '19:00', 'remarcado', '2026-07-22', '20:00', 1, true, 'Homologação: revalidação texto remarcação', v_creator)
  ON CONFLICT (id) DO NOTHING;

  r := fn_processar_excecao_notificacoes(v_exc);
  RAISE NOTICE 'RPC remarcacao 2 => %', r;
END $$;