-- 1) Columns on voluntarios for the termo flow
ALTER TABLE public.voluntarios
  ADD COLUMN IF NOT EXISTS termo_status text NOT NULL DEFAULT 'nao_gerado',
  ADD COLUMN IF NOT EXISTS termo_gerado_em timestamptz,
  ADD COLUMN IF NOT EXISTS termo_gerado_por uuid,
  ADD COLUMN IF NOT EXISTS termo_assinado_path text,
  ADD COLUMN IF NOT EXISTS termo_assinado_nome text,
  ADD COLUMN IF NOT EXISTS termo_assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS termo_validado_por uuid,
  ADD COLUMN IF NOT EXISTS termo_validado_em timestamptz,
  ADD COLUMN IF NOT EXISTS termo_rejeitado_motivo text;

-- 2) Storage policies for the private bucket (admins only)
CREATE POLICY "Admins manage termos-voluntarios objects (select)"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'termos-voluntarios' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage termos-voluntarios objects (insert)"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'termos-voluntarios' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage termos-voluntarios objects (update)"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'termos-voluntarios' AND has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'termos-voluntarios' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage termos-voluntarios objects (delete)"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'termos-voluntarios' AND has_role(auth.uid(), 'admin'));

-- 3) Termo management function
CREATE OR REPLACE FUNCTION public.gerenciar_termo_voluntario(
  p_action text,
  p_voluntario_id uuid,
  p_path text DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := has_role(auth.uid(), 'admin');
  v_nome text;
  v_old_path text;
BEGIN
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem gerenciar o termo');
  END IF;

  IF p_action NOT IN ('gerar','assinar','validar','rejeitar') THEN
    RETURN jsonb_build_object('error', 'Ação inválida');
  END IF;

  SELECT nome_completo, termo_assinado_path INTO v_nome, v_old_path
  FROM voluntarios WHERE id = p_voluntario_id;
  IF v_nome IS NULL THEN
    RETURN jsonb_build_object('error', 'Voluntário não encontrado');
  END IF;

  IF p_action = 'gerar' THEN
    UPDATE voluntarios SET
      termo_status = CASE WHEN termo_status IN ('assinado_enviado','validado') THEN termo_status ELSE 'gerado' END,
      termo_gerado_em = now(),
      termo_gerado_por = auth.uid()
    WHERE id = p_voluntario_id;
    INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
    VALUES (auth.uid(), 'voluntarios', 'TERMO_GERADO', p_voluntario_id,
      jsonb_build_object('executed_by', auth.uid(), 'nome', v_nome));
    RETURN jsonb_build_object('success', true, 'message', 'Termo gerado.');
  END IF;

  IF p_action = 'assinar' THEN
    IF p_path IS NULL OR length(trim(p_path)) = 0 THEN
      RETURN jsonb_build_object('error', 'Caminho do arquivo é obrigatório');
    END IF;
    UPDATE voluntarios SET
      termo_status = 'assinado_enviado',
      termo_assinado_path = p_path,
      termo_assinado_nome = p_nome,
      termo_assinado_em = now(),
      termo_validado_por = NULL,
      termo_validado_em = NULL,
      termo_rejeitado_motivo = NULL
    WHERE id = p_voluntario_id;
    INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
    VALUES (auth.uid(), 'voluntarios',
      CASE WHEN v_old_path IS NOT NULL THEN 'TERMO_REENVIADO' ELSE 'TERMO_ASSINADO_ENVIADO' END,
      p_voluntario_id,
      jsonb_build_object('executed_by', auth.uid(), 'nome', v_nome, 'arquivo', p_nome, 'path', p_path, 'path_anterior', v_old_path));
    RETURN jsonb_build_object('success', true, 'message', 'Termo assinado enviado.');
  END IF;

  IF p_action = 'validar' THEN
    UPDATE voluntarios SET
      termo_status = 'validado',
      termo_validado_por = auth.uid(),
      termo_validado_em = now(),
      termo_rejeitado_motivo = NULL
    WHERE id = p_voluntario_id;
    INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
    VALUES (auth.uid(), 'voluntarios', 'TERMO_VALIDADO', p_voluntario_id,
      jsonb_build_object('executed_by', auth.uid(), 'nome', v_nome));
    RETURN jsonb_build_object('success', true, 'message', 'Termo validado.');
  END IF;

  -- rejeitar
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RETURN jsonb_build_object('error', 'Informe o motivo da rejeição');
  END IF;
  UPDATE voluntarios SET
    termo_status = 'rejeitado',
    termo_validado_por = auth.uid(),
    termo_validado_em = now(),
    termo_rejeitado_motivo = p_motivo
  WHERE id = p_voluntario_id;
  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (auth.uid(), 'voluntarios', 'TERMO_REJEITADO', p_voluntario_id,
    jsonb_build_object('executed_by', auth.uid(), 'nome', v_nome, 'motivo', p_motivo));
  RETURN jsonb_build_object('success', true, 'message', 'Termo rejeitado.');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.gerenciar_termo_voluntario(text, uuid, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.gerenciar_termo_voluntario(text, uuid, text, text, text) FROM anon;