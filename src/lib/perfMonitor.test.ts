import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  measureAsync,
  recordMetric,
  getMetrics,
  getSummary,
  clearMetrics,
  METRICS_CAPACITY,
  SLOW_THRESHOLD_MS,
} from "./perfMonitor";

describe("perfMonitor", () => {
  beforeEach(() => {
    clearMetrics();
    vi.restoreAllMocks();
  });

  it("registra uma medição bem-sucedida", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await measureAsync("rpc:teste", async () => 42);
    expect(result).toBe(42);
    const metrics = getMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].label).toBe("rpc:teste");
    expect(metrics[0].ok).toBe(true);
  });

  it("registra erro e relança a exceção", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      measureAsync("rpc:falha", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const metrics = getMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].ok).toBe(false);
  });

  it("marca como lenta acima do limiar e avisa no console", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = recordMetric("rpc:lenta", SLOW_THRESHOLD_MS + 100);
    expect(m.slow).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("não avisa para operações rápidas", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = recordMetric("rpc:rapida", 10);
    expect(m.slow).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("respeita a capacidade do buffer circular", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < METRICS_CAPACITY + 20; i++) {
      recordMetric(`op-${i}`, 5);
    }
    expect(getMetrics().length).toBe(METRICS_CAPACITY);
  });

  it("agrega o resumo por rótulo ordenado por custo médio", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    recordMetric("a", 100);
    recordMetric("a", 200);
    recordMetric("b", 500);
    const summary = getSummary();
    expect(summary[0].label).toBe("b");
    const a = summary.find((r) => r.label === "a")!;
    expect(a.count).toBe(2);
    expect(a.avgMs).toBe(150);
    expect(a.maxMs).toBe(200);
  });
});
