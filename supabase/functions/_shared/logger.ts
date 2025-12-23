type LogLevel = 'info' | 'warn' | 'error';

const formatDetails = (details?: Record<string, unknown>) =>
  details ? ` - ${JSON.stringify(details)}` : '';

const write = (level: LogLevel, scope: string, message: string, details?: Record<string, unknown>) => {
  const line = `[${scope}] ${message}${formatDetails(details)}`;
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.info(line);
};

export const createLogger = (scope: string) => ({
  info: (message: string, details?: Record<string, unknown>) => write('info', scope, message, details),
  warn: (message: string, details?: Record<string, unknown>) => write('warn', scope, message, details),
  error: (message: string, details?: Record<string, unknown>) => write('error', scope, message, details),
});
