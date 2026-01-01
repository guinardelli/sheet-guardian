import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  createSubscriptionService,
  type SubscriptionPlan,
  type SubscriptionState,
  type SubscriptionService,
} from '@/services/subscriptionService';

export {
  PLAN_LIMITS,
  PLAN_PRICES,
  getLocalDateString,
  getWeekNumber,
} from '@/services/subscriptionService';
export type { SubscriptionPlan, SubscriptionState, TokenResult } from '@/services/subscriptionService';

export const useSubscription = () => {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const userRef = useRef(user);
  const sessionRef = useRef(session);
  const subscriptionRef = useRef<SubscriptionState | null>(null);
  const loadingRef = useRef(loading);
  const isUpdatingRef = useRef(isUpdating);

  userRef.current = user;
  sessionRef.current = session;
  subscriptionRef.current = subscription;
  loadingRef.current = loading;
  isUpdatingRef.current = isUpdating;

  const serviceRef = useRef<SubscriptionService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = createSubscriptionService({
      getUser: () => userRef.current,
      getSession: () => sessionRef.current,
      getSubscription: () => subscriptionRef.current,
      getLoading: () => loadingRef.current,
      getIsUpdating: () => isUpdatingRef.current,
      setSubscription,
      setLoading,
      setIsUpdating,
      setIsSyncing,
      setSyncError,
    });
  }

  const subscriptionService = serviceRef.current!;

  const fetchSubscription = useCallback(async (): Promise<SubscriptionState | null> => {
    return subscriptionService.fetchSubscription();
  }, [subscriptionService]);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user, fetchSubscription]);

  const syncSubscription = useCallback(
    async (force = false): Promise<boolean> => subscriptionService.syncSubscription(force),
    [subscriptionService],
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

    syncSubscription();
  }, [subscription, session?.access_token, syncSubscription]);

  const canProcessSheet = useCallback(
    (fileSizeKB: number) => subscriptionService.canProcess(fileSizeKB),
    [subscriptionService],
  );

  const requestProcessingToken = useCallback(
    (file: File) => subscriptionService.getToken(file),
    [subscriptionService],
  );

  const incrementUsage = useCallback(
    (processingToken?: string) => subscriptionService.incrementUsage(processingToken),
    [subscriptionService],
  );

  const updatePlan = useCallback(
    (newPlan: SubscriptionPlan) => subscriptionService.changePlan(newPlan),
    [subscriptionService],
  );

  const getUsageStats = useCallback(
    () => subscriptionService.getUsageStats(),
    [subscriptionService],
  );

  return {
    subscription,
    loading,
    isUpdating,
    isSyncing,
    syncError,
    canProcessSheet,
    requestProcessingToken,
    incrementUsage,
    updatePlan,
    getUsageStats,
    syncSubscription,
    refetch: fetchSubscription,
  };
};
