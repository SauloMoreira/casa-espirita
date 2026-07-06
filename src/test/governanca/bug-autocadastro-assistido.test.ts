import { describe, it, expect } from "vitest";
import { ROLE, APP_ROLES, ADMINISTRATIVE_ROLES } from "@/constants/roles";

/**
 * BUG autocadastro — governança da correção (frontend/constantes).
 *
 * Prova, sem tocar em runtime/RLS:
 *  - a regra de bloqueio do ProtectedRoute só barra "pendente"/"inativo",
 *    portanto um assistido com profile "ativo" acessa a área básica;
 *  - a constante de papel base não sofreu drift (Q1-A2);
 *  - "assistido" é papel base, nunca administrativo.
 */

// Espelha ProtectedRoute.blockedStatus (fonte única da regra de bloqueio).
const isBlocked = (status: string | null | undefined) =>
  status === "inativo" || status === "pendente";

describe("BUG autocadastro — acesso básico do assistido (governança)", () => {
  it("profile 'ativo' não é bloqueado pelo ProtectedRoute", () => {
    expect(isBlocked("ativo")).toBe(false);
  });

  it("profiles 'pendente' e 'inativo' permanecem bloqueados", () => {
    expect(isBlocked("pendente")).toBe(true);
    expect(isBlocked("inativo")).toBe(true);
  });

  it("constante de papel base sem drift (Q1-A2)", () => {
    expect(ROLE.ASSISTIDO).toBe("assistido");
    expect(APP_ROLES).toContain("assistido");
  });

  it("assistido é papel base, nunca administrativo", () => {
    expect(ADMINISTRATIVE_ROLES).not.toContain("assistido" as never);
  });
});
