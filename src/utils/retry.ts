import { RequestError } from '@octokit/request-error';
import { logger } from './logging.js';

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
};

/**
 * Un 403 de GitHub solo se reintenta si corresponde a rate limit
 * (x-ratelimit-remaining: "0"). Un 403 por permisos insuficientes, o
 * cualquier 401/400, NUNCA se reintenta: reintentar ahí solo demora un error
 * que no se va a resolver solo.
 */
function isRetryableRateLimit(err: unknown): boolean {
  if (!(err instanceof RequestError)) return false;
  if (err.status !== 403) return false;
  return err.response?.headers?.['x-ratelimit-remaining'] === '0';
}

/**
 * Ejecuta fn() reintentando con backoff exponencial (1s, 2s, 4s, ...) SOLO
 * ante rate limiting de GitHub. Cualquier otro error se propaga de
 * inmediato en el primer intento.
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {},
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_OPTIONS, ...opts };
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (!isRetryableRateLimit(err) || attempt > maxRetries) {
        throw err;
      }

      const waitMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      logger.warn('Rate limit alcanzado, reintentando con backoff', {
        attempt,
        maxRetries,
        waitMs,
      });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
