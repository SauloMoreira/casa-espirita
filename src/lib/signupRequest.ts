// Pure, testable business rules for the public self-registration request flow.
//
// Conceptual separation enforced across the system:
//   A. Account / authentication  -> Supabase auth user (password lives there)
//   B. System access role        -> user_roles (default 'assistido' after approval)
//   C. Volunteer function/type   -> voluntarios / voluntario_funcoes
//   D. Assistido condition       -> assistidos table linkage
// These can coexist on the same person but are never the same thing.
//
// The authoritative enforcement lives in the `request-signup` and
// `manage-signup` edge functions; this module mirrors the validation rules so
// they can be unit-tested and reused on the client.

import { isValidCPF, isValidEmail, isValidPhone } from "./validators";

/** The only role a freshly approved self-registration may receive. */
export const DEFAULT_APPROVED_ROLE = "assistido" as const;

/** Roles that may NEVER be self-selected during public registration. */
export const FORBIDDEN_SELF_ROLES = [
  "admin",
  "administrador_master",
  "tarefeiro",
  "entrevistador",
  "coordenador_de_tratamento",
] as const;

export interface SignupInput {
  nome_completo: string;
  email: string;
  cpf?: string;
  celular?: string;
  password: string;
  confirmPassword: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Validate a self-registration request. CPF is optional, but when provided it
 * must be a valid CPF. Celular is optional but validated when provided.
 */
export function validateSignup(input: SignupInput): ValidationResult {
  const errors: Record<string, string> = {};

  const nome = (input.nome_completo || "").trim();
  if (nome.length < 3) errors.nome_completo = "Informe seu nome completo.";
  if (nome.length > 120) errors.nome_completo = "Nome muito longo.";

  const email = (input.email || "").trim();
  if (!email) errors.email = "Informe o e-mail.";
  else if (!isValidEmail(email)) errors.email = "E-mail inválido.";

  if (input.cpf && input.cpf.replace(/\D/g, "").length > 0 && !isValidCPF(input.cpf)) {
    errors.cpf = "CPF inválido.";
  }

  if (input.celular && input.celular.replace(/\D/g, "").length > 0 && !isValidPhone(input.celular)) {
    errors.celular = "Celular inválido.";
  }

  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  if (input.password !== input.confirmPassword) {
    errors.confirmPassword = "As senhas não coincidem.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export type SignupDecision = "aprovar" | "rejeitar";

export interface DecisionContext {
  /** Current status of the request being decided. */
  currentStatus: string;
  decision: SignupDecision;
  motivo?: string | null;
}

export interface DecisionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Decide whether an admin decision over a registration request is allowed.
 * Only pending requests can be decided; a rejection requires a reason.
 */
export function evaluateSignupDecision(ctx: DecisionContext): DecisionResult {
  if (ctx.currentStatus !== "pendente") {
    return { allowed: false, reason: "Solicitação já finalizada." };
  }
  if (ctx.decision !== "aprovar" && ctx.decision !== "rejeitar") {
    return { allowed: false, reason: "Decisão inválida." };
  }
  if (ctx.decision === "rejeitar" && (!ctx.motivo || ctx.motivo.trim().length < 3)) {
    return { allowed: false, reason: "Informe o motivo da rejeição." };
  }
  return { allowed: true };
}
