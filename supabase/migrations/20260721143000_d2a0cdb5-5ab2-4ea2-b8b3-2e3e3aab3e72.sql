ALTER TABLE public.assistidos DISABLE TRIGGER trg_proteger_campos_staff_assistido;

UPDATE public.assistidos SET user_id = '6219b6fc-6314-4efc-8bad-e16ec69097ff'
WHERE id = 'a2cb576b-063d-43cc-80af-bf173d57abdd' AND user_id IS NULL;

UPDATE public.assistidos SET user_id = 'ed2252f1-145e-4193-886f-b37136b21ee6'
WHERE id = '52299dcc-38a2-475c-b0d4-1a956501c28e' AND user_id IS NULL;

UPDATE public.assistidos SET user_id = 'effc5525-e5ab-4edb-99c5-b6e5445d62f2'
WHERE id = 'fb5390c1-d95f-4ba2-a038-d8e3ad462c69' AND user_id IS NULL;

INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
VALUES
  ('6219b6fc-6314-4efc-8bad-e16ec69097ff', 'reconciliacao_manual_backfill_staff', 'assistidos', 'a2cb576b-063d-43cc-80af-bf173d57abdd', jsonb_build_object('motivo', 'Celular e nome batendo com perfil já existente')),
  ('ed2252f1-145e-4193-886f-b37136b21ee6', 'reconciliacao_manual_backfill_staff', 'assistidos', '52299dcc-38a2-475c-b0d4-1a956501c28e', jsonb_build_object('motivo', 'Celular e nome batendo com perfil já existente')),
  ('effc5525-e5ab-4edb-99c5-b6e5445d62f2', 'reconciliacao_manual_backfill_staff', 'assistidos', 'fb5390c1-d95f-4ba2-a038-d8e3ad462c69', jsonb_build_object('motivo', 'Celular e nome batendo com perfil já existente'));

ALTER TABLE public.assistidos ENABLE TRIGGER trg_proteger_campos_staff_assistido;