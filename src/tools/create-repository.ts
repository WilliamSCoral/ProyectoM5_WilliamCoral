/**
 * Registra la tool create_repository en el servidor MCP. Este archivo junta
 * todas las capas anteriores: el schema (contrato), la operación de GitHub
 * (lógica), el traductor de errores y el retry (robustez).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Octokit } from '@octokit/rest';
import { CreateRepositorySchema } from '../schemas/index.js';
import { createRepository } from '../github/operations.js';
import { formatToolError } from '../errors/index.js';
import { withExponentialBackoff } from '../utils/retry.js';
import { logger } from '../utils/logging.js';

export function registerCreateRepositoryTool(server: McpServer, octokit: Octokit) {
  server.registerTool(
    'create_repository',
    {
      // El LLM lee esto para decidir cuándo usar (o NO usar) esta tool.
      description:
        'Crea un nuevo repositorio de GitHub bajo la cuenta autenticada, con nombre y descripción opcional. ' +
        'Usar solo cuando el usuario pida explícitamente crear un repositorio NUEVO. ' +
        'No usar si el repositorio ya podría existir; en ese caso, usar list_repositories primero para confirmar.',
      // .shape extrae el objeto de campos "crudo" que el SDK necesita para
      // convertir el schema de Zod a JSON Schema.
      inputSchema: CreateRepositorySchema.shape,
    },
    async (input) => {
      // El input ya llega validado: el SDK corrió el schema antes de invocar esto.
      logger.debug('create_repository request', { input });
      try {
        // Se envuelve en () => ... (no se llama directo) para que
        // withExponentialBackoff pueda re-ejecutar la operación en cada reintento.
        const repo = await withExponentialBackoff(() => createRepository(octokit, input));
        return {
          content: [
            {
              type: 'text',
              text: `Repositorio creado: ${repo.fullName} (${repo.private ? 'privado' : 'público'}). URL: ${repo.htmlUrl}`,
            },
          ],
        };
      } catch (err) {
        const error = formatToolError(err, { tool: 'create_repository', input });
        logger.error('create_repository failed', { error });
        // isError: true es lo que le dice al Host que la tool falló (protocolo MCP).
        return {
          isError: true,
          content: [{ type: 'text', text: `[${error.code}] ${error.message}` }],
        };
      }
    },
  );
}
