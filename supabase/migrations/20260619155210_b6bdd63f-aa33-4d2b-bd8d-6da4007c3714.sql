
-- ============ 1. Campos de acompanhamento na comunicação ============
ALTER TABLE public.comunicacoes_institucionais
  ADD COLUMN IF NOT EXISTS envio_status text NOT NULL DEFAULT 'nao_iniciado',
  ADD COLUMN IF NOT EXISTS envio_iniciado_at timestamptz,
  ADD COLUMN IF NOT EXISTS envio_concluido_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_destinatarios integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_enviados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_falhas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bloqueados integer NOT NULL DEFAULT 0;

-- ============ 2. Fila própria de envio institucional (por destinatário) ============
CREATE TABLE IF NOT EXISTS public.comunicacoes_institucionais_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicacao_id uuid NOT NULL REFERENCES public.comunicacoes_institucionais(id) ON DELETE CASCADE,
  assistido_id uuid NOT NULL REFERENCES public.assistidos(id) ON DELETE CASCADE,
  telefone_normalizado text,
  status text NOT NULL DEFAULT 'pendente',
  motivo text,
  erro text,
  retry_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  external_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comunicacao_id, assistido_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicacoes_institucionais_envios TO authenticated;
GRANT ALL ON public.comunicacoes_institucionais_envios TO service_role;

ALTER TABLE public.comunicacoes_institucionais_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins visualizam fila institucional"
  ON public.comunicacoes_institucionais_envios
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_ci_envios_comunicacao ON public.comunicacoes_institucionais_envios(comunicacao_id);
CREATE INDEX IF NOT EXISTS idx_ci_envios_status ON public.comunicacoes_institucionais_envios(status);
CREATE INDEX IF NOT EXISTS idx_ci_envios_assistido_sent ON public.comunicacoes_institucionais_envios(assistido_id, sent_at);

CREATE TRIGGER trg_ci_envios_updated_at
  BEFORE UPDATE ON public.comunicacoes_institucionais_envios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3. Preparar fila respeitando consentimento + anti-spam ============
CREATE OR REPLACE FUNCTION public.preparar_envio_institucional(
  p_comunicacao_id uuid,
  p_janela_dias integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_com RECORD;
  v_janela integer := GREATEST(COALESCE(p_janela_dias, 7), 0);
  v_total integer := 0;
  v_bloqueados integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem preparar o envio.');
  END IF;

  SELECT * INTO v_com FROM comunicacoes_institucionais WHERE id = p_comunicacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Comunicação não encontrada.');
  END IF;

  IF v_com.status <> 'aprovada' THEN
    RETURN jsonb_build_object('error', 'A comunicação precisa estar aprovada antes do envio.');
  END IF;

  IF v_com.envio_status NOT IN ('nao_iniciado', 'preparado') THEN
    RETURN jsonb_build_object('error', 'O envio desta comunicação já foi iniciado ou concluído.');
  END IF;

  -- Monta a fila de destinatários elegíveis (consentimento ativo na versão vigente + telefone).
  -- Proteção anti-spam: quem recebeu comunicação institucional dentro da janela entra bloqueado.
  INSERT INTO comunicacoes_institucionais_envios (
    comunicacao_id, assistido_id, telefone_normalizado, status, motivo
  )
  SELECT
    p_comunicacao_id,
    a.id,
    fn_normalize_phone(COALESCE(NULLIF(a.celular, ''), NULLIF(a.telefone, ''))),
    CASE
      WHEN v_janela > 0 AND EXISTS (
        SELECT 1 FROM comunicacoes_institucionais_envios e
        WHERE e.assistido_id = a.id
          AND e.status = 'enviado'
          AND e.sent_at >= now() - make_interval(days => v_janela)
      ) THEN 'bloqueado'
      ELSE 'pendente'
    END,
    CASE
      WHEN v_janela > 0 AND EXISTS (
        SELECT 1 FROM comunicacoes_institucionais_envios e
        WHERE e.assistido_id = a.id
          AND e.status = 'enviado'
          AND e.sent_at >= now() - make_interval(days => v_janela)
      ) THEN 'limite_frequencia'
      ELSE NULL
    END
  FROM assistidos a
  JOIN notificacoes_preferencias p ON p.assistido_id = a.id
  WHERE a.deleted_at IS NULL
    AND COALESCE(NULLIF(a.celular, ''), NULLIF(a.telefone, '')) IS NOT NULL
    AND p.whatsapp_ativo = true
    AND p.consentimento_status = 'concedido'
    AND p.consentimento_versao = v_com.consentimento_versao_alvo_or_default(v_com.id)  -- placeholder replaced below
  ON CONFLICT (comunicacao_id, assistido_id) DO NOTHING;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'bloqueado')
  INTO v_total, v_bloqueados
  FROM comunicacoes_institucionais_envios
  WHERE comunicacao_id = p_comunicacao_id;

  UPDATE comunicacoes_institucionais
  SET envio_status = 'preparado',
      total_destinatarios = v_total,
      total_bloqueados = v_bloqueados
  WHERE id = p_comunicacao_id;

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (auth.uid(), 'comunicacoes_institucionais', 'ENVIO_PREPARADO', p_comunicacao_id,
    jsonb_build_object('total', v_total, 'bloqueados', v_bloqueados, 'janela_dias', v_janela));

  RETURN jsonb_build_object('success', true, 'total', v_total, 'bloqueados', v_bloqueados);
END;
$$;

-- ============ 4. Fechar envio quando não houver mais pendências ============
CREATE OR REPLACE FUNCTION public.marcar_envio_concluido(p_comunicacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pendentes integer;
BEGIN
  SELECT COUNT(*) INTO v_pendentes
  FROM comunicacoes_institucionais_envios
  WHERE comunicacao_id = p_comunicacao_id AND status = 'pendente';

  IF v_pendentes = 0 THEN
    UPDATE comunicacoes_institucionais
    SET envio_status = 'concluido', envio_concluido_at = now()
    WHERE id = p_comunicacao_id AND envio_status <> 'concluido';
  END IF;

  RETURN jsonb_build_object('pendentes', v_pendentes);
END;
$$;
