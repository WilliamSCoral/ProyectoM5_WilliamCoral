import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Octokit } from '@octokit/rest';
import { CreateIssueSchema } from '../schemas/index.js';
import { createIssue } from '../github/operations.js';
import { mapGitHubError } from '../errors/index.js';

export function registerCreateIssueTool(server: McpServer, octokit: Octokit) {
  server.registerTool(
    'create_issue',
    {
      description:
        'Abre un nuevo issue en un repositorio existente, con título y body opcional. ' +
        'Requiere owner y repo conocidos; si no se conocen, usar list_repositories primero. ' +
        'No usar para crear archivos ni commits: para eso existe create_commit.',
      inputSchema: CreateIssueSchema.shape,
    },
    async (input) => {
      console.error('[DEBUG] create_issue request:', input);
      try {
        const issue = await createIssue(octokit, input);
        return {
          content: [
            { type: 'text', text: `Issue #${issue.number} creado: "${issue.title}". URL: ${issue.htmlUrl}` },
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
