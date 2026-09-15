import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error('[FATAL] GITHUB_TOKEN no está configurado. Copiá .env.example a .env y completá el token.');
  process.exit(1);
}

const server = new McpServer({
  name: 'github-mcp-agent',
  version: '1.0.0',
});

// Tool de prueba (health-check) para validar el wiring server <-> host antes
// de sumar las tools reales de GitHub.
server.tool(
  'ping',
  'Health-check tool. Devuelve pong. Usar solo para verificar que el servidor MCP responde.',
  { message: z.string().optional() },
  async ({ message }) => {
    console.error(`[DEBUG] Request recibida - Tool: ping, message: ${message ?? '(vacío)'}`);
    return {
      content: [{ type: 'text', text: message ? `pong: ${message}` : 'pong' }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[INFO] github-mcp-agent MCP Server corriendo por stdio.');
}

main().catch((err) => {
  console.error('[FATAL] Error al iniciar el servidor MCP:', err);
  process.exit(1);
});
