const normalizeEnvValue = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const stripeEnv = {
  professional: {
    productId: normalizeEnvValue(import.meta.env.VITE_STRIPE_PROFESSIONAL_PRODUCT_ID),
    priceId: normalizeEnvValue(import.meta.env.VITE_STRIPE_PROFESSIONAL_PRICE_ID),
  },
  premium: {
    productId: normalizeEnvValue(import.meta.env.VITE_STRIPE_PREMIUM_PRODUCT_ID),
    priceId: normalizeEnvValue(import.meta.env.VITE_STRIPE_PREMIUM_PRICE_ID),
  },
  anual: {
    priceId: normalizeEnvValue(import.meta.env.VITE_STRIPE_ANNUAL_PRICE_ID),
  },
};

const missingStripeEnv: string[] = [];

if (!stripeEnv.professional.productId) missingStripeEnv.push('VITE_STRIPE_PROFESSIONAL_PRODUCT_ID');
if (!stripeEnv.professional.priceId) missingStripeEnv.push('VITE_STRIPE_PROFESSIONAL_PRICE_ID');
if (!stripeEnv.premium.productId) missingStripeEnv.push('VITE_STRIPE_PREMIUM_PRODUCT_ID');
if (!stripeEnv.premium.priceId) missingStripeEnv.push('VITE_STRIPE_PREMIUM_PRICE_ID');
if (!stripeEnv.anual.priceId) missingStripeEnv.push('VITE_STRIPE_ANNUAL_PRICE_ID');

if (import.meta.env.PROD && missingStripeEnv.length > 0) {
  console.warn(`[Stripe] Missing env vars: ${missingStripeEnv.join(', ')}`);
}

// Stripe product and price IDs
export const STRIPE_PLANS = {
  professional: {
    product_id: stripeEnv.professional.productId ?? 'prod_TaJslOsZAWnhcN',
    price_id: stripeEnv.professional.priceId ?? 'price_1Sd9EhJkxX3Me4wlrU22rZwM',
  },
  premium: {
    product_id: stripeEnv.premium.productId ?? 'prod_TaJsysi99Q1g2J',
    price_id: stripeEnv.premium.priceId ?? 'price_1Sd9F5JkxX3Me4wl1xNRb5Kh',
  },
  anual: {
    product_id: stripeEnv.premium.productId ?? 'prod_TaJsysi99Q1g2J',
    price_id: stripeEnv.anual.priceId ?? 'price_1SkkH3JkxX3Me4wlLuYefRSD',
  },
} as const;

export type StripePlan = keyof typeof STRIPE_PLANS;
