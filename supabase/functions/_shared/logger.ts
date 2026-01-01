type LogLevel = 'info' | 'warn' | 'error';
type LogDetails = Record<string, unknown>;
type LogContext = { requestId?: string };

const formatDetails = (details?: LogDetails, context?: LogContext) => {
  const merged = {
    ...(details ?? {}),
    ...(context?.requestId ? { requestId: context.requestId } : {}),
  };
  return Object.keys(merged).length > 0 ? ` - ${JSON.stringify(merged)}` : '';
};

const write = (
  level: LogLevel,
  scope: string,
  message: string,
  details?: LogDetails,
  context?: LogContext,
) => {
  const line = `[${scope}] ${message}${formatDetails(details, context)}`;
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

export const createLogger = (scope: string, context: LogContext = {}) => ({
  withContext: (nextContext: LogContext) => createLogger(scope, { ...context, ...nextContext }),
  info: (message: string, details?: LogDetails) => write('info', scope, message, details, context),
  warn: (message: string, details?: LogDetails) => write('warn', scope, message, details, context),
  error: (message: string, details?: LogDetails) => write('error', scope, message, details, context),
});
