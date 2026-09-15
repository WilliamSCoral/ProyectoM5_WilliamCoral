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
      description:
        'Crea un nuevo repositorio de GitHub bajo la cuenta autenticada, con nombre y descripción opcional. ' +
        'Usar solo cuando el usuario pida explícitamente crear un repositorio NUEVO. ' +
        'No usar si el repositorio ya podría existir; en ese caso, usar list_repositories primero para confirmar.',
      inputSchema: CreateRepositorySchema.shape,
    },
    async (input) => {
      logger.debug('create_repository request', { input });
      try {
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
        return {
          isError: true,
          content: [{ type: 'text', text: `[${error.code}] ${error.message}` }],
        };
      }
    },
  );
}
