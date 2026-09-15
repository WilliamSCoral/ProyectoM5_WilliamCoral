import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Octokit } from '@octokit/rest';
import { CreateCommitSchema } from '../schemas/index.js';
import { createCommitWithFile } from '../github/operations.js';
import { formatToolError } from '../errors/index.js';
import { withExponentialBackoff } from '../utils/retry.js';
import { logger } from '../utils/logging.js';

export function registerCreateCommitTool(server: McpServer, octokit: Octokit) {
  server.registerTool(
    'create_commit',
    {
      description:
        'Crea o actualiza un archivo en un repositorio mediante un commit directo a una rama existente. ' +
        'Usar para crear/modificar archivos (ej: documentación, código, README) y confirmar el cambio en el historial. ' +
        'No usar para abrir issues ni para crear repositorios.',
      inputSchema: CreateCommitSchema.shape,
    },
    async (input) => {
      logger.debug('create_commit request', { input });
      try {
        const result = await withExponentialBackoff(() => createCommitWithFile(octokit, input));
        return {
          content: [
            { type: 'text', text: `Commit creado en ${input.branch}: ${result.commitSha}. URL: ${result.commitUrl}` },
          ],
        };
      } catch (err) {
        const error = formatToolError(err, { tool: 'create_commit', input });
        logger.error('create_commit failed', { error });
        return {
          isError: true,
          content: [{ type: 'text', text: `[${error.code}] ${error.message}` }],
        };
      }
    },
  );
}
