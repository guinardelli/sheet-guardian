import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type SubscriptionPlan = 'free' | 'professional' | 'premium';

interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  sheets_used_today: number;
  sheets_used_month: number;
  last_sheet_date: string | null;
  last_reset_date: string | null;
  payment_method: string | null;
  payment_status: string | null;
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

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

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
    
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setSubscription(data as Subscription);
    }
    setLoading(false);
  };

  const getWeekNumber = (date: Date): string => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
  };

  const canProcessSheet = (fileSizeKB: number): { allowed: boolean; reason?: string } => {
    if (!subscription) {
      return { allowed: false, reason: 'Você precisa estar logado para processar planilhas.' };
    }

    const limits = PLAN_LIMITS[subscription.plan];
    const fileSizeMB = fileSizeKB / 1024;

    // Check file size limit
    if (limits.maxFileSizeMB && fileSizeMB > limits.maxFileSizeMB) {
      return { 
        allowed: false, 
        reason: `Arquivo muito grande. Limite do seu plano: ${limits.maxFileSizeMB} MB` 
      };
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentWeek = getWeekNumber(today);

    // Check weekly limit
    if (limits.sheetsPerWeek !== null && subscription.last_sheet_date) {
      const lastDate = new Date(subscription.last_sheet_date);
      const lastWeek = getWeekNumber(lastDate);
      const usedThisWeek = lastWeek === currentWeek ? subscription.sheets_used_today : 0;
      
      if (usedThisWeek >= limits.sheetsPerWeek) {
        return { 
          allowed: false, 
          reason: `Limite semanal atingido (${limits.sheetsPerWeek} arquivos/semana)` 
        };
      }
    }

    // Check monthly limit
    if (limits.sheetsPerMonth !== null) {
      const currentMonth = todayStr.substring(0, 7);
      const lastResetMonth = subscription.last_reset_date?.substring(0, 7);
      const usedMonth = lastResetMonth === currentMonth ? subscription.sheets_used_month : 0;
      
      if (usedMonth >= limits.sheetsPerMonth) {
        return { 
          allowed: false, 
          reason: `Limite mensal atingido (${limits.sheetsPerMonth} processamento/mês)` 
        };
      }
    }

    return { allowed: true };
  };

  const incrementUsage = async () => {
    if (!user || !subscription) return;

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);
    const lastResetMonth = subscription.last_reset_date?.substring(0, 7);
    const isToday = subscription.last_sheet_date === today;

    const newSheetsToday = isToday ? subscription.sheets_used_today + 1 : 1;
    const newSheetsMonth = lastResetMonth === currentMonth 
      ? subscription.sheets_used_month + 1 
      : 1;

    await supabase
      .from('subscriptions')
      .update({
        sheets_used_today: newSheetsToday,
        sheets_used_month: newSheetsMonth,
        last_sheet_date: today,
        last_reset_date: lastResetMonth === currentMonth ? subscription.last_reset_date : today,
      })
      .eq('user_id', user.id);

    await fetchSubscription();
  };

  const updatePlan = async (newPlan: SubscriptionPlan) => {
    if (!user) return;

    await supabase
      .from('subscriptions')
      .update({ plan: newPlan, payment_status: newPlan === 'free' ? 'active' : 'pending' })
      .eq('user_id', user.id);

    await fetchSubscription();
  };

  return {
    subscription,
    loading,
    canProcessSheet,
    incrementUsage,
    updatePlan,
    refetch: fetchSubscription,
  };
};
