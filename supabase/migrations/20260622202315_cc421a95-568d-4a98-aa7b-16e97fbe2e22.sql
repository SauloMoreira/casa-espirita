CREATE OR REPLACE FUNCTION public.fn_sanear_fila_notificacoes()
RETURNS TABLE(fila_id uuid, motivo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH alvo AS (
    SELECT f.id, public.fn_fila_motivo_inelegivel(f.id) AS motivo
    FROM notificacoes_fila f
    WHERE f.status IN ('pendente','agendado')
      AND f.evento_origem IN ('sessao_lembrete','sessao_criada')
  ),
  inelegiveis AS (
    SELECT id, motivo FROM alvo WHERE motivo IS NOT NULL
  ),
  logged AS (
    INSERT INTO notificacoes_log (fila_id, direcao, status, erro)
    SELECT id, 'saida', 'cancelado', motivo FROM inelegiveis
    RETURNING 1
  ),
  upd AS (
    UPDATE notificacoes_fila nf
    SET status = 'cancelado', erro = i.motivo, updated_at = now()
    FROM inelegiveis i
    WHERE nf.id = i.id
    RETURNING nf.id, i.motivo
  )
  SELECT u.id, u.motivo FROM upd u;
END $$;
GRANT EXECUTE ON FUNCTION public.fn_sanear_fila_notificacoes() TO service_role;