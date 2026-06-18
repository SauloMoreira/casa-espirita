-- =========================================================
-- Helper functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.count_active_masters()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(DISTINCT ur.user_id)::int
  FROM user_roles ur
  JOIN profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'administrador_master' AND p.status = 'ativo';
$$;

CREATE OR REPLACE FUNCTION public.count_apt_admins()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(DISTINCT ur.user_id)::int
  FROM user_roles ur
  JOIN profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'admin' AND p.status = 'ativo';
$$;

CREATE OR REPLACE FUNCTION public.is_active_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur JOIN profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _uid AND ur.role = 'admin' AND p.status = 'ativo'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_master(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur JOIN profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _uid AND ur.role = 'administrador_master' AND p.status = 'ativo'
  );
$$;

-- =========================================================
-- Tables
-- =========================================================
CREATE TABLE public.admin_promotion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  target_role app_role NOT NULL,
  requested_by uuid NOT NULL,
  justificativa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  required_approvals integer NOT NULL DEFAULT 2,
  excecao_master boolean NOT NULL DEFAULT false,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_target_role CHECK (target_role IN ('admin','administrador_master')),
  CONSTRAINT chk_status CHECK (status IN ('pendente','aprovado_parcialmente','aprovado','rejeitado','expirado'))
);

CREATE TABLE public.admin_promotion_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.admin_promotion_requests(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL,
  decision text NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_decision CHECK (decision IN ('aprovar','rejeitar')),
  CONSTRAINT uq_request_approver UNIQUE (request_id, approver_id)
);

GRANT SELECT ON public.admin_promotion_requests TO authenticated;
GRANT ALL ON public.admin_promotion_requests TO service_role;
GRANT SELECT ON public.admin_promotion_approvals TO authenticated;
GRANT ALL ON public.admin_promotion_approvals TO service_role;

ALTER TABLE public.admin_promotion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_promotion_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view promotion requests"
  ON public.admin_promotion_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view promotion approvals"
  ON public.admin_promotion_approvals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_apr_updated_at BEFORE UPDATE ON public.admin_promotion_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Seed: existing admin(s) become Administrador Master
-- (runs before the grant-blocking trigger is created)
-- =========================================================
INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'administrador_master'::app_role
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

