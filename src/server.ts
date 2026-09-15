import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createOctokit } from './github/client.js';
import { registerCreateRepositoryTool } from './tools/create-repository.js';
import { registerListRepositoriesTool } from './tools/list-repositories.js';
import { registerCreateIssueTool } from './tools/create-issue.js';
import { registerListIssuesTool } from './tools/list-issues.js';
import { registerCreateCommitTool } from './tools/create-commit.js';

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error('[FATAL] GITHUB_TOKEN no está configurado. Copiá .env.example a .env y completá el token.');
  process.exit(1);
}

const octokit = createOctokit(token);

const server = new McpServer({
  name: 'github-mcp-agent',
  version: '1.0.0',
});

registerCreateRepositoryTool(server, octokit);
registerListRepositoriesTool(server, octokit);
registerCreateIssueTool(server, octokit);
registerListIssuesTool(server, octokit);
registerCreateCommitTool(server, octokit);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[INFO] github-mcp-agent MCP Server corriendo por stdio (5 tools registradas).');
}

main().catch((err) => {
  console.error('[FATAL] Error al iniciar el servidor MCP:', err);
  process.exit(1);
});
