CREATE OR REPLACE FUNCTION public.registrar_auditoria_reconciliacao(
  p_assistido_id uuid,
  p_dados jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'administrador_master')) THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar reconciliação.';
  END IF;

  INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_novos)
  VALUES (auth.uid(), 'reconciliacao_legado', 'assistido_tratamentos', p_assistido_id, p_dados)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_auditoria_reconciliacao(uuid, jsonb) TO authenticated;