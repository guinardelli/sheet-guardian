// Stripe product and price IDs
export const STRIPE_PLANS = {
  professional: {
    product_id: 'prod_TaJslOsZAWnhcN',
    price_id: 'price_1Sd9EhJkxX3Me4wlrU22rZwM',
  },
  premium: {
    product_id: 'prod_TaJsysi99Q1g2J',
    price_id: 'price_1Sd9F5JkxX3Me4wl1xNRb5Kh',
  },
} as const;

export type StripePlan = keyof typeof STRIPE_PLANS;
