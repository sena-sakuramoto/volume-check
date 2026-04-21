/**
 * Minimal structured logger. We intentionally avoid pulling in pino/winston
 * because this pipeline runs in a standalone container and every additional
 * dependency is another thing to keep in sync with the root app.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): number {
  const v = (process.env.MOJMAP_LOG_LEVEL ?? 'info').toLowerCase() as Level;
  return LEVELS[v] ?? LEVELS.info;
}

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (LEVELS[level] < minLevel()) return;
  const entry = {
    t: new Date().toISOString(),
    l: level,
    msg,
    ...(fields ?? {}),
  };
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  stream.write(`${JSON.stringify(entry)}\n`);
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};
