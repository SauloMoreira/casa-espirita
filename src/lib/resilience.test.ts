import { describe, it, expect, vi } from "vitest";
import { withRetry, isTransientError } from "./resilience";

describe("withRetry", () => {
  it("retorna o valor na primeira tentativa bem-sucedida", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { baseDelayMs: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("repete até obter sucesso", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { baseDelayMs: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("relança o último erro após esgotar tentativas", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withRetry(fn, { retries: 3, baseDelayMs: 0 })).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respeita shouldRetry para parar cedo", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("validação"));
    await expect(
      withRetry(fn, { retries: 5, baseDelayMs: 0, shouldRetry: () => false }),
    ).rejects.toThrow("validação");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("dispara onRetry entre as tentativas", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(1);
    await withRetry(fn, { baseDelayMs: 0, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("isTransientError", () => {
  it("identifica erros de rede", () => {
    expect(isTransientError(new Error("Failed to fetch"))).toBe(true);
    expect(isTransientError(new Error("network timeout"))).toBe(true);
    expect(isTransientError("Connection lost")).toBe(true);
  });

  it("ignora erros não transitórios", () => {
    expect(isTransientError(new Error("CPF inválido"))).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
  });
});
