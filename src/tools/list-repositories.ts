import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Octokit } from '@octokit/rest';
import { ListRepositoriesSchema } from '../schemas/index.js';
import { listRepositories } from '../github/operations.js';
import { mapGitHubError } from '../errors/index.js';

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
      console.error('[DEBUG] list_repositories request:', input);
      try {
        const repos = await listRepositories(octokit, input);
        if (repos.length === 0) {
          return { content: [{ type: 'text', text: 'No se encontraron repositorios con esos filtros.' }] };
        }
        const lines = repos.map(
          (r) => `- ${r.fullName} (${r.private ? 'privado' : 'público'}) -> ${r.htmlUrl}`,
        );
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        const mapped = mapGitHubError(err);
        return {
          isError: true,
          content: [{ type: 'text', text: `[${mapped.code}] ${mapped.message}` }],
        };
      }
    },
  );
}
