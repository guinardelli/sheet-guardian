type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMeta = Record<string, unknown>;

const isDev = import.meta.env.DEV;

const normalizeError = (error?: unknown) => {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
};

const emit = (level: LogLevel, message: string, error?: unknown, meta?: LogMeta) => {
  if (!isDev) {
    return;
  }

  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  const normalizedError = normalizeError(error);
  if (normalizedError) {
    payload.error = normalizedError;
  }

  if (meta && Object.keys(meta).length > 0) {
    payload.meta = meta;
  }

  const prefix = `[SheetGuardian] ${message}`;

  switch (level) {
    case 'debug':
      console.debug(prefix, payload);
      break;
    case 'info':
      console.info(prefix, payload);
      break;
    case 'warn':
      console.warn(prefix, payload);
      break;
    case 'error':
      console.error(prefix, payload);
      break;
    default:
      console.info(prefix, payload);
  }
};

export const logger = {
  debug: (message: string, error?: unknown, meta?: LogMeta) => emit('debug', message, error, meta),
  info: (message: string, error?: unknown, meta?: LogMeta) => emit('info', message, error, meta),
  warn: (message: string, error?: unknown, meta?: LogMeta) => emit('warn', message, error, meta),
  error: (message: string, error?: unknown, meta?: LogMeta) => emit('error', message, error, meta),
};
