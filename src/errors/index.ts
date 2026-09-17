/**
 * Jerarquía de errores custom (AppError + 4 subclases) y la función
 * translateError, que es la única puerta de entrada de errores del sistema:
 * cualquier tool que atrape un error lo pasa por acá antes de devolverlo al
 * LLM, para que siempre reciba la misma forma (code, message, retryable) sin
 * importar de dónde vino el error (Zod, Octokit, red).
 */
import { RequestError } from '@octokit/request-error';
import { ZodError } from 'zod';

export type ErrorCode = 'VALIDATION_ERROR' | 'AUTH_ERROR' | 'GITHUB_API_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

/** Clase base. Las 4 subclases fijan su propio `code` en el constructor. */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status?: number; // código HTTP original, para debugging
  public readonly retryable: boolean; // ¿tiene sentido reintentar esta operación?
  public readonly details?: Record<string, unknown>;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(opts.message); // primera línea obligatoria: arma .message y .stack
    this.name = 'AppError';
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false; // ?? = si es undefined/null, usa false (no pisa un false explícito)
    this.details = opts.details;
  }
}

/** Input mal formado (falla de schema Zod). Nunca reintentable. */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ code: 'VALIDATION_ERROR', message, status: 400, retryable: false, details });
    this.name = 'ValidationError';
  }
}

/** Token inválido/expirado/sin permisos. Nunca reintentable: reintentar no arregla un token malo. */
export class AuthenticationError extends AppError {
  constructor(message = 'Token de GitHub inválido, expirado o sin permisos suficientes. Verificá GITHUB_TOKEN.') {
    super({ code: 'AUTH_ERROR', message, status: 401, retryable: false });
    this.name = 'AuthenticationError';
  }
}

/** Problema de conectividad. Reintentable por defecto (puede ser transitorio). */
export class NetworkError extends AppError {
  constructor(message = 'Error de red al contactar la API de GitHub.', details?: Record<string, unknown>) {
    super({ code: 'NETWORK_ERROR', message, status: 503, retryable: true, details });
    this.name = 'NetworkError';
  }
}

/** GitHub respondió con un error HTTP. retryable depende del caso (ver translateError). */
export class GitHubAPIError extends AppError {
  constructor(message: string, opts?: { status?: number; retryable?: boolean; details?: Record<string, unknown> }) {
    super({
      code: 'GITHUB_API_ERROR',
      message,
      status: opts?.status, // optional chaining: si opts es undefined, da undefined en vez de tirar error
      retryable: opts?.retryable ?? false,
      details: opts?.details,
    });
    this.name = 'GitHubAPIError';
  }
}

/**
 * Indica si un RequestError de Octokit corresponde específicamente a un rate
 * limit (403 con x-ratelimit-remaining: "0"), a diferencia de un 403 por
 * permisos insuficientes (que no es reintentable). El header es texto, por
 * eso la comparación es contra el string '0', no el número 0.
 */
function isRateLimit(err: RequestError): boolean {
  const remaining = err.response?.headers?.['x-ratelimit-remaining'];
  return err.status === 403 && remaining === '0';
}

/**
 * Traduce cualquier error crudo (Zod, Octokit/RequestError, red, etc.) a una
 * instancia de AppError con código, mensaje en lenguaje natural y si es
 * reintentable. Siempre devuelve algo: nunca deja pasar un error sin
 * clasificar (ver el AppError genérico al final).
 */
export function translateError(err: unknown, context?: Record<string, unknown>): AppError {
  // Si ya es un AppError, se devuelve tal cual (evita "doble envolver").
  if (err instanceof AppError) {
    return err;
  }

  // Falla de validación de Zod: se juntan todos los mensajes de campo en uno solo.
  if (err instanceof ZodError) {
    return new ValidationError(err.issues.map((issue) => issue.message).join('; '), { issues: err.issues });
  }

  if (err instanceof RequestError) {
    switch (err.status) {
      case 401:
        return new AuthenticationError();
      case 403:
        // Mismo código HTTP, dos causas distintas: se distingue mirando el header de rate limit.
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
        // Llaves propias: necesario para declarar una const dentro de un case de switch.
        const apiMessage = (err.response?.data as { message?: string } | undefined)?.message;
        return new GitHubAPIError(
          apiMessage ?? 'GitHub rechazó la solicitud: es posible que el recurso ya exista o los datos sean inválidos.',
          { status: 422, retryable: false, details: context },
        );
      }
      default:
        // Cualquier otro status: solo se marca reintentable si es error de servidor (5xx),
        // que sí puede ser transitorio.
        return new GitHubAPIError(`Error inesperado de la API de GitHub (status ${err.status}).`, {
          status: err.status,
          retryable: (err.status ?? 0) >= 500,
          details: context,
        });
    }
  }

  // Error de red genérico (no vino de Octokit): se busca alguna palabra clave
  // típica de fallos de conexión de Node.js en el mensaje.
  if (err instanceof Error && /network|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(err.message)) {
    return new NetworkError(err.message, context);
  }

  // Fallback: nada de lo anterior aplicó, se clasifica como desconocido.
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

/**
 * La función que efectivamente llaman las 5 tools. Clasifica el error con
 * translateError y se queda solo con 3 campos planos — sin el stack ni el
 * objeto Error completo, que no tiene sentido mandarle al LLM.
 */
export function formatToolError(err: unknown, context?: Record<string, unknown>): ToolErrorPayload {
  const appError = translateError(err, context);
  return { code: appError.code, message: appError.message, retryable: appError.retryable };
}
