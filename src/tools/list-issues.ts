import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Octokit } from '@octokit/rest';
import { ListIssuesSchema } from '../schemas/index.js';
import { listIssues } from '../github/operations.js';
import { formatToolError } from '../errors/index.js';
import { withExponentialBackoff } from '../utils/retry.js';
import { logger } from '../utils/logging.js';

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
      logger.debug('list_issues request', { input });
      try {
        const issues = await withExponentialBackoff(() => listIssues(octokit, input));
        if (issues.length === 0) {
          return { content: [{ type: 'text', text: 'No se encontraron issues con esos filtros.' }] };
        }
        const lines = issues.map((i) => `- #${i.number} [${i.state}] ${i.title} -> ${i.htmlUrl}`);
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        const error = formatToolError(err, { tool: 'list_issues', input });
        logger.error('list_issues failed', { error });
        return {
          isError: true,
          content: [{ type: 'text', text: `[${error.code}] ${error.message}` }],
        };
      }
    },
  );
}
