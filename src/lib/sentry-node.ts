import * as Sentry from "@sentry/node";
import type { LogEvent, LogLevel } from "./logger";

type SentryNodeConfig = {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
  enabled?: boolean;
};

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const shouldSend = (level: LogLevel, minLevel: LogLevel) =>
  levelRank[level] >= levelRank[minLevel];

const toSentryLevel = (level: LogLevel) => {
  switch (level) {
    case "debug":
      return "debug";
    case "warn":
      return "warning";
    case "error":
      return "error";
    case "info":
    default:
      return "info";
  }
};

let initialized = false;

export const initSentryNode = (config: SentryNodeConfig = {}) => {
  if (config.enabled === false) return false;
  if (initialized) return true;

  const dsn = config.dsn ?? process.env.SENTRY_DSN ?? process.env.VITE_SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: config.environment ?? process.env.NODE_ENV,
    tracesSampleRate: config.tracesSampleRate ?? 0,
  });

  initialized = true;
  return true;
};

const captureLog = (event: LogEvent) => {
  const error = event.error instanceof Error ? event.error : new Error(event.message);

  Sentry.withScope((scope) => {
    scope.setLevel(toSentryLevel(event.level));
    if (event.meta?.requestId) {
      scope.setTag("requestId", event.meta.requestId);
    }
    if (event.meta && Object.keys(event.meta).length > 0) {
      scope.setContext("meta", event.meta);
    }
    scope.setExtra("message", event.message);
    scope.setExtra("timestamp", event.timestamp);
    Sentry.captureException(error);
  });
};

export const captureCriticalLog = (event: LogEvent) => {
  if (!initialized) return;
  if (!shouldSend(event.level, "error")) return;
  captureLog(event);
};

export const createSentryTransport = (minLevel: LogLevel = "error") => (event: LogEvent) => {
  if (!initialized) return;
  if (!shouldSend(event.level, minLevel)) return;
  captureLog(event);
};
