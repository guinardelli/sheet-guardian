import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { logger } from '@/lib/logger';
import { trackSubscriptionIssue } from '@/lib/error-tracker';

export type SubscriptionPlan = 'free' | 'professional' | 'premium';

const VALID_PLANS: SubscriptionPlan[] = ['free', 'professional', 'premium'];

interface Subscription {
  id: string;
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
  updated_at?: string; // For optimistic locking
}

interface PlanLimits {
  sheetsPerWeek: number | null;
  sheetsPerMonth: number | null;
  maxFileSizeMB: number | null;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: { sheetsPerWeek: null, sheetsPerMonth: 1, maxFileSizeMB: 1 },
  professional: { sheetsPerWeek: 5, sheetsPerMonth: null, maxFileSizeMB: 1 },
  premium: { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
};

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  free: 0,
  professional: 32,
  premium: 38,
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

export const useSubscription = () => {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const updateLockRef = useRef(false); // Prevent race conditions
  const syncLockRef = useRef(false);
  const lastSyncAtRef = useRef<number | null>(null);

  const fetchSubscription = useCallback(async (): Promise<Subscription | null> => {
    if (!user) {
      setLoading(false);
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
      } else if (!data) {
        logger.warn('Subscription not found, attempting to create', undefined, { userId: user.id });
        trackSubscriptionIssue(user.id, 'subscription_not_found');

        let createdSubscription = false;
        let resolvedSubscription: Subscription | null = null;
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
            resolvedSubscription = insertData as Subscription;
            setSubscription(insertData as Subscription);
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
            setSubscription(retryData as Subscription);
            resolvedSubscription = retryData as Subscription;
            logger.info('Subscription created successfully', undefined, { userId: user.id });
          }
        }

        if (createdSubscription && resolvedSubscription) {
          toast.success('Assinatura criada com sucesso!');
        }

        return resolvedSubscription;
      } else {
        setSubscription(data as Subscription);
        return data as Subscription;
      }
    } catch (err) {
      logger.error('Erro inesperado ao buscar assinatura', err);
      toast.error('Erro ao carregar assinatura', {
        description: 'Ocorreu um erro inesperado. Tente recarregar a pagina.',
      });
      return null;
    } finally {
      setLoading(false);
    }
    return null;
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user, fetchSubscription]);

  const syncSubscription = useCallback(
    async (force = false): Promise<boolean> => {
      if (!user || !session?.access_token) {
        return false;
      }

      if (syncLockRef.current) {
        return false;
      }

      const now = Date.now();
      if (!force && lastSyncAtRef.current && now - lastSyncAtRef.current < 30000) {
        return false;
      }

      syncLockRef.current = true;
      setIsSyncing(true);
      setSyncError(null);

      try {
        const { data, error } = await supabase.functions.invoke('check-subscription', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) {
          logger.error('Erro ao sincronizar assinatura', error);
          setSyncError('Nao foi possivel sincronizar a assinatura agora.');
          return false;
        }

        await fetchSubscription();
        return Boolean(data?.subscribed);
      } catch (err) {
        logger.error('Erro inesperado ao sincronizar assinatura', err);
        setSyncError('Nao foi possivel sincronizar a assinatura agora.');
        return false;
      } finally {
        syncLockRef.current = false;
        lastSyncAtRef.current = Date.now();
        setIsSyncing(false);
      }
    },
    [user, session?.access_token, fetchSubscription],
  );

  useEffect(() => {
    if (!subscription || !session?.access_token) {
      return;
    }

    const hasStripeContext = Boolean(
      subscription.stripe_customer_id || subscription.stripe_subscription_id || subscription.stripe_product_id,
    );

    if (!hasStripeContext && subscription.plan === 'free') {
      return;
    }

    if (!lastSyncAtRef.current) {
      syncSubscription();
    }
  }, [
    subscription,
    session?.access_token,
    syncSubscription,
  ]);

  const getUsageStats = () => {
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
      // Safely handle null/undefined last_reset_date
      const lastResetMonth = subscription.last_reset_date
        ? subscription.last_reset_date.substring(0, 7)
        : null;
      used = lastResetMonth === currentMonth ? subscription.sheets_used_month : 0;
      limit = limits.sheetsPerMonth;
      period = 'mês';
    } else if (limits.sheetsPerWeek !== null) {
      const lastDate = subscription.last_sheet_date
        ? new Date(subscription.last_sheet_date + 'T00:00:00') // Parse as local date
        : null;
      const lastWeek = lastDate ? getWeekNumber(lastDate) : '';
      used = lastWeek === currentWeek ? (subscription.sheets_used_week ?? 0) : 0;
      limit = limits.sheetsPerWeek;
      period = 'semana';
    }

    return { used, limit, period };
  };

  const canProcessSheet = (fileSizeKB: number): { allowed: boolean; reason?: string; suggestUpgrade?: boolean } => {
    if (loading) {
      return { allowed: false, reason: 'Carregando informações da assinatura...', suggestUpgrade: false };
    }
    if (!subscription) {
      return { allowed: false, reason: 'Não foi possível carregar sua assinatura. Tente recarregar a página.', suggestUpgrade: false };
    }
    if (isUpdating) {
      return { allowed: false, reason: 'Atualizando uso, aguarde...', suggestUpgrade: false };
    }

    const limits = PLAN_LIMITS[subscription.plan];
    const fileSizeMB = fileSizeKB / 1024;

    // Check file size limit
    if (limits.maxFileSizeMB && fileSizeMB > limits.maxFileSizeMB) {
      return {
        allowed: false,
        reason: `Arquivo muito grande (${fileSizeMB.toFixed(1)} MB). Limite do seu plano: ${limits.maxFileSizeMB} MB. Faça upgrade para processar arquivos maiores.`,
        suggestUpgrade: true
      };
    }

    const today = new Date();
    const todayStr = getLocalDateString(today);
    const currentWeek = getWeekNumber(today);

    // Check weekly limit
    if (limits.sheetsPerWeek !== null) {
      const lastDate = subscription.last_sheet_date
        ? new Date(subscription.last_sheet_date + 'T00:00:00') // Parse as local date
        : null;
      const lastWeek = lastDate ? getWeekNumber(lastDate) : '';
      const usedThisWeek = lastWeek === currentWeek ? (subscription.sheets_used_week ?? 0) : 0;

      if (usedThisWeek >= limits.sheetsPerWeek) {
        return {
          allowed: false,
          reason: `Limite semanal atingido (${usedThisWeek}/${limits.sheetsPerWeek}). Faça upgrade para mais processamentos.`,
          suggestUpgrade: true
        };
      }
    }

    // Check monthly limit
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
          suggestUpgrade: true
        };
      }
    }

    return { allowed: true };
  };

  const incrementUsage = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user || !subscription) {
      return { success: false, error: 'Usuário ou assinatura não encontrados' };
    }

    // Prevent race conditions with lock
    if (updateLockRef.current) {
      return { success: false, error: 'Atualização em andamento' };
    }

    updateLockRef.current = true;
    setIsUpdating(true);

    try {
      const today = getLocalDateString();
      const currentMonth = today.substring(0, 7);
      const currentWeek = getWeekNumber(new Date());
      const lastDate = subscription.last_sheet_date
        ? new Date(subscription.last_sheet_date + 'T00:00:00')
        : null;
      const lastWeek = lastDate ? getWeekNumber(lastDate) : '';
      const lastResetMonth = subscription.last_reset_date
        ? subscription.last_reset_date.substring(0, 7)
        : null;
      const isToday = subscription.last_sheet_date === today;

      const newSheetsToday = isToday ? subscription.sheets_used_today + 1 : 1;
      const newSheetsWeek = lastWeek === currentWeek ? (subscription.sheets_used_week ?? 0) + 1 : 1;
      const newSheetsMonth = lastResetMonth === currentMonth
        ? subscription.sheets_used_month + 1
        : 1;

      const { error } = await supabase
        .from('subscriptions')
        .update({
          sheets_used_today: newSheetsToday,
          sheets_used_week: newSheetsWeek,
          sheets_used_month: newSheetsMonth,
          last_sheet_date: today,
          last_reset_date: lastResetMonth === currentMonth ? subscription.last_reset_date : today,
        })
        .eq('user_id', user.id);

      if (error) {
        logger.error('Erro ao incrementar uso', error);
        return { success: false, error: 'Erro ao atualizar uso. Tente novamente.' };
      }

      await fetchSubscription();
      return { success: true };
    } catch (err) {
      logger.error('Erro inesperado ao incrementar uso', err);
      return { success: false, error: 'Erro inesperado ao atualizar uso.' };
    } finally {
      updateLockRef.current = false;
      setIsUpdating(false);
    }
  };

  const updatePlan = async (newPlan: SubscriptionPlan): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    // Validate plan
    if (!VALID_PLANS.includes(newPlan)) {
      logger.error('Plano inválido', undefined, { plan: newPlan });
      return { success: false, error: 'Plano inválido' };
    }

    try {
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

  return {
    subscription,
    loading,
    isUpdating,
    isSyncing,
    syncError,
    canProcessSheet,
    incrementUsage,
    updatePlan,
    getUsageStats,
    syncSubscription,
    refetch: fetchSubscription,
  };
};
