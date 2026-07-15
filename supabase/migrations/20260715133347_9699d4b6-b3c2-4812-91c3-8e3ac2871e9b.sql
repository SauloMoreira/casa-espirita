DO $$
DECLARE
  v_updated integer;
BEGIN
  -- Antonio Jorge Pamplona — CPF 51268523704
  UPDATE public.assistidos
  SET user_id = '39e92f91-68f1-4715-a6e3-01d64472d2ec'
  WHERE id = '6ea63461-1391-4679-a539-e38875b7c69c'
    AND user_id IS NULL
    AND cpf = '51268523704';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Falha ao vincular Antonio Jorge Pamplona: % linha(s) afetada(s), esperado 1', v_updated;
  END IF;

  INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
  VALUES (
    NULL,
    'reconciliacao_legado_manual',
    'assistidos',
    '6ea63461-1391-4679-a539-e38875b7c69c',
    jsonb_build_object(
      'motivo', 'autocadastro criou conta desconectada do registro de entrevista',
      'cpf_usado_para_match', '51268523704',
      'auth_user_id_vinculado', '39e92f91-68f1-4715-a6e3-01d64472d2ec',
      'autorizado_por', 'Saulo Moreira',
      'aplicado_via', 'migration direta'
    )
  );

  -- Maria da Glória de Castro Hermes Pamplona — CPF 51016427700
  UPDATE public.assistidos
  SET user_id = '4f4f4b36-8a0c-46f0-81f6-80d24aa55069'
  WHERE id = '42f9b034-aaf6-4e91-a8e7-6993d71207d8'
    AND user_id IS NULL
    AND cpf = '51016427700';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Falha ao vincular Maria da Glória: % linha(s) afetada(s), esperado 1', v_updated;
  END IF;

  INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
  VALUES (
    NULL,
    'reconciliacao_legado_manual',
    'assistidos',
    '42f9b034-aaf6-4e91-a8e7-6993d71207d8',
    jsonb_build_object(
      'motivo', 'autocadastro criou conta desconectada do registro de entrevista',
      'cpf_usado_para_match', '51016427700',
      'auth_user_id_vinculado', '4f4f4b36-8a0c-46f0-81f6-80d24aa55069',
      'autorizado_por', 'Saulo Moreira',
      'aplicado_via', 'migration direta'
    )
  );
END $$;