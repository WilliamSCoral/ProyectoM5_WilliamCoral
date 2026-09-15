import { RequestError } from '@octokit/request-error';
import { ZodError } from 'zod';

export type ErrorCode = 'VALIDATION_ERROR' | 'AUTH_ERROR' | 'GITHUB_API_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status?: number;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.name = 'AppError';
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
    this.details = opts.details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ code: 'VALIDATION_ERROR', message, status: 400, retryable: false, details });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Token de GitHub inválido, expirado o sin permisos suficientes. Verificá GITHUB_TOKEN.') {
    super({ code: 'AUTH_ERROR', message, status: 401, retryable: false });
    this.name = 'AuthenticationError';
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Error de red al contactar la API de GitHub.', details?: Record<string, unknown>) {
    super({ code: 'NETWORK_ERROR', message, status: 503, retryable: true, details });
    this.name = 'NetworkError';
  }
}

export class GitHubAPIError extends AppError {
  constructor(message: string, opts?: { status?: number; retryable?: boolean; details?: Record<string, unknown> }) {
    super({
      code: 'GITHUB_API_ERROR',
      message,
      status: opts?.status,
      retryable: opts?.retryable ?? false,
      details: opts?.details,
    });
    this.name = 'GitHubAPIError';
  }
}

/**
 * Indica si un RequestError de Octokit corresponde específicamente a un rate
 * limit (403 con x-ratelimit-remaining: "0"), a diferencia de un 403 por
 * permisos insuficientes (que no es reintentable).
 */
function isRateLimit(err: RequestError): boolean {
  const remaining = err.response?.headers?.['x-ratelimit-remaining'];
  return err.status === 403 && remaining === '0';
}

/**
 * Traduce cualquier error crudo (Zod, Octokit/RequestError, red, etc.) a una
 * instancia de AppError con código, mensaje en lenguaje natural y si es
 * reintentable. Esta es la única puerta de entrada de errores del sistema:
 * cualquier tool que atrape un error debe pasarlo por acá antes de
 * devolverlo al LLM.
 */
export function translateError(err: unknown, context?: Record<string, unknown>): AppError {
  if (err instanceof AppError) {
    return err;
  }

  if (err instanceof ZodError) {
    return new ValidationError(err.issues.map((issue) => issue.message).join('; '), { issues: err.issues });
  }

  if (err instanceof RequestError) {
    switch (err.status) {
      case 401:
        return new AuthenticationError();
      case 403:
        if (isRateLimit(err)) {
          return new GitHubAPIError('Límite de solicitudes de GitHub alcanzado (rate limit). Reintentando automáticamente.', {
            status: 403,
            retryable: true,
            details: context,
          });
        }
        return new GitHubAPIError('Permisos insuficientes para esta operación. Revisá los scopes del token (repo, user, admin:org).', {
          status: 403,
          retryable: false,
          details: context,
        });
      case 404:
        return new GitHubAPIError('El recurso solicitado no fue encontrado. Verificá owner/repo e intentá de nuevo.', {
          status: 404,
          retryable: false,
          details: context,
        });
      case 422: {
        const apiMessage = (err.response?.data as { message?: string } | undefined)?.message;
        return new GitHubAPIError(
          apiMessage ?? 'GitHub rechazó la solicitud: es posible que el recurso ya exista o los datos sean inválidos.',
          { status: 422, retryable: false, details: context },
        );
      }
      default:
        return new GitHubAPIError(`Error inesperado de la API de GitHub (status ${err.status}).`, {
          status: err.status,
          retryable: (err.status ?? 0) >= 500,
          details: context,
        });
    }
  }

  if (err instanceof Error && /network|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(err.message)) {
    return new NetworkError(err.message, context);
  }

  return new AppError({
    code: 'UNKNOWN_ERROR',
    message: err instanceof Error ? err.message : 'Error inesperado y no clasificado.',
    retryable: false,
    details: context,
  });
}

export interface ToolErrorPayload {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

/** Payload final, listo para devolver como contenido de un CallToolResult con isError: true. */
export function formatToolError(err: unknown, context?: Record<string, unknown>): ToolErrorPayload {
  const appError = translateError(err, context);
  return { code: appError.code, message: appError.message, retryable: appError.retryable };
}
