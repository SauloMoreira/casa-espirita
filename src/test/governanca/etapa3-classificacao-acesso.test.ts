import { describe, it, expect } from "vitest";
import {
  classifyRole,
  groupRolesByClass,
  OPERATIONAL_ROLES,
  ADMINISTRATIVE_ROLES,
} from "@/constants/roles";

/**
 * Etapa 3 — User screen role classification.
 * Guards the read-only separation of access into base / operacional /
 * administrativo and the exact adherence to real system role names.
 */
describe("classifyRole — três classes de acesso", () => {
  it("assistido é sempre base", () => {
    expect(classifyRole("assistido")).toBe("base");
  });

  it("papéis administrativos reais", () => {
    expect(classifyRole("admin")).toBe("administrativo");
    expect(classifyRole("administrador_master")).toBe("administrativo");
  });

  it("papéis operacionais reais (nomes canônicos)", () => {
    expect(classifyRole("entrevistador")).toBe("operacional");
    expect(classifyRole("tarefeiro")).toBe("operacional");
    expect(classifyRole("coordenador_de_tratamento")).toBe("operacional");
  });

  it("não usa nomes inválidos de papel", () => {
    // 'coordenador' (sem sufixo) não é um papel real do enum app_role
    expect(OPERATIONAL_ROLES).not.toContain("coordenador" as never);
    expect(ADMINISTRATIVE_ROLES).not.toContain("administrador" as never);
  });
});

describe("groupRolesByClass — cumulatividade preservada", () => {
  it("agrupa papéis cumulativos por classe sem perder o base", () => {
    const groups = groupRolesByClass([
      "assistido",
      "tarefeiro",
      "admin",
      "entrevistador",
    ]);
    expect(groups.base).toEqual(["assistido"]);
    expect(groups.operacional).toEqual(["tarefeiro", "entrevistador"]);
    expect(groups.administrativo).toEqual(["admin"]);
  });

  it("pessoa só com base aparece como assistido", () => {
    const groups = groupRolesByClass(["assistido"]);
    expect(groups.base).toEqual(["assistido"]);
    expect(groups.operacional).toHaveLength(0);
    expect(groups.administrativo).toHaveLength(0);
  });
});
