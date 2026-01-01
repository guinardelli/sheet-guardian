import { supabase, isSupabaseConfigured } from "@/services/supabase/client";
import { logger } from "@/lib/logger";
import type { Json, TablesInsert } from "@/services/supabase/types";

type ErrorContext = Record<string, unknown>;

type NormalizedError = {
  message: string;
  stack?: string | null;
};

const trackingEnabled = import.meta.env.PROD;
let initialized = false;

const normalizeError = (error: unknown): NormalizedError => {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack ?? null };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: "Unknown error" };
  }
};

const toJson = (value: unknown): Json | null => {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return null;
  }
};

const getPageUrl = () => (typeof window === "undefined" ? null : window.location.href);
const getUserAgent = () => (typeof navigator === "undefined" ? null : navigator.userAgent);

export const captureError = async (error: unknown, context?: ErrorContext) => {
  if (!trackingEnabled) {
    logger.debug("Error tracking disabled", undefined, { context });
    return;
  }

  if (!isSupabaseConfigured) {
    logger.debug("Supabase not configured; skipping error log", undefined, { context });
    return;
  }

  const normalized = normalizeError(error);
  if (!normalized.message) return;

  const payload: TablesInsert<"error_logs"> = {
    message: normalized.message,
    stack: normalized.stack ?? null,
    url: getPageUrl(),
    user_agent: getUserAgent(),
    context: toJson(context),
  };

  const { data: sessionData } = await supabase.auth.getSession();
  payload.user_id = sessionData.session?.user?.id ?? null;

  const { error: insertError } = await supabase.from("error_logs").insert(payload);
  if (insertError) {
    logger.warn("Failed to record error log", insertError);
  }
};

export const trackSubscriptionIssue = (userId: string, issue: string, details?: ErrorContext) => {
  if (trackingEnabled) {
    void captureError(`Subscription Issue: ${issue}`, {
      ...details,
      component: "subscription",
      issue_type: issue,
      user_id: userId,
    });
    return;
  }

  logger.warn("Subscription Issue", undefined, { userId, issue, ...details });
};

export const initErrorTracker = () => {
  if (!trackingEnabled || initialized || typeof window === "undefined") {
    return;
  }

  initialized = true;

  window.addEventListener("error", (event) => {
    void captureError(event.error ?? event.message, {
      source: "window.error",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    void captureError(event.reason, {
      source: "unhandledrejection",
    });
  });
};

