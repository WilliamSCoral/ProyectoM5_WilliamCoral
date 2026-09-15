import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Octokit } from '@octokit/rest';
import { ListIssuesSchema } from '../schemas/index.js';
import { listIssues } from '../github/operations.js';
import { mapGitHubError } from '../errors/index.js';

export function registerListIssuesTool(server: McpServer, octokit: Octokit) {
  server.registerTool(
    'list_issues',
    {
      description:
        'Lista los issues de un repositorio conocido, filtrando por estado (open/closed/all). ' +
        'Requiere owner y repo. Si no se conocen, usar list_repositories primero.',
      inputSchema: ListIssuesSchema.shape,
    },
    async (input) => {
      console.error('[DEBUG] list_issues request:', input);
      try {
        const issues = await listIssues(octokit, input);
        if (issues.length === 0) {
          return { content: [{ type: 'text', text: 'No se encontraron issues con esos filtros.' }] };
        }
        const lines = issues.map((i) => `- #${i.number} [${i.state}] ${i.title} -> ${i.htmlUrl}`);
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
