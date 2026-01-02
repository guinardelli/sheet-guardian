# Instrucoes de Implementacao - Correcao de Seguranca AppSec

## Contexto

Este documento contem instrucoes detalhadas para corrigir vulnerabilidades criticas de seguranca relacionadas ao uso inadequado da `SUPABASE_SERVICE_ROLE_KEY` nas Edge Functions do Supabase.

**Severidade: CRITICA**

---

## Problema Identificado

Todas as 8 Edge Functions usam `SERVICE_ROLE_KEY` para criar o cliente Supabase, o que **bypassa completamente o Row Level Security (RLS)**. Alem disso, 2 funcoes (`cleanup-tokens` e `health-check`) nao possuem NENHUMA autenticacao.

### Riscos:
1. **Sem defesa em profundidade**: RLS bypassado em todas as operacoes
2. **Vulnerabilidade a IDOR**: Se um atacante manipular o user_id, pode acessar dados de outros usuarios
3. **cleanup-tokens e health-check**: Qualquer pessoa pode chamar (zero autenticacao)
4. **processing_tokens**: RLS habilitado mas sem policies definidas

---

## Arquivos a Criar

### 1. CRIAR: `supabase/functions/_shared/auth.ts`

```typescript
import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env.ts";

export type AuthResult =
  | { success: true; user: User; supabase: SupabaseClient }
  | { success: false; error: string; status: number };

/**
 * Valida o JWT do usuario e retorna um cliente Supabase que respeita RLS.
 * O cliente e criado com a anon key + JWT do usuario, garantindo que
 * todas as queries passem pelo RLS com auth.uid() correto.
 */
export const authenticateUser = async (
  authHeader: string | null
): Promise<AuthResult> => {
  if (!authHeader?.startsWith("Bearer ")) {
    return { success: false, error: "Missing or invalid Authorization header", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  // Cria cliente com anon key para validar o JWT
  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

  if (userError || !userData.user) {
    return {
      success: false,
      error: userError?.message ?? "Invalid or expired token",
      status: 401
    };
  }

  // Cria um novo cliente com o JWT do usuario para queries com RLS
  const supabaseWithAuth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return { success: true, user: userData.user, supabase: supabaseWithAuth };
};

/**
 * Verifica se o request possui um token de administrador valido.
 * Usado para endpoints de manutencao (cron jobs, health checks).
 */
export const validateAdminToken = (
  authHeader: string | null,
  expectedSecret: string
): boolean => {
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.replace("Bearer ", "");
  return token === expectedSecret && token.length > 0;
};
```

---

## Arquivos a Modificar

### 2. MODIFICAR: `supabase/functions/_shared/env.ts`

Adicionar a seguinte funcao ao final do arquivo existente:

```typescript
export const getAdminSecret = (env: EnvGetter = defaultEnv) =>
  getRequiredEnv("ADMIN_SECRET", env, ["CRON_SECRET"]);
```

---

### 3. REFATORAR: `supabase/functions/validate-processing/index.ts`

Substituir TODO o conteudo do arquivo por:

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createLogger } from "../_shared/logger.ts";
import { authenticateUser } from "../_shared/auth.ts";
import type { ErrorResponse, SubscriptionPlan, TokenConsumeResponse, TokenResponse } from "../_shared/response-types.ts";

type ValidatePayload = {
  action?: "validate" | "consume";
  file?: {
    name?: string | null;
    sizeBytes?: number | null;
    mimeType?: string | null;
  };
  processingToken?: string | null;
};

const allowedOrigins = new Set([
  "https://vbablocker.vercel.app",
  "http://localhost:8080",
]);

const PLAN_LIMITS: Record<SubscriptionPlan, { sheetsPerWeek: number | null; sheetsPerMonth: number | null; maxFileSizeMB: number | null }> = {
  free: { sheetsPerWeek: null, sheetsPerMonth: 2, maxFileSizeMB: 1 },
  professional: { sheetsPerWeek: 5, sheetsPerMonth: null, maxFileSizeMB: 3 },
  premium: { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
};

const TOKEN_TTL_MS = 5 * 60 * 1000;

const baseLogger = createLogger("VALIDATE-PROCESSING");

const getCorsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
};

