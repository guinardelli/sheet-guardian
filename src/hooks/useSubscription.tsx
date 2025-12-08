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
  sheetsPerDay: number | null;
  sheetsPerMonth: number | null;
  maxFileSizeKB: number | null;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: { sheetsPerDay: null, sheetsPerMonth: 1, maxFileSizeKB: 100 },
  professional: { sheetsPerDay: 5, sheetsPerMonth: null, maxFileSizeKB: 1000 },
  premium: { sheetsPerDay: null, sheetsPerMonth: null, maxFileSizeKB: null },
};

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  free: 0,
  professional: 23,
  premium: 30,
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

  const canProcessSheet = (fileSizeKB: number): { allowed: boolean; reason?: string } => {
    if (!subscription) {
      return { allowed: false, reason: 'Você precisa estar logado para processar planilhas.' };
    }

    const limits = PLAN_LIMITS[subscription.plan];

    // Check file size limit
    if (limits.maxFileSizeKB && fileSizeKB > limits.maxFileSizeKB) {
      return { 
        allowed: false, 
        reason: `Arquivo muito grande. Limite do seu plano: ${limits.maxFileSizeKB} KB` 
      };
    }

    const today = new Date().toISOString().split('T')[0];

    // Check daily limit
    if (limits.sheetsPerDay !== null) {
      const isToday = subscription.last_sheet_date === today;
      const usedToday = isToday ? subscription.sheets_used_today : 0;
      
      if (usedToday >= limits.sheetsPerDay) {
        return { 
          allowed: false, 
          reason: `Limite diário atingido (${limits.sheetsPerDay} planilhas/dia)` 
        };
      }
    }

    // Check monthly limit
    if (limits.sheetsPerMonth !== null) {
      const currentMonth = today.substring(0, 7);
      const lastResetMonth = subscription.last_reset_date?.substring(0, 7);
      const usedMonth = lastResetMonth === currentMonth ? subscription.sheets_used_month : 0;
      
      if (usedMonth >= limits.sheetsPerMonth) {
        return { 
          allowed: false, 
          reason: `Limite mensal atingido (${limits.sheetsPerMonth} planilha/mês)` 
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
