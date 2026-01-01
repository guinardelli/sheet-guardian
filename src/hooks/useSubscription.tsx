import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  createSubscriptionService,
  type CanProcessResult,
  type OperationResult,
  type SubscriptionPlan,
  type SubscriptionService,
  type SubscriptionState,
  type TokenResult,
  type UsageStats,
} from '@/services/subscriptionService';
import type { AsyncState } from '@/lib/types/async';

export {
  PLAN_LIMITS,
  PLAN_PRICES,
  getLocalDateString,
  getWeekNumber,
} from '@/services/subscriptionService';
export type {
  SubscriptionPlan,
  SubscriptionResponse,
  SubscriptionState,
  TokenConsumeResponse,
  TokenResponse,
  TokenResult,
} from '@/services/subscriptionService';

type SubscriptionAsyncState = AsyncState<SubscriptionState | null>;

export interface SubscriptionHook {
  subscription: SubscriptionState | null;
  loading: boolean;
  isUpdating: boolean;
  isSyncing: boolean;
  syncError: string | null;
  subscriptionState: SubscriptionAsyncState;
  canProcessSheet: (fileSizeKB: number) => CanProcessResult;
  requestProcessingToken: (file: File) => Promise<TokenResult>;
  incrementUsage: (processingToken?: string) => Promise<OperationResult>;
  updatePlan: (newPlan: SubscriptionPlan) => Promise<OperationResult>;
  getUsageStats: () => UsageStats | null;
  syncSubscription: (force?: boolean) => Promise<boolean>;
  refetch: () => Promise<SubscriptionState | null>;
}

export const useSubscription = (): SubscriptionHook => {
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

  const subscriptionState: SubscriptionAsyncState = loading
    ? { status: 'loading' }
    : syncError
    ? { status: 'error', error: syncError }
    : { status: 'success', data: subscription };

  return {
    subscription,
    loading,
    isUpdating,
    isSyncing,
    syncError,
    subscriptionState,
    canProcessSheet,
    requestProcessingToken,
    incrementUsage,
    updatePlan,
    getUsageStats,
    syncSubscription,
    refetch: fetchSubscription,
  };
};

