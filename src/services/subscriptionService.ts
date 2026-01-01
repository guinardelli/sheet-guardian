import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { trackSubscriptionIssue } from '@/lib/error-tracker';
import { fetchWithRetry } from '@/lib/fetch-with-retry';

export type SubscriptionPlan = 'free' | 'professional' | 'premium';

const VALID_PLANS: SubscriptionPlan[] = ['free', 'professional', 'premium'];

export interface SubscriptionState {
  id: string;
  user_id?: string;
  plan: SubscriptionPlan;
  sheets_used_today: number;
  sheets_used_week: number;
  sheets_used_month: number;
  last_sheet_date: string | null;
  last_reset_date: string | null;
  payment_method: string | null;
  payment_status: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_product_id?: string | null;
  updated_at?: string;
}

export interface TokenResult {
  allowed: boolean;
  reason?: string;
  suggestUpgrade?: boolean;
  processingToken?: string;
  expiresAt?: string;
  plan?: SubscriptionPlan;
}

export interface PlanLimits {
  sheetsPerWeek: number | null;
  sheetsPerMonth: number | null;
  maxFileSizeMB: number | null;
}

export interface UsageStats {
  used: number;
  limit: number | null;
  period: string;
}

export interface CanProcessResult {
  allowed: boolean;
  reason?: string;
  suggestUpgrade?: boolean;
}

