/**
 * Entry point del MCP Server. Este es el único archivo que se ejecuta
 * directamente (compilado a dist/server.js): arma el servidor MCP, registra
 * las 5 tools de GitHub, y lo conecta por stdio para que un Host (Antigravity,
 * MCP Inspector, etc.) pueda hablarle.
 */
import 'dotenv/config'; // Carga las variables de .env en process.env. Debe ser la primera línea.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createOctokit } from './github/client.js';
import { registerCreateRepositoryTool } from './tools/create-repository.js';
import { registerListRepositoriesTool } from './tools/list-repositories.js';
import { registerCreateIssueTool } from './tools/create-issue.js';
import { registerListIssuesTool } from './tools/list-issues.js';
import { registerCreateCommitTool } from './tools/create-commit.js';
import { logger } from './utils/logging.js';

const token = process.env.GITHUB_TOKEN;

// Fail-fast: si no hay token, el servidor ni arranca, en vez de fallar
// más adelante de forma confusa en la primera llamada a GitHub.
if (!token) {
  logger.error('GITHUB_TOKEN no está configurado. Copiá .env.example a .env y completá el token.');
  process.exit(1);
}

// Un solo cliente de Octokit, compartido por las 5 tools.
const octokit = createOctokit(token);

// Metadata que el servidor declara en el handshake "initialize" del protocolo MCP.
const server = new McpServer({
  name: 'github-mcp-agent',
  version: '1.0.0',
});

// Cada tool se registra en su propio archivo (src/tools/*.ts); acá solo se
// conectan al server y al cliente de Octokit compartido. El orden no importa.
registerCreateRepositoryTool(server, octokit);
registerListRepositoriesTool(server, octokit);
registerCreateIssueTool(server, octokit);
registerListIssuesTool(server, octokit);
registerCreateCommitTool(server, octokit);

/**
 * Conecta el servidor al transporte stdio: a partir de acá el proceso queda
 * escuchando mensajes JSON-RPC por su entrada estándar (stdin) y respondiendo
 * por su salida estándar (stdout). Ningún log debe pasar por stdout — por eso
 * el mensaje de confirmación usa logger.info (stderr), nunca console.log.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('github-mcp-agent MCP Server corriendo por stdio (5 tools registradas).');
}

// Si algo falla durante el arranque (por ejemplo, server.connect), se loguea
// el error y se termina el proceso con código de salida 1 (falla).
main().catch((err) => {
  logger.error('Error al iniciar el servidor MCP', { error: err instanceof Error ? err.message : err });
  process.exit(1);
});
