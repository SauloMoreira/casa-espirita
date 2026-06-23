DO $$
DECLARE
  v_assistido uuid := 'a1100000-0000-4000-8000-000000000001';
  v_excs uuid[] := ARRAY['a1100000-0000-4000-8000-00000000000a','a1100000-0000-4000-8000-00000000000b','a1100000-0000-4000-8000-00000000000c']::uuid[];
BEGIN
  DELETE FROM notificacoes_log l USING notificacoes_fila f
    WHERE l.fila_id = f.id AND f.assistido_id = v_assistido;
  DELETE FROM notificacoes_fila WHERE assistido_id = v_assistido;
  DELETE FROM agenda_tratamentos_assistido WHERE assistido_id = v_assistido;
  DELETE FROM assistido_tratamentos WHERE assistido_id = v_assistido;
  DELETE FROM excecoes_operacionais WHERE id = ANY(v_excs);
  DELETE FROM audit_logs WHERE registro_id = ANY(v_excs) OR registro_id = v_assistido;
  DELETE FROM assistidos WHERE id = v_assistido;
END $$;