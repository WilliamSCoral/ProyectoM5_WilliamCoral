import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Octokit } from '@octokit/rest';
import { CreateCommitSchema } from '../schemas/index.js';
import { createCommitWithFile } from '../github/operations.js';
import { mapGitHubError } from '../errors/index.js';

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
      console.error('[DEBUG] create_commit request:', input);
      try {
        const result = await createCommitWithFile(octokit, input);
        return {
          content: [
            { type: 'text', text: `Commit creado en ${input.branch}: ${result.commitSha}. URL: ${result.commitUrl}` },
          ],
        };
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
