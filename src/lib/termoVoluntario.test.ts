import { describe, it, expect } from "vitest";
import {
  hasSignedTermo,
  canReviewTermo,
  canSendSigned,
  validateTermoFile,
  buildTermoPath,
} from "./termoVoluntario";

describe("termoVoluntario", () => {
  it("hasSignedTermo reflects presence of a stored file", () => {
    expect(hasSignedTermo({ termo_assinado_path: "x/y.pdf" })).toBe(true);
    expect(hasSignedTermo({ termo_assinado_path: null })).toBe(false);
    expect(hasSignedTermo({})).toBe(false);
  });

  it("canReviewTermo only when a signed term was sent", () => {
    expect(canReviewTermo({ termo_status: "assinado_enviado" })).toBe(true);
    expect(canReviewTermo({ termo_status: "validado" })).toBe(false);
    expect(canReviewTermo({ termo_status: "gerado" })).toBe(false);
  });

  it("canSendSigned unless already validated", () => {
    expect(canSendSigned({ termo_status: "gerado" })).toBe(true);
    expect(canSendSigned({ termo_status: "rejeitado" })).toBe(true);
    expect(canSendSigned({ termo_status: "validado" })).toBe(false);
  });

  describe("validateTermoFile", () => {
    it("accepts a valid PDF under the size limit", () => {
      expect(validateTermoFile({ type: "application/pdf", size: 1000 }).ok).toBe(true);
    });
    it("accepts images", () => {
      expect(validateTermoFile({ type: "image/png", size: 1000 }).ok).toBe(true);
    });
    it("rejects unsupported types", () => {
      const r = validateTermoFile({ type: "application/zip", size: 1000 });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/Formato/);
    });
    it("rejects oversized files", () => {
      const r = validateTermoFile({ type: "application/pdf", size: 20 * 1024 * 1024 });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/grande/);
    });
  });

  describe("buildTermoPath", () => {
    it("scopes the path to the volunteer id and preserves the extension", () => {
      const p = buildTermoPath("vol-123", "Termo Assinado.PDF");
      expect(p.startsWith("vol-123/")).toBe(true);
      expect(p.endsWith(".pdf")).toBe(true);
    });
    it("falls back to pdf when no extension", () => {
      expect(buildTermoPath("vol-1", "arquivo")).toMatch(/\.pdf$/);
    });
  });
});