const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekNumber = (date: Date): string => {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const jsonResponse = <T,>(
  body: T,
  status: number,
  corsHeaders: Record<string, string>,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorResponse = (
  message: string,
  status: number,
  errorCode: string,
  corsHeaders: Record<string, string>,
  requestId: string,
) => {
  const body: ErrorResponse = { error: message, errorCode, requestId };
  return jsonResponse(body, status, corsHeaders);
};

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const logger = baseLogger.withContext({ requestId });
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);
  const withRequestId = <T extends Record<string, unknown>>(body: T): T & { requestId: string } => ({
    ...body,
    requestId,
  });

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED", corsHeaders, requestId);
    }

    let payload: ValidatePayload = {};
    try {
      payload = (await req.json()) as ValidatePayload;
    } catch (error) {
      logger.warn("Invalid JSON body", { message: error instanceof Error ? error.message : String(error) });
      return errorResponse("Invalid JSON body", 400, "INVALID_JSON", corsHeaders, requestId);
    }

    const action = payload.action ?? "validate";
    if (action !== "validate" && action !== "consume") {
      return errorResponse("Invalid action", 400, "INVALID_ACTION", corsHeaders, requestId);
    }

    // AUTENTICACAO COM RLS
    const authResult = await authenticateUser(req.headers.get("Authorization"));
    if (!authResult.success) {
      return errorResponse(authResult.error, authResult.status, "UNAUTHORIZED", corsHeaders, requestId);
    }

    const { user, supabase } = authResult;

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan, sheets_used_today, sheets_used_week, sheets_used_month, last_sheet_date, last_reset_date")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError || !subscription) {
      logger.warn("Subscription not found", { userId: user.id, message: subscriptionError?.message });
      return errorResponse("Subscription not found", 403, "SUBSCRIPTION_NOT_FOUND", corsHeaders, requestId);
    }

    const plan = (subscription.plan as SubscriptionPlan) ?? "free";
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    const today = new Date();
    const todayStr = getLocalDateString(today);
    const currentWeek = getWeekNumber(today);
    const currentMonth = todayStr.substring(0, 7);

    const lastDate = subscription.last_sheet_date
      ? new Date(`${subscription.last_sheet_date}T00:00:00`)
      : null;
    const lastWeek = lastDate ? getWeekNumber(lastDate) : "";
    const lastResetMonth = subscription.last_reset_date
      ? subscription.last_reset_date.substring(0, 7)
      : null;

    const usedThisWeek = lastWeek === currentWeek ? (subscription.sheets_used_week ?? 0) : 0;
    const usedThisMonth = lastResetMonth === currentMonth ? (subscription.sheets_used_month ?? 0) : 0;

    const failValidation = (reason: string, errorCode: string) => {
      if (action === "consume") {
        const body: TokenConsumeResponse = withRequestId({ success: false, error: reason, errorCode });
        return jsonResponse(body, 400, corsHeaders);
      }

      const body: TokenResponse = withRequestId({ allowed: false, reason, suggestUpgrade: true, errorCode });
      return jsonResponse(body, 400, corsHeaders);
    };

    if (limits.maxFileSizeMB && payload.file?.sizeBytes && payload.file.sizeBytes > limits.maxFileSizeMB * 1024 * 1024) {
      return failValidation(`Arquivo muito grande. Limite do plano: ${limits.maxFileSizeMB} MB.`, "FILE_TOO_LARGE");
    }

    if (limits.sheetsPerWeek !== null && usedThisWeek >= limits.sheetsPerWeek) {
      return failValidation(`Limite semanal atingido (${usedThisWeek}/${limits.sheetsPerWeek}).`, "WEEKLY_LIMIT_REACHED");
    }

    if (limits.sheetsPerMonth !== null && usedThisMonth >= limits.sheetsPerMonth) {
      return failValidation(`Limite mensal atingido (${usedThisMonth}/${limits.sheetsPerMonth}).`, "MONTHLY_LIMIT_REACHED");
    }

    if (action === "consume") {
      const processingToken = payload.processingToken;
      if (!processingToken) {
        const body: TokenConsumeResponse = withRequestId({
          success: false,
          error: "Missing processing token",
          errorCode: "MISSING_PROCESSING_TOKEN",
        });
        return jsonResponse(body, 400, corsHeaders);
      }

      const { data: tokenRow, error: tokenError } = await supabase
        .from("processing_tokens")
        .select("id, expires_at, used_at")
        .eq("token", processingToken)
        .maybeSingle();

      if (tokenError || !tokenRow) {
        logger.warn("Processing token not found", { userId: user.id });
        return errorResponse("Invalid processing token", 403, "INVALID_PROCESSING_TOKEN", corsHeaders, requestId);
      }

      if (tokenRow.used_at) {
        return errorResponse("Processing token already used", 403, "PROCESSING_TOKEN_USED", corsHeaders, requestId);
      }

      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        return errorResponse("Processing token expired", 403, "PROCESSING_TOKEN_EXPIRED", corsHeaders, requestId);
      }

      const { error: tokenUpdateError } = await supabase
        .from("processing_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);

      if (tokenUpdateError) {
        logger.error("Failed to mark processing token as used", { message: tokenUpdateError.message });
        return errorResponse("Failed to update processing token", 500, "TOKEN_UPDATE_FAILED", corsHeaders, requestId);
      }

      const isToday = subscription.last_sheet_date === todayStr;
      const newSheetsToday = isToday ? subscription.sheets_used_today + 1 : 1;
      const newSheetsWeek = lastWeek === currentWeek ? (subscription.sheets_used_week ?? 0) + 1 : 1;
      const newSheetsMonth = lastResetMonth === currentMonth
        ? subscription.sheets_used_month + 1
        : 1;

      const { error: usageError } = await supabase
        .from("subscriptions")
        .update({
          sheets_used_today: newSheetsToday,
          sheets_used_week: newSheetsWeek,
          sheets_used_month: newSheetsMonth,
          last_sheet_date: todayStr,
          last_reset_date: lastResetMonth === currentMonth ? subscription.last_reset_date : todayStr,
        })
        .eq("user_id", user.id);

      if (usageError) {
        logger.error("Failed to update usage", { message: usageError.message, userId: user.id });
        return errorResponse("Failed to update usage", 500, "USAGE_UPDATE_FAILED", corsHeaders, requestId);
      }

      const body: TokenConsumeResponse = withRequestId({ success: true });
      return jsonResponse(body, 200, corsHeaders);
    }

    const processingToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    const { error: tokenInsertError } = await supabase
      .from("processing_tokens")
      .insert({
        user_id: user.id,
        token: processingToken,
        expires_at: expiresAt,
      });

    if (tokenInsertError) {
      logger.error("Failed to create processing token", { message: tokenInsertError.message, userId: user.id });
      return errorResponse("Failed to create processing token", 500, "TOKEN_CREATE_FAILED", corsHeaders, requestId);
    }

    const body: TokenResponse = withRequestId({
      allowed: true,
      processingToken,
      expiresAt,
      plan,
    });
    return jsonResponse(body, 200, corsHeaders);
  } catch (error) {
    logger.error("Unexpected error", { message: error instanceof Error ? error.message : String(error) });
    return errorResponse("Internal server error", 500, "UNEXPECTED_ERROR", corsHeaders, requestId);
  }
});
```

---

### 4. REFATORAR: `supabase/functions/check-subscription/index.ts`

Substituir TODO o conteudo do arquivo por:

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";
import { authenticateUser } from "../_shared/auth.ts";
import { getServiceRoleKey, getStripeSecretKey, getSupabaseUrl } from "../_shared/env.ts";
import type { SubscriptionPlan, SubscriptionResponse } from "../_shared/response-types.ts";

const allowedOrigins = new Set([
  "https://vbablocker.vercel.app",
  "http://localhost:8080",
]);

const getCorsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
};

const baseLogger = createLogger("CHECK-SUBSCRIPTION");

const PRODUCT_TO_PLAN: Record<string, SubscriptionPlan> = {
  "prod_TaJslOsZAWnhcN": "professional",
  "prod_TaJsysi99Q1g2J": "premium",
};

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const logger = baseLogger.withContext({ requestId });
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info("Function started");

    // AUTENTICACAO COM RLS
    const authResult = await authenticateUser(req.headers.get("Authorization"));
    if (!authResult.success) {
      throw new Error(authResult.error);
    }

    const { user, supabase: supabaseUser } = authResult;
    logger.info("User authenticated", { userId: user.id, email: user.email });

    const { data: existingSubscription, error: existingError } = await supabaseUser
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      logger.warn("Failed to load existing subscription", { error: existingError.message, userId: user.id });
    }

    const stripeKey = getStripeSecretKey();
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    logger.info("Looking up Stripe customer", { email: user.email });
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });

    if (customers.data.length === 0) {
      logger.info("No Stripe customer found, returning free plan");
      const body: SubscriptionResponse = {
        requestId,
        subscribed: false,
        plan: "free",
        product_id: null,
        subscription_end: null,
        cancel_at_period_end: false,
      };
      return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logger.info("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let plan: SubscriptionPlan = "free";
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;
    let cancelAtPeriodEnd = false;

    // Service role para UPDATE - usuario ja autenticado via JWT
    // JUSTIFICATIVA: Sincronizacao com Stripe requer acesso privilegiado
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
      productId = subscription.items.data[0].price.product as string;
      plan = PRODUCT_TO_PLAN[productId] || "free";
      logger.info("Active subscription found", { subscriptionId: subscription.id, plan, productId });

      const shouldResetUsage = existingSubscription?.plan === "free" && plan !== "free";

      const { error: updateError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          plan,
          payment_status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          stripe_product_id: productId,
          cancel_at_period_end: cancelAtPeriodEnd,
          current_period_end: subscriptionEnd,
          ...(shouldResetUsage
            ? {
                sheets_used_today: 0,
                sheets_used_week: 0,
                last_sheet_date: null,
              }
            : {}),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (updateError) {
        logger.warn("Failed to update local subscription", { error: updateError.message });
      } else {
        logger.info("Subscription updated", {
          userId: user.id,
          plan,
          payment_status: "active",
          stripe_subscription_id: subscription.id,
        });
      }
    } else {
      logger.info("No active subscription found");

      const { error: resetError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          plan: "free",
          payment_status: "pending",
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          stripe_product_id: null,
          cancel_at_period_end: false,
          current_period_end: null,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (resetError) {
        logger.warn("Failed to reset subscription", { error: resetError.message, userId: user.id });
      } else {
        logger.info("Subscription reset to free", { userId: user.id });
      }
    }

    const body: SubscriptionResponse = {
      requestId,
      subscribed: hasActiveSub,
      plan,
      product_id: productId,
      subscription_end: subscriptionEnd,
      cancel_at_period_end: cancelAtPeriodEnd
    };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error", { message: errorMessage });
    const body: SubscriptionResponse = {
      requestId,
      subscribed: false,
      error: errorMessage,
      details: "Erro ao verificar assinatura. Tente novamente em alguns segundos."
    };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
```

