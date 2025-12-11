import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type SubscriptionPlan = 'free' | 'professional' | 'premium';

const VALID_PLANS: SubscriptionPlan[] = ['free', 'professional', 'premium'];

interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  sheets_used_today: number;
  sheets_used_month: number;
  last_sheet_date: string | null;
  last_reset_date: string | null;
  payment_method: string | null;
  payment_status: string | null;
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
const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get ISO week number with proper year boundary handling
const getWeekNumber = (date: Date): string => {
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
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const updateLockRef = useRef(false); // Prevent race conditions

  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user]);

  const fetchSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar assinatura:', error);
      } else if (data) {
        setSubscription(data as Subscription);
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar assinatura:', err);
    } finally {
      setLoading(false);
    }
  };

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
      used = lastWeek === currentWeek ? subscription.sheets_used_today : 0;
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
      const usedThisWeek = lastWeek === currentWeek ? subscription.sheets_used_today : 0;

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
      const lastResetMonth = subscription.last_reset_date
        ? subscription.last_reset_date.substring(0, 7)
        : null;
      const isToday = subscription.last_sheet_date === today;

      const newSheetsToday = isToday ? subscription.sheets_used_today + 1 : 1;
      const newSheetsMonth = lastResetMonth === currentMonth
        ? subscription.sheets_used_month + 1
        : 1;

      const { error } = await supabase
        .from('subscriptions')
        .update({
          sheets_used_today: newSheetsToday,
          sheets_used_month: newSheetsMonth,
          last_sheet_date: today,
          last_reset_date: lastResetMonth === currentMonth ? subscription.last_reset_date : today,
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao incrementar uso:', error);
        return { success: false, error: 'Erro ao atualizar uso. Tente novamente.' };
      }

      await fetchSubscription();
      return { success: true };
    } catch (err) {
      console.error('Erro inesperado ao incrementar uso:', err);
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
      console.error('Plano inválido:', newPlan);
      return { success: false, error: 'Plano inválido' };
    }

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ plan: newPlan, payment_status: newPlan === 'free' ? 'active' : 'pending' })
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao atualizar plano:', error);
        return { success: false, error: 'Erro ao atualizar plano. Tente novamente.' };
      }

      await fetchSubscription();
      return { success: true };
    } catch (err) {
      console.error('Erro inesperado ao atualizar plano:', err);
      return { success: false, error: 'Erro inesperado ao atualizar plano.' };
    }
  };

  return {
    subscription,
    loading,
    isUpdating,
    canProcessSheet,
    incrementUsage,
    updatePlan,
    getUsageStats,
    refetch: fetchSubscription,
  };
};
