DROP FUNCTION IF EXISTS public.fn_sanear_fila_notificacoes();
CREATE OR REPLACE FUNCTION public.fn_sanear_fila_notificacoes()
RETURNS TABLE(r_fila_id uuid, r_motivo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH alvo AS (
    SELECT f.id AS fid, public.fn_fila_motivo_inelegivel(f.id) AS mot
    FROM notificacoes_fila f
    WHERE f.status IN ('pendente','agendado')
      AND f.evento_origem IN ('sessao_lembrete','sessao_criada')
  ),
  inelegiveis AS (
    SELECT fid, mot FROM alvo WHERE mot IS NOT NULL
  ),
  logged AS (
    INSERT INTO notificacoes_log (fila_id, direcao, status, erro)
    SELECT fid, 'saida', 'cancelado', mot FROM inelegiveis
    RETURNING 1
  ),
  upd AS (
    UPDATE notificacoes_fila nf
    SET status = 'cancelado', erro = i.mot, updated_at = now()
    FROM inelegiveis i
    WHERE nf.id = i.fid
    RETURNING nf.id AS uid, i.mot AS umot
  )
  SELECT u.uid, u.umot FROM upd u;
END $$;
GRANT EXECUTE ON FUNCTION public.fn_sanear_fila_notificacoes() TO service_role;