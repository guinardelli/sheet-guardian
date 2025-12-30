# Stripe Webhook Setup (Sheet Guardian)

## Required Secrets (Supabase)
1. Open Supabase Dashboard -> Project Settings -> Edge Functions -> Secrets.
2. Add or update:
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)

## Configure Stripe Webhook Endpoint
1. Open Stripe Dashboard -> Developers -> Webhooks.
2. Add endpoint:
   - URL: https://dgweztejbixowxmfizgx.supabase.co/functions/v1/stripe-webhook
3. Select events:
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_failed
4. Copy the signing secret (whsec_...) and save as STRIPE_WEBHOOK_SECRET in Supabase.

## Test with Stripe CLI
```bash
stripe listen --forward-to https://dgweztejbixowxmfizgx.supabase.co/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

## Optional: Confirmation Email (Resend)
If you want the upgrade email to be sent from the webhook, set these secrets:
- RESEND_API_KEY
- RESEND_FROM_EMAIL

The webhook will skip sending email if these secrets are not configured.

## Notes
- The fallback sync runs via the check-subscription function from the Plans page.
- If the webhook returns 401/400, verify STRIPE_WEBHOOK_SECRET and request signature.
