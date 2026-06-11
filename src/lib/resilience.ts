// ============================================================================
// Resiliência operacional para uso em campo (internet instável).
//
// `withRetry` reexecuta uma operação assíncrona em caso de falha transitória,
// com backoff exponencial leve. Não altera regras de negócio: é apenas uma
// camada de tolerância para ações sensíveis (ex.: registrar presença/check-in).
// ============================================================================

export interface RetryOptions {
  /** Número máximo de tentativas (inclui a primeira). Padrão: 3. */
  retries?: number;
  /** Atraso base em ms antes de repetir (cresce exponencialmente). Padrão: 400. */
  baseDelayMs?: number;
  /** Decide se o erro é elegível para nova tentativa. Padrão: sempre. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback opcional disparado antes de cada nova tentativa. */
  onRetry?: (error: unknown, attempt: number) => void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa `fn` com novas tentativas em caso de falha. Mantém a semântica
 * original (retorna o valor ou relança o último erro após esgotar tentativas).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = Math.max(1, options.retries ?? 3);
  const baseDelay = Math.max(0, options.baseDelayMs ?? 400);
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = attempt >= retries;
      if (isLast || !shouldRetry(err, attempt)) break;
      options.onRetry?.(err, attempt);
      // Backoff exponencial: base * 2^(attempt-1).
      await wait(baseDelay * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

/** Heurística simples para erros de rede/transitórios dignos de retry. */
export function isTransientError(error: unknown): boolean {
  if (!error) return false;
  const msg = (
    typeof error === "string"
      ? error
      : (error as { message?: string })?.message ?? ""
  ).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("failed to fetch") ||
    msg.includes("connection") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("504")
  );
}
