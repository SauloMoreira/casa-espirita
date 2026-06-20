CREATE OR REPLACE FUNCTION public.migrar_assistido_legado_tratamento(
  p_assistido_id uuid,
  p_tratamentos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trat jsonb;
  v_sessao jsonb;
  v_vinculo_id uuid;
  v_tratamento_id uuid;
  v_vinculos_criados int := 0;
  v_vinculos_atualizados int := 0;
  v_sessoes_criadas int := 0;
  v_data date;
  v_horario time;
  v_inserted int;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem migrar assistidos legados.'
      USING ERRCODE = '42501';
  END IF;

  IF p_assistido_id IS NULL THEN
    RAISE EXCEPTION 'assistido_id é obrigatório.';
  END IF;

  FOR v_trat IN SELECT * FROM jsonb_array_elements(p_tratamentos)
  LOOP
    v_tratamento_id := (v_trat->>'tratamento_id')::uuid;

    IF (v_trat->>'vinculo_id') IS NOT NULL AND (v_trat->>'vinculo_id') <> '' THEN
      -- Reconciliação de vínculo já existente
      v_vinculo_id := (v_trat->>'vinculo_id')::uuid;
      UPDATE public.assistido_tratamentos
        SET status = COALESCE(v_trat->>'status', status),
            quantidade_total = COALESCE((v_trat->>'quantidade_total')::int, quantidade_total),
            quantidade_realizada = COALESCE((v_trat->>'quantidade_realizada')::int, quantidade_realizada),
            observacao_migracao = COALESCE(v_trat->>'observacao', observacao_migracao),
            origem = 'legado',
            updated_at = now()
        WHERE id = v_vinculo_id AND assistido_id = p_assistido_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Vínculo % não encontrado para o assistido.', v_vinculo_id;
      END IF;
      v_vinculos_atualizados := v_vinculos_atualizados + 1;
    ELSE
      -- Novo vínculo legado
      INSERT INTO public.assistido_tratamentos (
        assistido_id, tratamento_id, quantidade_total, quantidade_realizada,
        status, entrevista_id, origem, observacoes, observacao_migracao, created_by
      ) VALUES (
        p_assistido_id,
        v_tratamento_id,
        COALESCE((v_trat->>'quantidade_total')::int, 1),
        COALESCE((v_trat->>'quantidade_realizada')::int, 0),
        COALESCE(v_trat->>'status', 'em_andamento'),
        NULL,
        'legado',
        v_trat->>'observacao',
        v_trat->>'observacao',
        v_uid
      )
      RETURNING id INTO v_vinculo_id;
      v_vinculos_criados := v_vinculos_criados + 1;
    END IF;

    -- Sessões: gravação em lote idempotente (não recalcula datas)
    FOR v_sessao IN SELECT * FROM jsonb_array_elements(COALESCE(v_trat->'sessoes', '[]'::jsonb))
    LOOP
      v_data := (v_sessao->>'data_sessao')::date;
      v_horario := NULLIF(v_sessao->>'horario', '')::time;

      INSERT INTO public.agenda_tratamentos_assistido (
        assistido_id, assistido_tratamento_id, tratamento_id,
        data_sessao, horario, status, registrado_por
      )
      SELECT p_assistido_id, v_vinculo_id, v_tratamento_id,
             v_data, v_horario, 'agendado', v_uid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.agenda_tratamentos_assistido g
        WHERE g.assistido_tratamento_id = v_vinculo_id
          AND g.data_sessao = v_data
          AND g.horario IS NOT DISTINCT FROM v_horario
          AND g.status = 'agendado'
      );
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      v_sessoes_criadas := v_sessoes_criadas + v_inserted;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'vinculos_criados', v_vinculos_criados,
    'vinculos_atualizados', v_vinculos_atualizados,
    'sessoes_criadas', v_sessoes_criadas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.migrar_assistido_legado_tratamento(uuid, jsonb) TO authenticated;