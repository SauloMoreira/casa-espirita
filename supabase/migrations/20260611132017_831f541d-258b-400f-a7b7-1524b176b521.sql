
CREATE OR REPLACE FUNCTION public.relatorio_frequencia_presenca(
  p_data_inicio date,
  p_data_fim date,
  p_tratamento_id uuid DEFAULT NULL,
  p_assistido_id uuid DEFAULT NULL,
  p_tarefeiro_id uuid DEFAULT NULL,
  p_coordenador_id uuid DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := has_role(auth.uid(), 'admin');
  v_is_coord boolean := has_role(auth.uid(), 'coordenador_de_tratamento');
  v_is_taref boolean := has_role(auth.uid(), 'tarefeiro');
  v_size integer := GREATEST(COALESCE(p_page_size, 25), 1);
  v_offset integer := GREATEST(COALESCE(p_page, 1) - 1, 0) * v_size;
  v_registros integer;
  v_totais jsonb;
  v_rows jsonb;
BEGIN
  WITH grouped AS (
    SELECT
      a.nome AS nome,
      tt.nome AS tratamento,
      COUNT(*) FILTER (WHERE pt.status_presenca = 'presente') AS presencas,
      COUNT(*) FILTER (WHERE pt.status_presenca <> 'presente') AS ausencias,
      COUNT(*) AS total
    FROM presencas_tratamentos pt
    JOIN assistido_tratamentos at ON at.id = pt.assistido_tratamento_id
    JOIN tipos_tratamento tt ON tt.id = at.tratamento_id
    JOIN assistidos a ON a.id = at.assistido_id
    WHERE pt.data >= p_data_inicio
      AND pt.data <= p_data_fim
      AND (p_tratamento_id IS NULL OR at.tratamento_id = p_tratamento_id)
      AND (p_assistido_id IS NULL OR at.assistido_id = p_assistido_id)
      AND (p_tarefeiro_id IS NULL OR tt.tarefeiro_id = p_tarefeiro_id)
      AND (p_coordenador_id IS NULL OR tt.coordenador_responsavel_id = p_coordenador_id)
      AND (v_is_admin OR NOT v_is_coord OR tt.coordenador_responsavel_id = auth.uid())
      AND (v_is_admin OR NOT v_is_taref OR tt.tarefeiro_id IS NULL OR tt.tarefeiro_id = auth.uid())
    GROUP BY pt.assistido_tratamento_id, a.nome, tt.nome
  )
  SELECT
    (SELECT COUNT(*) FROM grouped),
    (SELECT jsonb_build_object(
       'total', COALESCE(SUM(total), 0),
       'presencas', COALESCE(SUM(presencas), 0),
       'ausencias', COALESCE(SUM(ausencias), 0)
     ) FROM grouped),
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
       SELECT
         nome, tratamento, presencas, ausencias, total,
         CASE WHEN total > 0 THEN ROUND(presencas::numeric / total * 100) ELSE 0 END AS percentual
       FROM grouped
       ORDER BY nome ASC
       LIMIT v_size OFFSET v_offset
     ) r)
  INTO v_registros, v_totais, v_rows;

  RETURN jsonb_build_object('registros', v_registros, 'totais', v_totais, 'rows', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.relatorio_faltas_periodo(
  p_data_inicio date,
  p_data_fim date,
  p_tratamento_id uuid DEFAULT NULL,
  p_assistido_id uuid DEFAULT NULL,
  p_tarefeiro_id uuid DEFAULT NULL,
  p_coordenador_id uuid DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := has_role(auth.uid(), 'admin');
  v_is_coord boolean := has_role(auth.uid(), 'coordenador_de_tratamento');
  v_is_taref boolean := has_role(auth.uid(), 'tarefeiro');
  v_size integer := GREATEST(COALESCE(p_page_size, 25), 1);
  v_offset integer := GREATEST(COALESCE(p_page, 1) - 1, 0) * v_size;
  v_registros integer;
  v_totais jsonb;
  v_rows jsonb;
BEGIN
  WITH grouped AS (
    SELECT
      a.nome AS assistido,
      tt.nome AS tratamento,
      COUNT(*) FILTER (WHERE pt.status_presenca = 'ausente') AS total_faltas,
      ARRAY_AGG(pt.data::text ORDER BY pt.data) FILTER (WHERE pt.status_presenca = 'ausente') AS datas,
      COUNT(*) AS total_sessoes
    FROM presencas_tratamentos pt
    JOIN assistido_tratamentos at ON at.id = pt.assistido_tratamento_id
    JOIN tipos_tratamento tt ON tt.id = at.tratamento_id
    JOIN assistidos a ON a.id = at.assistido_id
    WHERE pt.data >= p_data_inicio
      AND pt.data <= p_data_fim
      AND (p_tratamento_id IS NULL OR at.tratamento_id = p_tratamento_id)
      AND (p_assistido_id IS NULL OR at.assistido_id = p_assistido_id)
      AND (p_tarefeiro_id IS NULL OR tt.tarefeiro_id = p_tarefeiro_id)
      AND (p_coordenador_id IS NULL OR tt.coordenador_responsavel_id = p_coordenador_id)
      AND (v_is_admin OR NOT v_is_coord OR tt.coordenador_responsavel_id = auth.uid())
      AND (v_is_admin OR NOT v_is_taref OR tt.tarefeiro_id IS NULL OR tt.tarefeiro_id = auth.uid())
    GROUP BY pt.assistido_tratamento_id, a.nome, tt.nome
    HAVING COUNT(*) FILTER (WHERE pt.status_presenca = 'ausente') > 0
  )
  SELECT
    (SELECT COUNT(*) FROM grouped),
    (SELECT jsonb_build_object(
       'total_faltas', COALESCE(SUM(total_faltas), 0),
       'assistidos_com_falta', COALESCE(COUNT(DISTINCT assistido), 0),
       'pct_medio', COALESCE(ROUND(AVG(
         CASE WHEN total_sessoes > 0 THEN total_faltas::numeric / total_sessoes * 100 ELSE 0 END
       )), 0),
       'vinculos_com_falta', COUNT(*)
     ) FROM grouped),
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
       SELECT
         assistido, tratamento, total_faltas, datas, total_sessoes,
         CASE WHEN total_sessoes > 0 THEN ROUND(total_faltas::numeric / total_sessoes * 100) ELSE 0 END AS percentual
       FROM grouped
       ORDER BY total_faltas DESC
       LIMIT v_size OFFSET v_offset
     ) r)
  INTO v_registros, v_totais, v_rows;

  RETURN jsonb_build_object('registros', v_registros, 'totais', v_totais, 'rows', v_rows);
END;
$$;
