# Deployment Guide

This guide covers the production deploy checklist and the required environment configuration.

## Prerequisites
- Node.js 20+
- Supabase project (database + auth)
- Stripe account (test + live)
- Vercel project

## Environment Variables
### Vercel (frontend)
Set these in the Vercel project:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Supabase secrets (edge functions)
Set these in Supabase (Project Settings > Edge Functions):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SERVICE_ROLE_KEY`

Note: Supabase does not allow secret names starting with `SUPABASE_`.

## Supabase Setup
1. Apply migrations in `supabase/migrations/` (including `20251222_error_logging.sql`).
2. Deploy Edge Functions:
   - `create-checkout`
   - `check-subscription`
   - `customer-portal`
   - `stripe-webhook`
3. Configure Stripe webhook endpoint in Stripe Dashboard:
   - `https://<project>.supabase.co/functions/v1/stripe-webhook`
4. Verify Stripe product and price IDs in `src/lib/stripe.ts`.

## Build and Deploy
1. Install dependencies: `npm ci`
2. Run checks: `npm run lint`, `npm run type-check`, `npm test -- --run`
3. Build: `npm run build`
4. Deploy via Vercel.

## Post-Deploy Checklist
- Signup/login works
- File processing works for free plan
- Stripe checkout and portal work
- Webhook events update subscriptions
- Rate limiting works
- Error logs appear in `error_logs`

For the full checklist, see `PRODUCTION_READINESS_PLAN.md`.
