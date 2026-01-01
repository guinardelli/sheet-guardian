import type { SubscriptionPlan } from '@/types/subscription';

export interface ErrorResponse {
  error: string;
  errorCode?: string;
  details?: string;
}

export type TokenResponse =
  | {
      allowed: true;
      processingToken: string;
      expiresAt: string;
      plan: SubscriptionPlan;
    }
  | {
      allowed: false;
      reason: string;
      suggestUpgrade?: boolean;
      errorCode?: string;
    };

export type TokenConsumeResponse =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
      errorCode?: string;
    };

export type SubscriptionResponse =
  | {
      subscribed: boolean;
      plan: SubscriptionPlan;
      product_id: string | null;
      subscription_end: string | null;
      cancel_at_period_end: boolean;
    }
  | {
      subscribed: false;
      error: string;
      details?: string;
    };

export type CheckoutResponse = { url: string } | ErrorResponse;
export type CustomerPortalResponse = { url: string } | ErrorResponse;
