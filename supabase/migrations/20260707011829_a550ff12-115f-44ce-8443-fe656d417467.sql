-- Q2-C1 — Saneamento pontual, idempotente e auditado da fila de notificacoes
-- com erro de cadastro. Usa EXCLUSIVAMENTE a RPC existente
-- public.fn_encerrar_item_fila_erro_cadastro. NAO altera schema, tabelas, RLS,
-- policies, grants, edge functions, dispatchers, templates, opt-out,
-- consentimento nem preferencias de comunicacao. Apenas encerra dados de itens
-- ja em falha por erro de cadastro.
--
-- Observacao: 'template_indisponivel' NAO e saneado aqui. A RPC so aceita
-- motivos de cadastro (sem_telefone / telefone_invalido /
-- dados_obrigatorios_ausentes / nome_ausente); o item template_indisponivel
-- permanece intocado por design (fora do escopo desta RPC).
DO $$
DECLARE
  v_admin uuid := '47762708-951e-439d-b8e6-3c12151c321a'; -- administrador_master (autoridade aprovadora)
  v_item  record;
  v_count int := 0;
BEGIN
  -- Contexto de admin autenticado para satisfazer o guard auth.uid() da RPC.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated')::text,
    true
  );

  -- Idempotente: seleciona apenas itens AINDA em falha por erro de cadastro.
  FOR v_item IN
    SELECT id
      FROM public.notificacoes_fila
     WHERE status = 'falha'
       AND erro IN ('sem_telefone','telefone_invalido','dados_obrigatorios_ausentes','nome_ausente')
     ORDER BY created_at
  LOOP
    PERFORM public.fn_encerrar_item_fila_erro_cadastro(
      v_item.id,
      'erro_cadastro',
      'Q2-C1: saneamento pontual auditado da fila (erro de cadastro nao recuperavel)'
    );
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Q2-C1: % item(ns) de fila com erro de cadastro encerrado(s).', v_count;
END $$;