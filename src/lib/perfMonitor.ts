// ============================================================================
// Observabilidade de performance (client-side, leve e sem dependências).
//
// Mede o tempo de execução de operações assíncronas críticas (RPCs, consultas,
// blocos pesados do dashboard) e mantém um buffer circular em memória com as
// medições mais recentes. Operações acima do limiar são logadas como aviso.
//
// Objetivo: dar visibilidade mínima dos pontos de custo sem alterar nenhuma
// regra de negócio nem o comportamento funcional. Puro acabamento/medição.
// ============================================================================

/** Limiar (ms) a partir do qual uma operação é considerada lenta. */
export const SLOW_THRESHOLD_MS = 800;

/** Capacidade do buffer circular de medições recentes. */
export const METRICS_CAPACITY = 100;

export interface PerfMetric {
  label: string;
  durationMs: number;
  slow: boolean;
  ok: boolean;
  at: number;
}

export interface PerfSummaryRow {
  label: string;
  count: number;
  avgMs: number;
  maxMs: number;
  slowCount: number;
  errorCount: number;
}

const buffer: PerfMetric[] = [];

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/** Registra manualmente uma medição já calculada. */
export function recordMetric(label: string, durationMs: number, ok = true): PerfMetric {
  const metric: PerfMetric = {
    label,
    durationMs: Math.max(0, Math.round(durationMs)),
    slow: durationMs >= SLOW_THRESHOLD_MS,
    ok,
    at: Date.now(),
  };
  buffer.push(metric);
  if (buffer.length > METRICS_CAPACITY) buffer.shift();

  if (metric.slow || !ok) {
    const tag = ok ? "lenta" : "erro";
    // Aviso discreto para inspeção via console em produção/preview.
    // eslint-disable-next-line no-console
    console.warn(`[perf] operação ${tag}: ${label} levou ${metric.durationMs}ms`);
  }
  return metric;
}

/**
 * Envolve uma operação assíncrona, medindo seu tempo de resposta e registrando
 * a métrica (inclusive em caso de erro). Retorna o valor original da operação.
 */
export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = now();
  try {
    const result = await fn();
    recordMetric(label, now() - start, true);
    return result;
  } catch (err) {
    recordMetric(label, now() - start, false);
    throw err;
  }
}

/** Retorna uma cópia das medições recentes (mais antigas primeiro). */
export function getMetrics(): PerfMetric[] {
  return [...buffer];
}

/** Limpa todas as medições acumuladas (uso em testes/diagnóstico). */
export function clearMetrics(): void {
  buffer.length = 0;
}

/** Agrega as medições por rótulo, com média, máximo e contagens. */
export function getSummary(): PerfSummaryRow[] {
  const groups = new Map<string, PerfMetric[]>();
  for (const m of buffer) {
    const arr = groups.get(m.label) ?? [];
    arr.push(m);
    groups.set(m.label, arr);
  }

  const rows: PerfSummaryRow[] = [];
  for (const [label, items] of groups) {
    const total = items.reduce((acc, m) => acc + m.durationMs, 0);
    rows.push({
      label,
      count: items.length,
      avgMs: Math.round(total / items.length),
      maxMs: items.reduce((acc, m) => Math.max(acc, m.durationMs), 0),
      slowCount: items.filter((m) => m.slow).length,
      errorCount: items.filter((m) => !m.ok).length,
    });
  }
  // Ordena pelas operações de maior custo médio.
  return rows.sort((a, b) => b.avgMs - a.avgMs);
}
