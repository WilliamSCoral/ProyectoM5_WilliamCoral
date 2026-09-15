import { describe, it, expect, vi } from 'vitest';
import { RequestError } from '@octokit/request-error';
import { ZodError, z } from 'zod';
import {
  translateError,
  formatToolError,
  AuthenticationError,
  GitHubAPIError,
  ValidationError,
} from '../src/errors/index.js';
import { withExponentialBackoff } from '../src/utils/retry.js';

function makeRequestError(
  status: number,
  opts: { headers?: Record<string, string>; data?: unknown } = {},
): RequestError {
  return new RequestError('GitHub API error', status, {
    request: { method: 'GET', url: 'https://api.github.com/test', headers: {} },
    response: {
      status,
      url: 'https://api.github.com/test',
      headers: opts.headers ?? {},
      data: opts.data ?? {},
    },
  } as any);
}

describe('translateError', () => {
  it('mapea un 401 a AuthenticationError, no reintentable', () => {
    const error = translateError(makeRequestError(401));
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.retryable).toBe(false);
  });

  it('mapea un 404 a un mensaje claro en lenguaje natural', () => {
    const error = translateError(makeRequestError(404));
    expect(error).toBeInstanceOf(GitHubAPIError);
    expect(error.code).toBe('GITHUB_API_ERROR');
    expect(error.message).toMatch(/no fue encontrado/i);
    expect(error.retryable).toBe(false);
  });

  it('un 403 con rate limit agotado es retryable', () => {
    const error = translateError(makeRequestError(403, { headers: { 'x-ratelimit-remaining': '0' } }));
    expect(error.retryable).toBe(true);
  });

  it('un 403 sin rate limit (permisos) NO es retryable', () => {
    const error = translateError(makeRequestError(403, { headers: { 'x-ratelimit-remaining': '10' } }));
    expect(error.retryable).toBe(false);
    expect(error.message).toMatch(/permisos/i);
  });

  it('un 422 usa el mensaje de GitHub cuando está disponible', () => {
    const error = translateError(makeRequestError(422, { data: { message: 'name already exists on this account' } }));
    expect(error.message).toBe('name already exists on this account');
  });

  it('mapea un ZodError a ValidationError', () => {
    const zodResult = z.object({ title: z.string().min(3) }).safeParse({ title: 'a' });
    expect(zodResult.success).toBe(false);
    if (!zodResult.success) {
      const error = translateError(zodResult.error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('un error no clasificado cae en UNKNOWN_ERROR', () => {
    const error = translateError(new Error('algo raro pasó'));
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.retryable).toBe(false);
  });
});

describe('formatToolError', () => {
  it('devuelve un payload con code, message y retryable', () => {
    const payload = formatToolError(makeRequestError(401));
    expect(payload).toEqual({
      code: 'AUTH_ERROR',
      message: expect.any(String),
      retryable: false,
    });
  });
});

describe('withExponentialBackoff', () => {
  it('reintenta ante rate limit y devuelve el resultado cuando finalmente funciona', async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) {
        throw makeRequestError(403, { headers: { 'x-ratelimit-remaining': '0' } });
      }
      return 'ok';
    });

    const result = await withExponentialBackoff(fn, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 5 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('NO reintenta ante un 401 (falla en el primer intento)', async () => {
    const fn = vi.fn().mockRejectedValue(makeRequestError(401));

    await expect(withExponentialBackoff(fn, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 5 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
