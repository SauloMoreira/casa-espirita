-- L-04 — Estender o saneamento da fila para entrevistas.
--
-- A fonte ÚNICA de elegibilidade (fn_fila_motivo_inelegivel) já reconhece itens
-- de entrevista inelegíveis e devolve motivos próprios do domínio
-- (entrevista_inexistente, entrevista_cancelada, entrevista_remarcada,
-- entrevista_vencida). Até agora, porém, fn_sanear_fila_notificacoes só varria
-- eventos de sessão, deixando entrevistas dependentes apenas da trava final do
-- dispatch. Esta migração estende o saneamento proativo a entrevistas SEM
-- duplicar regra: continua delegando 100% a decisão à fonte única, apenas amplia
-- o conjunto de eventos varridos. Histórico é preservado (somente cancela itens
-- pendentes/agendados, com trilha em notificacoes_log). Date-only de entrevista
-- permanece intacto (lógica temporal mora na fonte única, não é alterada).

CREATE OR REPLACE FUNCTION public.fn_sanear_fila_notificacoes()
 RETURNS TABLE(r_fila_id uuid, r_motivo text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH alvo AS (
    SELECT f.id AS fid, public.fn_fila_motivo_inelegivel(f.id) AS mot
    FROM notificacoes_fila f
    WHERE f.status IN ('pendente','agendado')
      AND f.evento_origem IN (
        'sessao_lembrete','sessao_criada',
        'entrevista_lembrete','entrevista_criada'
      )
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
END $function$;