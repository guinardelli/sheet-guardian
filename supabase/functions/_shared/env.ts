type EnvGetter = {
  get: (key: string) => string | undefined;
};

const readEnvValue = (env: EnvGetter, key: string) => {
  const value = env.get(key);
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getRequiredEnv = (key: string, env: EnvGetter, fallbacks: string[] = []): string => {
  const keys = [key, ...fallbacks];
  for (const envKey of keys) {
    const value = readEnvValue(env, envKey);
    if (value) {
      return value;
    }
  }
  const fallbackSuffix = fallbacks.length > 0 ? ` (or ${fallbacks.join(", ")})` : "";
  throw new Error(`Missing required environment variable: ${key}${fallbackSuffix}`);
};

const defaultEnv: EnvGetter = Deno.env;

export const getSupabaseUrl = (env: EnvGetter = defaultEnv) =>
  getRequiredEnv("SUPABASE_URL", env);

export const getServiceRoleKey = (env: EnvGetter = defaultEnv) =>
  getRequiredEnv("SERVICE_ROLE_KEY", env, ["SUPABASE_SERVICE_ROLE_KEY"]);

export const getSupabaseAnonKey = (env: EnvGetter = defaultEnv) =>
  getRequiredEnv("SUPABASE_ANON_KEY", env);

export const getStripeSecretKey = (env: EnvGetter = defaultEnv) =>
  getRequiredEnv("STRIPE_SECRET_KEY", env);

export const getStripeWebhookSecret = (env: EnvGetter = defaultEnv) =>
  getRequiredEnv("STRIPE_WEBHOOK_SECRET", env);

export type { EnvGetter };
