# Sheet Guardian

Sheet Guardian is a web app that processes Excel .xlsm files in the browser and removes specific VBA protection patterns. It supports subscription tiers (free, professional, premium) and uses Supabase for auth and data.

## Features
- Upload and process Excel .xlsm files
- VBA pattern modification (CMG, DPB, GC)
- Subscription limits (weekly/monthly)
- Stripe checkout and customer portal
- Supabase auth + RLS

## Tech Stack
- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (auth, database)
- Stripe (billing)

## Local Development
1. Copy `.env.example` to `.env` and fill in values.
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`

## Scripts
- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run lint` - lint
- `npm run type-check` - TypeScript checks
- `npm test -- --run` - run unit tests

## Backups
- Backup: `./backup.sh`
- Restore: see `BACKUP_RESTORE.md`

## Deployment
See `DEPLOYMENT.md` for the full checklist, environment variables, and Supabase steps.

Primary hosting is Vercel. The Netlify configuration was removed to avoid CI/CD ambiguity.

## Monitoring
Client errors are captured in the `error_logs` table (see `RUNBOOK.md`).

## Production Plan
The detailed production checklist lives in `PRODUCTION_READINESS_PLAN.md`.
