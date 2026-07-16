import { describe, it, expect } from "vitest";
import {
  validateSignup,
  evaluateSignupDecision,
  DEFAULT_APPROVED_ROLE,
  FORBIDDEN_SELF_ROLES,
} from "./signupRequest";


const valid = {
  nome_completo: "Maria da Silva",
  email: "maria@example.com",
  cpf: "529.982.247-25", // valid CPF
  celular: "(11) 91234-5678",
  password: "senhaSegura123",
  confirmPassword: "senhaSegura123",
};


describe("validateSignup", () => {
  it("accepts a complete valid request", () => {
    expect(validateSignup(valid).valid).toBe(true);
  });

  it("requires a full name", () => {
    const r = validateSignup({ ...valid, nome_completo: "Ma" });
    expect(r.valid).toBe(false);
    expect(r.errors.nome_completo).toBeTruthy();
  });

  it("rejects invalid email", () => {
    const r = validateSignup({ ...valid, email: "not-an-email" });
    expect(r.valid).toBe(false);
    expect(r.errors.email).toBeTruthy();
  });

  it("rejects invalid CPF when provided", () => {
    const r = validateSignup({ ...valid, cpf: "111.111.111-11" });
    expect(r.valid).toBe(false);
    expect(r.errors.cpf).toBeTruthy();
  });

  it("requires CPF", () => {
    const r = validateSignup({ ...valid, cpf: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.cpf).toBeTruthy();
  });

  it("still allows omitting optional celular", () => {
    const r = validateSignup({ ...valid, celular: "" });
    expect(r.valid).toBe(true);
  });

  it("requires a password", () => {
    const r = validateSignup({ ...valid, password: "", confirmPassword: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.password).toBeTruthy();
  });

  it("enforces minimum password length", () => {
    const r = validateSignup({ ...valid, password: "123", confirmPassword: "123" });
    expect(r.valid).toBe(false);
    expect(r.errors.password).toBeTruthy();
  });

  it("requires matching password confirmation", () => {
    const r = validateSignup({ ...valid, confirmPassword: "outraSenha123" });
    expect(r.valid).toBe(false);
    expect(r.errors.confirmPassword).toBeTruthy();
  });

});

describe("default and forbidden roles", () => {
  it("uses assistido as the secure default approved role", () => {
    expect(DEFAULT_APPROVED_ROLE).toBe("assistido");
  });

  it("never allows elevated roles to be self-selected", () => {
    expect(FORBIDDEN_SELF_ROLES).toContain("admin");
    expect(FORBIDDEN_SELF_ROLES).toContain("tarefeiro");
    expect(FORBIDDEN_SELF_ROLES).not.toContain("assistido");
  });
});

describe("evaluateSignupDecision", () => {
  it("approves a pending request", () => {
    expect(evaluateSignupDecision({ currentStatus: "pendente", decision: "aprovar" }).allowed).toBe(true);
  });

  it("blocks deciding an already finalized request", () => {
    const r = evaluateSignupDecision({ currentStatus: "aprovado", decision: "aprovar" });
    expect(r.allowed).toBe(false);
  });

  it("requires a reason to reject", () => {
    const r = evaluateSignupDecision({ currentStatus: "pendente", decision: "rejeitar", motivo: "" });
    expect(r.allowed).toBe(false);
  });

  it("accepts rejection with a reason", () => {
    const r = evaluateSignupDecision({ currentStatus: "pendente", decision: "rejeitar", motivo: "Dados inconsistentes" });
    expect(r.allowed).toBe(true);
  });
});
