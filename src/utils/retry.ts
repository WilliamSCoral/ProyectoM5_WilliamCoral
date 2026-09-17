/**
 * Reintentos con backoff exponencial, EXCLUSIVAMENTE para rate limiting de
 * GitHub. Cualquier otro error (auth, validación, 404, etc.) se propaga de
 * inmediato en el primer intento — reintentar ahí solo demora un error que
 * no se va a resolver solo.
 */
import { RequestError } from '@octokit/request-error';
import { logger } from './logging.js';

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number; // espera del primer reintento
  maxDelayMs: number; // techo: la espera nunca crece sin límite
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
};

/**
 * 3 chequeos en cascada (early return): si no es un RequestError, si el
 * status no es 403, o si el header de rate limit no está en "0", no es
 * reintentable. Duplica la lógica de isRateLimit en errors/index.ts a
 * propósito, para que este archivo no dependa de aquel — quedan desacoplados.
 */
function isRetryableRateLimit(err: unknown): boolean {
  if (!(err instanceof RequestError)) return false;
  if (err.status !== 403) return false;
  return err.response?.headers?.['x-ratelimit-remaining'] === '0';
}

/**
 * Ejecuta fn() reintentando con backoff exponencial (1s, 2s, 4s, ...) SOLO
 * ante rate limiting de GitHub. `fn` es una función que produce la
 * operación (no un valor ya resuelto) para poder volver a ejecutarla en
 * cada reintento. `<T>` es un genérico: funciona con cualquier tipo de
 * resultado (repos, issues, commits...).
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {},
): Promise<T> {
  // Combina defaults + opciones explícitas (las explícitas pisan a los defaults).
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_OPTIONS, ...opts };
  let attempt = 0;

  while (true) {
    try {
      return await fn(); // éxito: termina la función acá mismo
    } catch (err) {
      attempt++;
      if (!isRetryableRateLimit(err) || attempt > maxRetries) {
        throw err; // no reintentable, o sin intentos restantes: se propaga tal cual
      }

      // Backoff exponencial: intento 1 → ×2⁰=1, intento 2 → ×2¹=2, intento 3 → ×2²=4.
      const waitMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      logger.warn('Rate limit alcanzado, reintentando con backoff', {
        attempt,
        maxRetries,
        waitMs,
      });
      // Patrón estándar de JS para "esperar X ms" de forma asincrónica.
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
