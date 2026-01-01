export type SubscriptionPlan = 'free' | 'professional' | 'premium' | 'anual';

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
