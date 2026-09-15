import { RequestError } from '@octokit/request-error';

export interface ToolErrorResult {
  code: string;
  message: string;
}

/**
 * Traduce errores de la API de GitHub (u otros errores inesperados) a un
 * código + mensaje en lenguaje natural que el LLM pueda comunicar al usuario.
 *
 * Esta es una primera versión funcional (Etapa 5). En la Etapa 6 se
 * reemplaza por una jerarquía formal de errores custom (ValidationError,
 * AuthenticationError, GitHubAPIError, NetworkError) con retry logic para
 * rate limiting (403).
 */
export function mapGitHubError(err: unknown): ToolErrorResult {
  if (err instanceof RequestError) {
    switch (err.status) {
      case 401:
        return {
          code: 'AUTH_ERROR',
          message: 'Token de GitHub inválido o expirado. Verificá la variable GITHUB_TOKEN.',
        };
      case 403:
        return {
          code: 'FORBIDDEN_OR_RATE_LIMIT',
          message:
            'Permisos insuficientes para esta operación o límite de la API de GitHub alcanzado. Revisá los scopes del token o esperá unos minutos.',
        };
      case 404:
        return {
          code: 'NOT_FOUND',
          message: 'El recurso solicitado no fue encontrado. Verificá que owner/repo sean correctos.',
        };
      case 422: {
        const apiMessage = (err.response?.data as { message?: string } | undefined)?.message;
        return {
          code: 'VALIDATION_FAILED',
          message: apiMessage ?? 'GitHub rechazó la solicitud: es posible que el recurso ya exista o los datos sean inválidos.',
        };
      }
      default:
        return {
          code: 'GITHUB_API_ERROR',
          message: `Error inesperado de la API de GitHub (status ${err.status}).`,
        };
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: err instanceof Error ? err.message : 'Error desconocido.',
  };
}
