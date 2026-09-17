/**
 * Registra la tool list_repositories. Mismo patrón que create-repository.ts;
 * la diferencia propia acá es el manejo de "lista vacía" antes de armar el
 * texto de respuesta.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Octokit } from '@octokit/rest';
import { ListRepositoriesSchema } from '../schemas/index.js';
import { listRepositories } from '../github/operations.js';
import { formatToolError } from '../errors/index.js';
import { withExponentialBackoff } from '../utils/retry.js';
import { logger } from '../utils/logging.js';

export function registerListRepositoriesTool(server: McpServer, octokit: Octokit) {
  server.registerTool(
    'list_repositories',
    {
      description:
        'Lista los repositorios del usuario autenticado, con filtros de visibilidad y orden. ' +
        'Usar para descubrir qué repositorios existen antes de operar sobre uno (por ejemplo, antes de crear un issue). ' +
        'No usar para obtener detalles de un único repositorio conocido.',
      inputSchema: ListRepositoriesSchema.shape,
    },
    async (input) => {
      logger.debug('list_repositories request', { input });
      try {
        const repos = await withExponentialBackoff(() => listRepositories(octokit, input));
        // Mensaje distinto si no hay resultados, en vez de devolver texto vacío confuso.
        if (repos.length === 0) {
          return { content: [{ type: 'text', text: 'No se encontraron repositorios con esos filtros.' }] };
        }
        // Un repo por línea: "- fullName (visibilidad) -> url".
        const lines = repos.map(
          (r) => `- ${r.fullName} (${r.private ? 'privado' : 'público'}) -> ${r.htmlUrl}`,
        );
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        const error = formatToolError(err, { tool: 'list_repositories', input });
        logger.error('list_repositories failed', { error });
        return {
          isError: true,
          content: [{ type: 'text', text: `[${error.code}] ${error.message}` }],
        };
      }
    },
  );
}