export interface OperationResult {
  success: boolean;
  error?: string;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: { sheetsPerWeek: null, sheetsPerMonth: 2, maxFileSizeMB: 1 },
  professional: { sheetsPerWeek: 5, sheetsPerMonth: null, maxFileSizeMB: 3 },
  premium: { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
};

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  free: 0,
  professional: 32,
  premium: 68,
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
const FUNCTIONS_BASE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';

const invokeFunctionWithRetry = async <T,>(
  functionName: string,
  accessToken: string,
  body?: unknown,
): Promise<{ data: T | null; error: Error | null }> => {
  if (!FUNCTIONS_BASE_URL || !SUPABASE_ANON_KEY) {
    return { data: null, error: new Error('Supabase env not configured') };
  }

  try {
    const response = await fetchWithRetry(`${FUNCTIONS_BASE_URL}/${functionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let parsed: T | null = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      if (parsed && typeof parsed === 'object') {
        const parsedRecord = parsed as Record<string, unknown>;
        if ('allowed' in parsedRecord || 'success' in parsedRecord) {
          return { data: parsed as T, error: null };
        }
      }

      const errorMessage = (parsed as { error?: string } | null)?.error ?? text ?? `HTTP ${response.status}`;
      return { data: null, error: new Error(errorMessage) };
    }

    return { data: parsed, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
};

// Helper to get local date string (YYYY-MM-DD) without timezone issues
export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get ISO week identifier (YYYY-Www) with proper year boundary handling.
 */
export const getWeekNumber = (date: Date): string => {
  // Clone date to avoid mutation
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));

  // Get first day of year
  const yearStart = new Date(d.getFullYear(), 0, 1);

  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  // Return with the year of the Thursday (handles year boundary correctly)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

type SessionAccess = { access_token?: string | null };
type UserIdentity = { id: string };

export interface SubscriptionServiceDeps {
  getUser: () => UserIdentity | null;
  getSession: () => SessionAccess | null;
  getSubscription: () => SubscriptionState | null;
  getLoading: () => boolean;
  getIsUpdating: () => boolean;
  setSubscription: (subscription: SubscriptionState | null) => void;
  setLoading: (loading: boolean) => void;
  setIsUpdating: (updating: boolean) => void;
  setIsSyncing: (syncing: boolean) => void;
  setSyncError: (error: string | null) => void;
}

export const createSubscriptionService = (deps: SubscriptionServiceDeps) => {
  let lastSyncAt: number | null = null;
  let syncInFlight: Promise<boolean> | null = null;

  const fetchSubscription = async (): Promise<SubscriptionState | null> => {
    const user = deps.getUser();
    if (!user) {
      deps.setLoading(false);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        logger.error('Erro ao buscar assinatura', error);
        toast.error('Erro ao carregar assinatura', {
          description: 'Tente recarregar a pagina.',
        });
        return null;
      }

      if (!data) {
        logger.warn('Subscription not found, attempting to create', undefined, { userId: user.id });
        trackSubscriptionIssue(user.id, 'subscription_not_found');

        let createdSubscription = false;
        let resolvedSubscription: SubscriptionState | null = null;
        const { error: rpcError } = await supabase.rpc('create_missing_subscription', {
          p_user_id: user.id,
        });

        if (rpcError) {
          logger.error('Erro ao criar assinatura via RPC', rpcError, { userId: user.id });
          trackSubscriptionIssue(user.id, 'rpc_create_subscription_failed', {
            message: rpcError.message,
          });

          const { data: insertData, error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: user.id,
              plan: 'free',
              payment_status: 'active',
              sheets_used_today: 0,
              sheets_used_week: 0,
              sheets_used_month: 0,
            })
            .select()
            .single();

          if (insertError) {
            logger.error('Erro ao criar assinatura via INSERT', insertError, { userId: user.id });
            trackSubscriptionIssue(user.id, 'insert_subscription_failed', {
              message: insertError.message,
            });
            toast.error('Erro ao criar assinatura', {
              description: 'Nao foi possivel criar sua assinatura. Entre em contato com o suporte.',
            });
            return null;
          }

          if (insertData) {
            createdSubscription = true;
            resolvedSubscription = insertData as SubscriptionState;
            deps.setSubscription(insertData as SubscriptionState);
          }
        } else {
          createdSubscription = true;
          const { data: retryData, error: retryError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (retryError) {
            logger.error('Erro ao buscar assinatura apos criacao', retryError, { userId: user.id });
            trackSubscriptionIssue(user.id, 'subscription_retry_failed', {
              message: retryError.message,
            });
          } else if (retryData) {
            deps.setSubscription(retryData as SubscriptionState);
            resolvedSubscription = retryData as SubscriptionState;
            logger.info('Subscription created successfully', undefined, { userId: user.id });
          }
        }

        if (createdSubscription && resolvedSubscription) {
          toast.success('Assinatura criada com sucesso!');
        }

        return resolvedSubscription;
      }

      deps.setSubscription(data as SubscriptionState);
      return data as SubscriptionState;
    } catch (err) {
      logger.error('Erro inesperado ao buscar assinatura', err);
      toast.error('Erro ao carregar assinatura', {
        description: 'Ocorreu um erro inesperado. Tente recarregar a pagina.',
      });
      return null;
    } finally {
      deps.setLoading(false);
    }
  };

  const getUsageStats = (): UsageStats | null => {
    const subscription = deps.getSubscription();
    if (!subscription) return null;

    const limits = PLAN_LIMITS[subscription.plan];
    const today = new Date();
    const todayStr = getLocalDateString(today);
    const currentWeek = getWeekNumber(today);
    const currentMonth = todayStr.substring(0, 7);

    let used = 0;
    let limit: number | null = null;
    let period = '';

    if (limits.sheetsPerMonth !== null) {
      const lastResetMonth = subscription.last_reset_date
        ? subscription.last_reset_date.substring(0, 7)
        : null;
      used = lastResetMonth === currentMonth ? subscription.sheets_used_month : 0;
      limit = limits.sheetsPerMonth;
      period = 'mês';
    } else if (limits.sheetsPerWeek !== null) {
      const lastDate = subscription.last_sheet_date
        ? new Date(subscription.last_sheet_date + 'T00:00:00')
        : null;
      const lastWeek = lastDate ? getWeekNumber(lastDate) : '';
      used = lastWeek === currentWeek ? (subscription.sheets_used_week ?? 0) : 0;
      limit = limits.sheetsPerWeek;
      period = 'semana';
    }

    return { used, limit, period };
  };

  const canProcess = (fileSizeKB: number): CanProcessResult => {
    if (deps.getLoading()) {
      return { allowed: false, reason: 'Carregando informações da assinatura...', suggestUpgrade: false };
    }
    const subscription = deps.getSubscription();
    if (!subscription) {
      return {
        allowed: false,
        reason: 'Não foi possível carregar sua assinatura. Tente recarregar a página.',
        suggestUpgrade: false,
      };
    }
    if (deps.getIsUpdating()) {
      return { allowed: false, reason: 'Atualizando uso, aguarde...', suggestUpgrade: false };
    }

    const limits = PLAN_LIMITS[subscription.plan];
    const fileSizeMB = fileSizeKB / 1024;

    if (limits.maxFileSizeMB && fileSizeMB > limits.maxFileSizeMB) {
      return {
        allowed: false,
        reason: `Arquivo muito grande (${fileSizeMB.toFixed(1)} MB). Limite do seu plano: ${limits.maxFileSizeMB} MB. Faça upgrade para processar arquivos maiores.`,
        suggestUpgrade: true,
      };
    }

    const today = new Date();
    const todayStr = getLocalDateString(today);
    const currentWeek = getWeekNumber(today);

    if (limits.sheetsPerWeek !== null) {
      const lastDate = subscription.last_sheet_date
        ? new Date(subscription.last_sheet_date + 'T00:00:00')
        : null;
      const lastWeek = lastDate ? getWeekNumber(lastDate) : '';
      const usedThisWeek = lastWeek === currentWeek ? (subscription.sheets_used_week ?? 0) : 0;

      if (usedThisWeek >= limits.sheetsPerWeek) {
        return {
          allowed: false,
          reason: `Limite semanal atingido (${usedThisWeek}/${limits.sheetsPerWeek}). Faça upgrade para mais processamentos.`,
          suggestUpgrade: true,
        };
      }
    }

    if (limits.sheetsPerMonth !== null) {
      const currentMonth = todayStr.substring(0, 7);
      const lastResetMonth = subscription.last_reset_date
        ? subscription.last_reset_date.substring(0, 7)
        : null;
      const usedMonth = lastResetMonth === currentMonth ? subscription.sheets_used_month : 0;

      if (usedMonth >= limits.sheetsPerMonth) {
        return {
          allowed: false,
          reason: `Limite mensal atingido (${usedMonth}/${limits.sheetsPerMonth}). Faça upgrade para mais processamentos.`,
          suggestUpgrade: true,
        };
      }
    }

    return { allowed: true };
  };

  const getToken = async (file: File): Promise<TokenResult> => {
    const session = deps.getSession();
    if (!session?.access_token) {
      return { allowed: false, reason: 'Sessao expirada. Faca login novamente.' };
    }

    try {
      const { data, error } = await invokeFunctionWithRetry<TokenResult>(
        'validate-processing',
        session.access_token,
        {
          action: 'validate',
          file: {
            name: file.name,
            sizeBytes: file.size,
            mimeType: file.type || null,
          },
        },
      );

      if (error) {
        logger.error('Erro ao validar processamento', error);
        return { allowed: false, reason: 'Nao foi possivel validar o processamento agora.' };
      }

      if (!data) {
        return { allowed: false, reason: 'Nao foi possivel validar o processamento agora.' };
      }

      return data as TokenResult;
    } catch (err) {
      logger.error('Erro inesperado ao validar processamento', err);
      return { allowed: false, reason: 'Nao foi possivel validar o processamento agora.' };
    }
  };

  const incrementUsage = async (processingToken?: string): Promise<OperationResult> => {
    const user = deps.getUser();
    const subscription = deps.getSubscription();
    const session = deps.getSession();

    if (!user || !subscription) {
      return { success: false, error: 'Usuário ou assinatura não encontrados' };
    }
    if (!processingToken) {
      return { success: false, error: 'Token de processamento ausente' };
    }
    if (!session?.access_token) {
      return { success: false, error: 'Sessao expirada. Faca login novamente.' };
    }

    deps.setIsUpdating(true);
    try {
      const { data, error } = await invokeFunctionWithRetry<{ success?: boolean; error?: string }>(
        'validate-processing',
        session.access_token,
        {
          action: 'consume',
          processingToken,
        },
      );

      if (error) {
        logger.error('Erro ao registrar uso', error);
        return { success: false, error: 'Erro ao registrar uso. Tente novamente.' };
      }

      if (!data?.success) {
        return { success: false, error: data?.error ?? 'Erro ao registrar uso.' };
      }

      await fetchSubscription();
      return { success: true };
    } catch (err) {
      logger.error('Erro inesperado ao registrar uso', err);
      return { success: false, error: 'Erro inesperado ao registrar uso.' };
    } finally {
      deps.setIsUpdating(false);
    }
  };

  const changePlan = async (newPlan: SubscriptionPlan): Promise<OperationResult> => {
    const user = deps.getUser();
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    if (!VALID_PLANS.includes(newPlan)) {
      logger.error('Plano inválido', undefined, { plan: newPlan });
      return { success: false, error: 'Plano inválido' };
    }

    try {
      const subscription = deps.getSubscription();
      const shouldResetUsage = subscription?.plan === 'free' && newPlan !== 'free';
      const updates = {
        plan: newPlan,
        payment_status: newPlan === 'free' ? 'active' : 'pending',
        ...(shouldResetUsage
          ? {
              sheets_used_today: 0,
              sheets_used_week: 0,
              last_sheet_date: null,
            }
          : {}),
      };

      const { error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        logger.error('Erro ao atualizar plano', error);
        return { success: false, error: 'Erro ao atualizar plano. Tente novamente.' };
      }

      await fetchSubscription();
      return { success: true };
    } catch (err) {
      logger.error('Erro inesperado ao atualizar plano', err);
      return { success: false, error: 'Erro inesperado ao atualizar plano.' };
    }
  };

  const syncSubscription = async (force = false): Promise<boolean> => {
    const user = deps.getUser();
    const session = deps.getSession();

    if (!user || !session?.access_token) {
      return false;
    }

    const now = Date.now();
    if (!force && lastSyncAt && now - lastSyncAt < 30000) {
      return false;
    }

    if (syncInFlight) {
      return syncInFlight;
    }

    deps.setIsSyncing(true);
    deps.setSyncError(null);

    syncInFlight = (async () => {
      try {
        const { data, error } = await invokeFunctionWithRetry<{ subscribed?: boolean }>(
          'check-subscription',
          session.access_token,
        );

        if (error) {
          logger.error('Erro ao sincronizar assinatura', error);
          deps.setSyncError('Nao foi possivel sincronizar a assinatura agora.');
          return false;
        }

        await fetchSubscription();
        return Boolean(data?.subscribed);
      } catch (err) {
        logger.error('Erro inesperado ao sincronizar assinatura', err);
        deps.setSyncError('Nao foi possivel sincronizar a assinatura agora.');
        return false;
      } finally {
        deps.setIsSyncing(false);
        lastSyncAt = Date.now();
      }
    })();

    try {
      return await syncInFlight;
    } finally {
      syncInFlight = null;
    }
  };

  return {
    fetchSubscription,
    getUsageStats,
    canProcess,
    getToken,
    incrementUsage,
    changePlan,
    syncSubscription,
  };
};

export type SubscriptionService = ReturnType<typeof createSubscriptionService>;