---

### 5. REFATORAR: `supabase/functions/cleanup-tokens/index.ts`

Substituir TODO o conteudo do arquivo por:

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";
import { validateAdminToken } from "../_shared/auth.ts";
import { getAdminSecret, getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
import type { CleanupTokensResponse } from "../_shared/response-types.ts";

const baseLogger = createLogger("CLEANUP-TOKENS");
const TTL_MS = 24 * 60 * 60 * 1000;

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const logger = baseLogger.withContext({ requestId });

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed", requestId }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // AUTENTICACAO VIA ADMIN SECRET
  let adminSecret: string;
  try {
    adminSecret = getAdminSecret();
  } catch {
    const body: CleanupTokensResponse = {
      error: "Admin secret not configured",
      requestId
    };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isAuthorized = validateAdminToken(req.headers.get("Authorization"), adminSecret);
  if (!isAuthorized) {
    logger.warn("Unauthorized cleanup attempt");
    const body: CleanupTokensResponse = {
      error: "Unauthorized",
      requestId
    };
    return new Response(JSON.stringify(body), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    serviceRoleKey = getServiceRoleKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const body: CleanupTokensResponse = { error: message, requestId };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const cutoff = new Date(Date.now() - TTL_MS).toISOString();

  try {
    const { error, count } = await supabase
      .from("processing_tokens")
      .delete({ count: "exact" })
      .lt("expires_at", cutoff);

    if (error) {
      logger.error("Failed to cleanup tokens", { message: error.message });
      const body: CleanupTokensResponse = { error: error.message, requestId };
      return new Response(JSON.stringify(body), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.info("Cleanup completed", { deleted: count ?? 0, cutoff });
    const body: CleanupTokensResponse = { deleted: count ?? 0, cutoff, requestId };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Unexpected cleanup error", { message });
    const body: CleanupTokensResponse = { error: message, requestId };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

---

### 6. REFATORAR: `supabase/functions/health-check/index.ts`

Substituir TODO o conteudo do arquivo por:

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createLogger } from "../_shared/logger.ts";
import { validateAdminToken } from "../_shared/auth.ts";
import { getAdminSecret, getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
import type { HealthCheckResponse, HealthCheckUser } from "../_shared/response-types.ts";

const allowedOrigins = new Set([
  "https://vbablocker.vercel.app",
  "http://localhost:8080",
]);

const getCorsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
};

const baseLogger = createLogger("HEALTH-CHECK");

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const logger = baseLogger.withContext({ requestId });
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // AUTENTICACAO VIA ADMIN SECRET
  let adminSecret: string;
  try {
    adminSecret = getAdminSecret();
  } catch {
    const body: HealthCheckResponse = {
      requestId,
      status: "error",
      error: "Admin secret not configured",
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const isAuthorized = validateAdminToken(req.headers.get("Authorization"), adminSecret);
  if (!isAuthorized) {
    logger.warn("Unauthorized health check attempt");
    const body: HealthCheckResponse = {
      requestId,
      status: "error",
      error: "Unauthorized",
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    serviceRoleKey = getServiceRoleKey();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const body: HealthCheckResponse = {
      requestId,
      status: "error",
      error: message,
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const { data: users, error: usersError } = await supabaseAdmin
      .schema("auth")
      .from("users")
      .select("id, email");

    if (usersError) {
      throw new Error(`Auth users query failed: ${usersError.message}`);
    }

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id");

    if (subscriptionsError) {
      throw new Error(`Subscriptions query failed: ${subscriptionsError.message}`);
    }

    const typedUsers = (users ?? []) as HealthCheckUser[];
    const subscriptionIds = new Set((subscriptions ?? []).map((row) => row.user_id));
    const usersWithoutSubscription = typedUsers.filter((user) => !subscriptionIds.has(user.id));

    const response: HealthCheckResponse = {
      requestId,
      status: usersWithoutSubscription.length === 0 ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      usersWithoutSubscription: usersWithoutSubscription.length,
      details: usersWithoutSubscription.length > 0 ? usersWithoutSubscription : undefined,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.status === "healthy" ? 200 : 500,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Health check error", { message });

    const response: HealthCheckResponse = {
      requestId,
      status: "error",
      error: message,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
```

---

### 7. REFATORAR: `supabase/functions/process-file/index.ts`

Substituir as linhas de autenticacao por:

**REMOVER** (linhas 228-238 aproximadamente):
```typescript
const supabaseUrl = getSupabaseUrl();
const serviceRoleKey = getServiceRoleKey();
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const accessToken = authHeader.replace("Bearer ", "");
const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
if (userError || !userData.user) {
  return errorResponse("Unauthorized", 401, "UNAUTHORIZED", corsHeaders, requestId);
}
```

**SUBSTITUIR POR**:
```typescript
// AUTENTICACAO COM RLS
const authResult = await authenticateUser(req.headers.get("Authorization"));
if (!authResult.success) {
  return errorResponse(authResult.error, authResult.status, "UNAUTHORIZED", corsHeaders, requestId);
}

const { user } = authResult;
logger.info("User authenticated", { userId: user.id });
```

**ADICIONAR IMPORT** no topo do arquivo:
```typescript
import { authenticateUser } from "../_shared/auth.ts";
```

**REMOVER IMPORTS** nao utilizados:
```typescript
// Remover estas linhas se nao forem mais usadas:
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
```

---

### 8. REFATORAR: `supabase/functions/create-checkout/index.ts`

**REMOVER** (linhas 66-74 aproximadamente):
```typescript
const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();
const supabaseServiceRoleKey = getServiceRoleKey();

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
```

E as linhas de autenticacao (85-105).

**SUBSTITUIR POR**:
```typescript
// AUTENTICACAO COM RLS
const authResult = await authenticateUser(req.headers.get("Authorization"));
if (!authResult.success) {
  const body: CheckoutResponse = { error: authResult.error, requestId };
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: authResult.status,
  });
}

const { user } = authResult;
if (!user.email) throw new Error("User email not available");
logger.info("User authenticated", { userId: user.id, email: user.email });
```

**ADICIONAR IMPORT**:
```typescript
import { authenticateUser } from "../_shared/auth.ts";
```

Para o UPDATE com service role, manter apenas onde necessario:
```typescript
// Service role para UPDATE - usuario ja autenticado via JWT
const supabaseUrl = getSupabaseUrl();
const serviceRoleKey = getServiceRoleKey();
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
```

---

### 9. REFATORAR: `supabase/functions/customer-portal/index.ts`

**REMOVER** (linhas 41-59 aproximadamente):
```typescript
const stripeKey = getStripeSecretKey();
const supabaseUrl = getSupabaseUrl();
const serviceRoleKey = getServiceRoleKey();

const supabaseClient = createClient(
  supabaseUrl,
  serviceRoleKey,
  { auth: { persistSession: false } }
);

const authHeader = req.headers.get("Authorization");
if (!authHeader) throw new Error("No authorization header provided");

const token = authHeader.replace("Bearer ", "");
const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
if (userError) throw new Error(`Authentication error: ${userError.message}`);
const user = userData.user;
if (!user?.email) throw new Error("User not authenticated or email not available");
```

**SUBSTITUIR POR**:
```typescript
// AUTENTICACAO COM RLS
const authResult = await authenticateUser(req.headers.get("Authorization"));
if (!authResult.success) {
  const body: CustomerPortalResponse = { error: authResult.error, requestId };
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: authResult.status,
  });
}

const { user } = authResult;
if (!user.email) throw new Error("User email not available");
logger.info("User authenticated", { userId: user.id, email: user.email });

// Esta funcao NAO precisa de service role - apenas le do Stripe
const stripeKey = getStripeSecretKey();
```

**ADICIONAR IMPORT**:
```typescript
import { authenticateUser } from "../_shared/auth.ts";
```

**REMOVER IMPORTS** nao utilizados:
```typescript
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
// Manter apenas:
import { getStripeSecretKey } from "../_shared/env.ts";
```

---

## Migration SQL a Criar

### CRIAR: `supabase/migrations/YYYYMMDD_add_processing_tokens_rls_policies.sql`

Substituir YYYYMMDD pela data atual no formato correto (ex: 20260102).

```sql
-- RLS Policies para processing_tokens
-- A tabela ja tem RLS habilitado, mas sem policies.

-- Policy: SELECT - usuarios podem ver apenas seus proprios tokens
CREATE POLICY "Users can view their own processing tokens"
ON public.processing_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: INSERT - usuarios podem criar tokens apenas para si mesmos
CREATE POLICY "Users can create their own processing tokens"
ON public.processing_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: UPDATE - usuarios podem atualizar apenas seus proprios tokens
CREATE POLICY "Users can update their own processing tokens"
ON public.processing_tokens
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: DELETE - usuarios podem deletar apenas seus proprios tokens
CREATE POLICY "Users can delete their own processing tokens"
ON public.processing_tokens
FOR DELETE
USING (auth.uid() = user_id);
```

---

## Configuracao de Ambiente

### Adicionar no Supabase Dashboard > Edge Functions > Secrets:

```
ADMIN_SECRET=<gerar_com_openssl_rand_base64_32>
```

Para gerar um secret seguro:
```bash
openssl rand -base64 32
```

---

## Checklist de Implementacao

- [ ] Criar `supabase/functions/_shared/auth.ts`
- [ ] Modificar `supabase/functions/_shared/env.ts` (adicionar `getAdminSecret`)
- [ ] Refatorar `supabase/functions/validate-processing/index.ts`
- [ ] Refatorar `supabase/functions/check-subscription/index.ts`
- [ ] Refatorar `supabase/functions/cleanup-tokens/index.ts`
- [ ] Refatorar `supabase/functions/health-check/index.ts`
- [ ] Refatorar `supabase/functions/process-file/index.ts`
- [ ] Refatorar `supabase/functions/create-checkout/index.ts`
- [ ] Refatorar `supabase/functions/customer-portal/index.ts`
- [ ] Criar migration RLS para `processing_tokens`
- [ ] Configurar `ADMIN_SECRET` no Supabase Dashboard
- [ ] Atualizar cron job caller para incluir `Authorization: Bearer $ADMIN_SECRET`
- [ ] Testar todas as funcoes
- [ ] Executar `supabase db push` para aplicar migration

---

## Notas Importantes

1. **NAO alterar `stripe-webhook/index.ts`** - Esta funcao LEGITIMAMENTE precisa da service role key porque recebe webhooks do Stripe sem contexto de usuario.

2. **Service role justificada em**:
   - `check-subscription`: UPDATE sincronizado com Stripe (usuario ja autenticado)
   - `create-checkout`: UPDATE sincronizado com Stripe (usuario ja autenticado)
   - `cleanup-tokens`: Job administrativo (protegido por ADMIN_SECRET)
   - `health-check`: Consulta administrativa (protegido por ADMIN_SECRET)
   - `stripe-webhook`: Webhook externo sem JWT de usuario

3. **Testar apos implementacao**:
   - Login/logout
   - Processamento de arquivo
   - Verificacao de assinatura
   - Criacao de checkout
   - Portal do cliente
   - Health check com ADMIN_SECRET
   - Cleanup tokens com ADMIN_SECRET
