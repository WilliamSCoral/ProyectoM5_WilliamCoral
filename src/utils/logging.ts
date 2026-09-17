/**
 * Logger estructurado (JSON) que siempre escribe por stderr, nunca por
 * stdout: en un MCP Server por stdio, stdout está reservado exclusivamente
 * para los mensajes del protocolo JSON-RPC.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Ordenados de menos a más grave.
const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * Compara posiciones en el array (no el texto): si LOG_LEVEL='warn'
 * (posición 2), un log 'debug' (posición 0) queda oculto porque 0 >= 2 es
 * falso, pero un log 'error' (posición 3) sí se muestra.
 */
function isEnabled(level: LogLevel): boolean {
  const configured = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';
  return LEVELS.indexOf(level) >= LEVELS.indexOf(configured);
}

function log(level: LogLevel, msg: string, context?: Record<string, unknown>) {
  if (!isEnabled(level)) return;
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: level.toUpperCase(),
      msg,
      ...context, // spread: desparrama las propiedades de context en este objeto, sin anidar
    }),
  );
}

// La función log nunca se exporta directa: se expone así, con el primer
// argumento (el nivel) ya fijado en cada método — logger.error('msg', {...})
// en vez de log('error', 'msg', {...}).
export const logger = {
  debug: (msg: string, context?: Record<string, unknown>) => log('debug', msg, context),
  info: (msg: string, context?: Record<string, unknown>) => log('info', msg, context),
  warn: (msg: string, context?: Record<string, unknown>) => log('warn', msg, context),
  error: (msg: string, context?: Record<string, unknown>) => log('error', msg, context),
};
