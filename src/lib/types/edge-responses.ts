import type { SubscriptionPlan } from '@/lib/types/subscription';

export interface ErrorResponse {
  error: string;
  errorCode?: string;
  details?: string;
  requestId: string;
}

type ResponseWithRequestId<T> = T & { requestId: string };

export type TokenResponse = ResponseWithRequestId<
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
    }
>;

export type TokenConsumeResponse = ResponseWithRequestId<
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
      errorCode?: string;
    }
>;

export type SubscriptionResponse = ResponseWithRequestId<
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
    }
>;

export type CheckoutResponse = ResponseWithRequestId<{ url: string } | ErrorResponse>;
export type CustomerPortalResponse = ResponseWithRequestId<{ url: string } | ErrorResponse>;

export type ProcessFileResponse = ResponseWithRequestId<
  | {
      success: true;
      fileBase64: string;
      originalFileName: string;
      newFileName: string;
      vbaExists: boolean;
      patternsModified: number;
      shouldCountUsage: boolean;
      originalSize: number;
      modifiedSize: number;
      warnings?: string[];
      mimeType: string;
      watermarkId?: string;
    }
  | {
      success: false;
      error: string;
      errorCode?: string;
    }
>;

