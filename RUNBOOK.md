# Runbook

Operational guide for common issues, monitoring, and backup/restore.

## Common Issues
### Supabase not configured
- Symptom: UI shows configuration warning.
- Fix: Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in Vercel.

### Stripe checkout fails
- Symptom: Checkout fails with 500 from Edge Functions.
- Fix: Confirm `STRIPE_SECRET_KEY` is set in Supabase secrets.

### Webhook signature errors
- Symptom: `stripe-webhook` returns 400 signature errors.
- Fix: Recreate the webhook endpoint in Stripe and update `STRIPE_WEBHOOK_SECRET`.

### Usage counters not updating
- Symptom: Weekly/monthly usage does not change.
- Fix: Ensure migrations are applied and `sheets_used_week` exists.

### Rate limit blocking legit logins
- Symptom: Login blocked after few attempts.
- Fix: Check `auth_attempts` table and consider adjusting limits in `useAuth`.

## Error Monitoring
Client errors are captured by `src/lib/error-tracker.ts` and stored in `public.error_logs`.

Example queries:
```sql
select * from public.error_logs order by created_at desc limit 50;
select * from public.auth_attempts order by created_at desc limit 50;
```

## Backup and Restore
### Manual backup
1. Set `SUPABASE_DB_URL` locally.
2. Run: `./backup.sh`

### Restore (local or staging)
1. Create a target database.
2. Run:
```sh
pg_restore --clean --no-owner --dbname "$SUPABASE_DB_URL" backups/<file>.dump
```

### Scheduled backups
GitHub Actions workflow: `.github/workflows/weekly-backup.yml`.
- Requires `SUPABASE_DB_URL` secret in GitHub.
