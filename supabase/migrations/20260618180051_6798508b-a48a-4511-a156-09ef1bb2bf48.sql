CREATE TABLE public.mfa_recovery_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mfa_recovery_codes TO authenticated;
GRANT ALL ON public.mfa_recovery_codes TO service_role;

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users may read only their OWN codes (to display how many remain). The hash is
-- never reversible, so this exposes no usable secret. Generation/consumption is
-- performed exclusively by the service role via edge functions.
CREATE POLICY "Users can view own recovery codes"
ON public.mfa_recovery_codes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_mfa_recovery_codes_user ON public.mfa_recovery_codes (user_id, used_at);