-- =========================================================
-- Block direct admin/master grants outside the approval flow
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_block_admin_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;
  IF NEW.role IN ('admin','administrador_master') THEN
    IF current_setting('app.allow_admin_grant', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Concessão de papel administrativo só é permitida via fluxo de aprovação de privilégios.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_admin_grant
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_admin_grant();

-- =========================================================
-- Protect the last active Administrador Master
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_protect_last_master_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'administrador_master' THEN
    IF (SELECT COUNT(DISTINCT ur.user_id) FROM user_roles ur
        JOIN profiles p ON p.user_id = ur.user_id
        WHERE ur.role = 'administrador_master' AND p.status = 'ativo'
          AND ur.user_id <> OLD.user_id) = 0 THEN
      RAISE EXCEPTION 'Não é permitido remover o último Administrador Master ativo do sistema.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_protect_last_master_roles
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_last_master_roles();

CREATE OR REPLACE FUNCTION public.fn_protect_master_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'inativo' AND OLD.status = 'ativo'
     AND public.is_active_master(OLD.user_id) THEN
    IF public.count_active_masters() <= 1 THEN
      RAISE EXCEPTION 'Não é permitido inativar o último Administrador Master ativo do sistema.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_master_status
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_master_status();

-- =========================================================
-- Workflow RPCs
-- =========================================================
CREATE OR REPLACE FUNCTION public.solicitar_promocao_admin(
  p_target_user_id uuid,
  p_target_role text,
  p_justificativa text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_masters int;
  v_required int;
  v_excecao boolean;
  v_id uuid;
  v_nome text;
BEGIN
  IF NOT public.is_active_admin(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Apenas administradores ativos podem solicitar promoções.');
  END IF;
  IF p_target_role NOT IN ('admin','administrador_master') THEN
    RETURN jsonb_build_object('error', 'Papel inválido.');
  END IF;
  IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 5 THEN
    RETURN jsonb_build_object('error', 'Informe uma justificativa.');
  END IF;
  SELECT nome_completo INTO v_nome FROM profiles WHERE user_id = p_target_user_id;
  IF v_nome IS NULL THEN
    RETURN jsonb_build_object('error', 'Usuário alvo não encontrado.');
  END IF;
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_target_user_id AND role = p_target_role::app_role) THEN
    RETURN jsonb_build_object('error', 'Usuário já possui este papel.');
  END IF;
  IF EXISTS (SELECT 1 FROM admin_promotion_requests
             WHERE target_user_id = p_target_user_id AND target_role = p_target_role::app_role
               AND status IN ('pendente','aprovado_parcialmente')) THEN
    RETURN jsonb_build_object('error', 'Já existe uma solicitação em andamento para este usuário/papel.');
  END IF;

  v_masters := public.count_active_masters();
  v_required := CASE WHEN v_masters >= 2 THEN 2 ELSE 1 END;
  v_excecao := (v_masters <= 1);

  INSERT INTO admin_promotion_requests (target_user_id, target_role, requested_by, justificativa, required_approvals, excecao_master)
  VALUES (p_target_user_id, p_target_role::app_role, auth.uid(), trim(p_justificativa), v_required, v_excecao)
  RETURNING id INTO v_id;

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (auth.uid(), 'admin_promotion_requests', 'PROMOCAO_SOLICITADA', v_id,
    jsonb_build_object('target_user_id', p_target_user_id, 'target_role', p_target_role,
      'required_approvals', v_required, 'excecao_master', v_excecao, 'justificativa', trim(p_justificativa), 'nome', v_nome));

  RETURN jsonb_build_object('success', true, 'id', v_id, 'required_approvals', v_required, 'excecao_master', v_excecao);
END;
$$;

CREATE OR REPLACE FUNCTION public.decidir_promocao_admin(
  p_request_id uuid,
  p_decision text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req admin_promotion_requests%ROWTYPE;
  v_approvals int;
  v_caller uuid := auth.uid();
BEGIN
  IF NOT public.is_active_admin(v_caller) THEN
    RETURN jsonb_build_object('error', 'Apenas administradores ativos podem decidir solicitações.');
  END IF;
  IF p_decision NOT IN ('aprovar','rejeitar') THEN
    RETURN jsonb_build_object('error', 'Decisão inválida.');
  END IF;

  SELECT * INTO v_req FROM admin_promotion_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Solicitação não encontrada.');
  END IF;
  IF v_req.status NOT IN ('pendente','aprovado_parcialmente') THEN
    RETURN jsonb_build_object('error', 'Solicitação já finalizada.');
  END IF;

  -- No self-approval: neither the requester nor the target may approve.
  IF v_caller = v_req.requested_by THEN
    RETURN jsonb_build_object('error', 'O solicitante não pode aprovar a própria solicitação.');
  END IF;
  IF v_caller = v_req.target_user_id THEN
    RETURN jsonb_build_object('error', 'O usuário indicado não pode aprovar a própria promoção.');
  END IF;

  -- Exception flow (single master): only an active master may grant the single approval.
  IF v_req.required_approvals = 1 AND p_decision = 'aprovar' AND NOT public.is_active_master(v_caller) THEN
    RETURN jsonb_build_object('error', 'No fluxo excepcional (1 master), somente o Administrador Master pode aprovar.');
  END IF;

  -- Record decision (unique per approver prevents double approval).
  BEGIN
    INSERT INTO admin_promotion_approvals (request_id, approver_id, decision, motivo)
    VALUES (p_request_id, v_caller, p_decision, p_motivo);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'Você já registrou uma decisão para esta solicitação.');
  END;

  IF p_decision = 'rejeitar' THEN
    UPDATE admin_promotion_requests SET status = 'rejeitado', concluido_em = now() WHERE id = p_request_id;
    INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
    VALUES (v_caller, 'admin_promotion_requests', 'PROMOCAO_REJEITADA', p_request_id,
      jsonb_build_object('approver', v_caller, 'motivo', p_motivo));
    RETURN jsonb_build_object('success', true, 'status', 'rejeitado');
  END IF;

  SELECT COUNT(*) INTO v_approvals FROM admin_promotion_approvals
  WHERE request_id = p_request_id AND decision = 'aprovar';

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (v_caller, 'admin_promotion_requests', 'PROMOCAO_APROVACAO_REGISTRADA', p_request_id,
    jsonb_build_object('approver', v_caller, 'aprovacoes', v_approvals, 'necessarias', v_req.required_approvals,
      'excecao_master', v_req.excecao_master, 'motivo', p_motivo));

  IF v_approvals < v_req.required_approvals THEN
    UPDATE admin_promotion_requests SET status = 'aprovado_parcialmente' WHERE id = p_request_id;
    RETURN jsonb_build_object('success', true, 'status', 'aprovado_parcialmente', 'aprovacoes', v_approvals, 'necessarias', v_req.required_approvals);
  END IF;

  -- Threshold reached: grant role (and admin if granting master).
  PERFORM set_config('app.allow_admin_grant', 'on', true);
  INSERT INTO user_roles (user_id, role) VALUES (v_req.target_user_id, v_req.target_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  IF v_req.target_role = 'administrador_master' THEN
    INSERT INTO user_roles (user_id, role) VALUES (v_req.target_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  PERFORM set_config('app.allow_admin_grant', 'off', true);

  UPDATE admin_promotion_requests SET status = 'aprovado', concluido_em = now() WHERE id = p_request_id;

  INSERT INTO audit_logs (user_id, tabela, acao, registro_id, dados_novos)
  VALUES (v_caller, 'admin_promotion_requests', 'PROMOCAO_CONCEDIDA', p_request_id,
    jsonb_build_object('target_user_id', v_req.target_user_id, 'target_role', v_req.target_role,
      'excecao_master', v_req.excecao_master, 'aprovacoes', v_approvals));

  RETURN jsonb_build_object('success', true, 'status', 'aprovado');
END;
$$;

REVOKE ALL ON FUNCTION public.solicitar_promocao_admin(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decidir_promocao_admin(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_promocao_admin(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decidir_promocao_admin(uuid, text, text) TO authenticated;