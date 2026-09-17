import { Octokit } from '@octokit/rest';

/**
 * Crea una instancia de Octokit autenticada. Recibe el token como parámetro
 * (en vez de leerlo directamente de process.env) para poder testear
 * operations.ts inyectando un Octokit real o un mock, sin depender de
 * variables de entorno globales. Esta función no sabe ni le importa de
 * quién es el token: GitHub identifica la cuenta dueña de ese token y todas
 * las operaciones se ejecutan sobre esa cuenta.
 */
export function createOctokit(token: string): Octokit {
  return new Octokit({
    auth: token, // Octokit arma el header Authorization automáticamente con esto
    userAgent: 'github-mcp-agent/1.0.0', // identifica la app ante GitHub, útil para debugging
  });
}
