import { describe, it, expect } from "vitest";
import {
  isDeleteConfirmed,
  evaluateDeletion,
  canInactivate,
  DELETE_CONFIRM_WORD,
} from "./userManagement";

describe("isDeleteConfirmed", () => {
  it("requires the exact confirmation word (case-insensitive, trimmed)", () => {
    expect(isDeleteConfirmed("EXCLUIR")).toBe(true);
    expect(isDeleteConfirmed("  excluir  ")).toBe(true);
    expect(isDeleteConfirmed("Excluir")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isDeleteConfirmed("")).toBe(false);
    expect(isDeleteConfirmed("delete")).toBe(false);
    expect(isDeleteConfirmed("EXCLU")).toBe(false);
  });
  it("exposes the canonical confirm word", () => {
    expect(DELETE_CONFIRM_WORD).toBe("EXCLUIR");
  });
});

describe("evaluateDeletion", () => {
  const clean = { isSelf: false, isTargetAdmin: false, activeAdminCount: 3, linkCounts: {} };

  it("allows deletion when there are no links or special conditions", () => {
    const d = evaluateDeletion(clean);
    expect(d.canDelete).toBe(true);
    expect(d.blockers).toEqual([]);
  });

  it("blocks deletion when the user has audited actions", () => {
    const d = evaluateDeletion({ ...clean, linkCounts: { "ações auditadas": 5 } });
    expect(d.canDelete).toBe(false);
    expect(d.blockers).toContain("ações auditadas");
  });

  it("blocks deletion when the user has interviews and treatments", () => {
    const d = evaluateDeletion({
      ...clean,
      linkCounts: { "entrevistas registradas": 2, "tratamentos": 1, "vazio": 0 },
    });
    expect(d.canDelete).toBe(false);
    expect(d.blockers).toContain("entrevistas registradas");
    expect(d.blockers).toContain("tratamentos");
    expect(d.blockers).not.toContain("vazio");
  });

  it("blocks deletion of the last active admin", () => {
    const d = evaluateDeletion({ ...clean, isTargetAdmin: true, activeAdminCount: 1 });
    expect(d.canDelete).toBe(false);
    expect(d.blockers).toContain("é o último administrador ativo");
  });

  it("allows deleting an admin when other active admins remain", () => {
    const d = evaluateDeletion({ ...clean, isTargetAdmin: true, activeAdminCount: 2 });
    expect(d.canDelete).toBe(true);
  });

  it("blocks self-deletion", () => {
    const d = evaluateDeletion({ ...clean, isSelf: true });
    expect(d.canDelete).toBe(false);
    expect(d.blockers).toContain("não é permitido excluir o próprio usuário");
  });
});

describe("canInactivate", () => {
  it("allows inactivating a regular user", () => {
    expect(canInactivate({ isSelf: false, isTargetAdmin: false, activeAdminCount: 1 }).allowed).toBe(true);
  });
  it("blocks inactivating yourself", () => {
    const r = canInactivate({ isSelf: true, isTargetAdmin: false, activeAdminCount: 3 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/próprio/);
  });
  it("blocks inactivating the last active admin", () => {
    const r = canInactivate({ isSelf: false, isTargetAdmin: true, activeAdminCount: 1 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/último administrador/);
  });
  it("allows inactivating an admin when others remain active", () => {
    expect(canInactivate({ isSelf: false, isTargetAdmin: true, activeAdminCount: 2 }).allowed).toBe(true);
  });
});
