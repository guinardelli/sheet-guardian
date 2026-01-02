import * as Sentry from "@sentry/react";
import type { SeverityLevel } from "@sentry/react";
import { configureLogger, type LogEvent, type LogLevel } from "@/lib/logger";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

const sentryLevelMap: Record<LogLevel, SeverityLevel> = {
  debug: "debug",
  info: "info",
  warn: "warning",
  error: "error",
};

const captureLog = (event: LogEvent) => {
  const error = event.error instanceof Error ? event.error : new Error(event.message);

  Sentry.withScope((scope) => {
    scope.setLevel(sentryLevelMap[event.level]);
    if (event.meta?.requestId) {
      scope.setTag("requestId", event.meta.requestId);
    }
    if (event.meta) {
      scope.setContext("meta", event.meta);
    }
    scope.setExtra("message", event.message);
    scope.setExtra("timestamp", event.timestamp);
    if (event.error && !(event.error instanceof Error)) {
      scope.setExtra("error", event.error);
    }
    Sentry.captureException(error);
  });
};

export const initSentry = () => {
  if (!import.meta.env.PROD || !SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });

  configureLogger({
    sentryHandler: captureLog,
    sentryMinLevel: "error",
  });
};
