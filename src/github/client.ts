import { Octokit } from '@octokit/rest';

/**
 * Crea una instancia de Octokit autenticada. Recibe el token como parámetro
 * (en vez de leerlo directamente de process.env) para poder testear
 * operations.ts inyectando un Octokit real o un mock, sin depender de
 * variables de entorno globales.
 */
export function createOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: 'github-mcp-agent/1.0.0',
  });
}
