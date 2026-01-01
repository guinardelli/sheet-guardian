export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogMeta = Record<string, unknown> & { requestId?: string };

export type LogEvent = {
  level: LogLevel;
  message: string;
  timestamp: string;
  error?: unknown;
  meta?: LogMeta;
};

type LoggerConfig = {
  minLevel: LogLevel;
  consoleEnabled: boolean;
  sentryHandler?: (event: LogEvent) => void;
  sentryMinLevel: LogLevel;
};

const isDev = import.meta.env.DEV;

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const parseLevel = (value?: string): LogLevel | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  return undefined;
};

let config: LoggerConfig = {
  minLevel: parseLevel(import.meta.env.VITE_LOG_LEVEL) ?? (isDev ? 'debug' : 'warn'),
  consoleEnabled: true,
  sentryMinLevel: 'error',
};

export const configureLogger = (next: Partial<LoggerConfig>) => {
  config = { ...config, ...next };
};

const shouldLog = (level: LogLevel, minLevel: LogLevel) =>
  levelRank[level] >= levelRank[minLevel];

const normalizeError = (error?: unknown) => {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
};

const emit = (level: LogLevel, message: string, error?: unknown, meta?: LogMeta) => {
  const timestamp = new Date().toISOString();
  const event: LogEvent = { level, message, timestamp, error, meta };

  const { requestId, ...metaRest } = meta ?? {};

  const payload: Record<string, unknown> = {
    timestamp,
    level,
  };

  if (requestId) {
    payload.requestId = requestId;
  }

  const normalizedError = normalizeError(error);
  if (normalizedError) {
    payload.error = normalizedError;
  }

  if (Object.keys(metaRest).length > 0) {
    payload.meta = metaRest;
  }

  const prefix = `[SheetGuardian] ${message}`;

  if (config.consoleEnabled && shouldLog(level, config.minLevel)) {
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
  }

  if (config.sentryHandler && shouldLog(level, config.sentryMinLevel)) {
    config.sentryHandler(event);
  }
};

export const logger = {
  debug: (message: string, error?: unknown, meta?: LogMeta) => emit('debug', message, error, meta),
  info: (message: string, error?: unknown, meta?: LogMeta) => emit('info', message, error, meta),
  warn: (message: string, error?: unknown, meta?: LogMeta) => emit('warn', message, error, meta),
  error: (message: string, error?: unknown, meta?: LogMeta) => emit('error', message, error, meta),
};
