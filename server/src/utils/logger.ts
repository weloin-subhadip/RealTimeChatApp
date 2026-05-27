/**
 * Tiny console logger. Kept deliberately minimal for a learning project — swap
 * for pino/winston later without changing call sites.
 */
const ts = () => new Date().toISOString();

export const logger = {
  info: (...args: unknown[]) => console.log(`[${ts()}] [info]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${ts()}] [warn]`, ...args),
  error: (...args: unknown[]) => console.error(`[${ts()}] [error]`, ...args),
};
