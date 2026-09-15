type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

function isEnabled(level: LogLevel): boolean {
  const configured = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';
  return LEVELS.indexOf(level) >= LEVELS.indexOf(configured);
}

/**
 * Logger estructurado (JSON) que siempre escribe por stderr, nunca por
 * stdout: en un MCP Server por stdio, stdout está reservado exclusivamente
 * para los mensajes del protocolo JSON-RPC.
 */
function log(level: LogLevel, msg: string, context?: Record<string, unknown>) {
  if (!isEnabled(level)) return;
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: level.toUpperCase(),
      msg,
      ...context,
    }),
  );
}

export const logger = {
  debug: (msg: string, context?: Record<string, unknown>) => log('debug', msg, context),
  info: (msg: string, context?: Record<string, unknown>) => log('info', msg, context),
  warn: (msg: string, context?: Record<string, unknown>) => log('warn', msg, context),
  error: (msg: string, context?: Record<string, unknown>) => log('error', msg, context),
};
