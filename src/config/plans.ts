import type { SubscriptionPlan } from '@/lib/types/subscription';

// ========== Interfaces ==========
export interface PlanLimits {
  sheetsPerWeek: number | null;
  sheetsPerMonth: number | null;
  maxFileSizeMB: number | null;
}

export interface PlanPricing {
  current: number;
  original: number | null;
  period: 'month' | 'year';
}

export interface PlanStripeIds {
  productId: string;
  priceId: string;
}

export interface PlanI18nKeys {
  nameKey: string;
  descriptionKey: string;
  featureKeys: string[];
  extraKeys: string[];
}

export interface PlanConfig {
  id: SubscriptionPlan;
  order: number;
  limits: PlanLimits;
  pricing: PlanPricing;
  stripe: PlanStripeIds | null;
  recommended?: boolean;
  i18n: PlanI18nKeys;
}

// ========== ENV Vars (Stripe IDs) ==========
const normalizeEnvValue = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const getStripeEnv = () => ({
  professional: {
    productId: normalizeEnvValue(import.meta.env.VITE_STRIPE_PROFESSIONAL_PRODUCT_ID) ?? 'prod_TaJslOsZAWnhcN',
    priceId: normalizeEnvValue(import.meta.env.VITE_STRIPE_PROFESSIONAL_PRICE_ID) ?? 'price_1Sd9EhJkxX3Me4wlrU22rZwM',
  },
  premium: {
    productId: normalizeEnvValue(import.meta.env.VITE_STRIPE_PREMIUM_PRODUCT_ID) ?? 'prod_TaJsysi99Q1g2J',
    priceId: normalizeEnvValue(import.meta.env.VITE_STRIPE_PREMIUM_PRICE_ID) ?? 'price_1Sd9F5JkxX3Me4wl1xNRb5Kh',
  },
  anual: {
    productId: normalizeEnvValue(import.meta.env.VITE_STRIPE_PREMIUM_PRODUCT_ID) ?? 'prod_TaJsysi99Q1g2J',
    priceId: normalizeEnvValue(import.meta.env.VITE_STRIPE_ANNUAL_PRICE_ID) ?? 'price_1SkkH3JkxX3Me4wlLuYefRSD',
  },
});

// ========== Configuracao Principal ==========
export const PLANS_CONFIG: Record<SubscriptionPlan, PlanConfig> = {
  free: {
    id: 'free',
    order: 0,
    limits: { sheetsPerWeek: null, sheetsPerMonth: 2, maxFileSizeMB: 1 },
    pricing: { current: 0, original: null, period: 'month' },
    stripe: null,
    i18n: {
      nameKey: 'plansPage.freeInfo.name',
      descriptionKey: 'plansPage.freeInfo.description',
      featureKeys: ['plansPage.freeInfo.feature1', 'plansPage.freeInfo.feature2'],
      extraKeys: [],
    },
  },
  professional: {
    id: 'professional',
    order: 1,
    limits: { sheetsPerWeek: 5, sheetsPerMonth: null, maxFileSizeMB: 3 },
    pricing: { current: 32, original: 38, period: 'month' },
    stripe: getStripeEnv().professional,
    i18n: {
      nameKey: 'plansPage.professionalInfo.name',
      descriptionKey: 'plansPage.professionalInfo.description',
      featureKeys: ['plansPage.professionalInfo.feature1', 'plansPage.professionalInfo.feature2'],
      extraKeys: ['plansPage.professionalInfo.extra1'],
    },
  },
  premium: {
    id: 'premium',
    order: 2,
    limits: { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
    pricing: { current: 68, original: 76, period: 'month' },
    stripe: getStripeEnv().premium,
    i18n: {
      nameKey: 'plansPage.premiumInfo.name',
      descriptionKey: 'plansPage.premiumInfo.description',
      featureKeys: ['plansPage.premiumInfo.feature1', 'plansPage.premiumInfo.feature2'],
      extraKeys: ['plansPage.premiumInfo.extra1', 'plansPage.premiumInfo.extra2'],
    },
  },
  anual: {
    id: 'anual',
    order: 3,
    limits: { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
    pricing: { current: 612, original: 816, period: 'year' },
    stripe: getStripeEnv().anual,
    recommended: true,
    i18n: {
      nameKey: 'plansPage.anualInfo.name',
      descriptionKey: 'plansPage.anualInfo.description',
      featureKeys: ['plansPage.anualInfo.feature1', 'plansPage.anualInfo.feature2'],
      extraKeys: ['plansPage.anualInfo.extra1', 'plansPage.anualInfo.extra2', 'plansPage.anualInfo.extra3'],
    },
  },
};

// ========== Exports Derivados (retrocompatibilidade) ==========
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = Object.fromEntries(
  Object.entries(PLANS_CONFIG).map(([k, v]) => [k, v.limits]),
) as Record<SubscriptionPlan, PlanLimits>;

export const PLAN_PRICES: Record<SubscriptionPlan, number> = Object.fromEntries(
  Object.entries(PLANS_CONFIG).map(([k, v]) => [k, v.pricing.current]),
) as Record<SubscriptionPlan, number>;

export const VALID_PLANS: SubscriptionPlan[] = Object.keys(PLANS_CONFIG) as SubscriptionPlan[];

export const STRIPE_PLANS = Object.fromEntries(
  Object.entries(PLANS_CONFIG)
    .filter(([, v]) => v.stripe !== null)
    .map(([k, v]) => [k, { product_id: v.stripe!.productId, price_id: v.stripe!.priceId }]),
) as Record<'professional' | 'premium' | 'anual', { product_id: string; price_id: string }>;

export type StripePlan = keyof typeof STRIPE_PLANS;

export const AVAILABLE_PLANS: SubscriptionPlan[] = Object.values(PLANS_CONFIG)
  .sort((a, b) => a.order - b.order)
  .map((p) => p.id);
