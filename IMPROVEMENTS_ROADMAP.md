# 🚀 Sheet Guardian - Improvements Roadmap

> **Generated**: 2025-12-10
> **Status**: Transition from Lovable to Production-Ready
> **Priority System**: 🔴 Critical | 🟡 High | 🟢 Medium | 🔵 Low

---

## 📋 EXECUTIVE SUMMARY

Sheet Guardian has a solid foundation but **lacks critical production features**:
- ❌ No actual payment processing (revenue = $0)
- ❌ No backend security enforcement (easily bypassed)
- ❌ No tests (high risk for bugs)
- ❌ No monitoring (blind to issues)
- ⚠️ Several security vulnerabilities

**Estimated effort to production-ready**: 6-8 weeks with 1 developer

---

## 🎯 PHASE 1: CRITICAL BLOCKERS (Week 1-2)

### 🔴 1.1 Implement Real Payment Integration

**Problem**: Current payment flow is completely fake (simulated timeout)

**Files affected**:
- `src/pages/Plans.tsx:95-112`
- `src/hooks/useSubscription.tsx`

**Solution Options**:
1. **Stripe** (Best for international)
   - Pro: Well documented, robust
   - Con: Complex, requires backend

2. **Mercado Pago** (Best for Brazil)
   - Pro: PIX support, local
   - Con: Limited international

3. **Paddle** (Merchant of Record)
   - Pro: Handles taxes/compliance
   - Con: Higher fees

**Implementation Steps**:
```typescript
// 1. Add payment provider SDK
npm install @stripe/stripe-js @stripe/react-stripe-js

// 2. Create Supabase Edge Function for payment intent
// supabase/functions/create-payment-intent/index.ts

// 3. Handle webhooks for payment confirmation
// supabase/functions/stripe-webhook/index.ts

// 4. Update subscription on successful payment
```

**Testing Required**:
- [ ] Successful payment flow
- [ ] Failed payment handling
- [ ] Webhook verification
- [ ] Subscription activation
- [ ] Plan upgrades/downgrades

**Risk**: High - Payment bugs = revenue loss

---

### 🔴 1.2 Add Backend API Layer (Supabase Edge Functions)

**Problem**: All business logic in frontend (easily bypassed)

**Create Edge Functions**:

```
supabase/functions/
├── process-file/          # File processing with limits
├── check-usage-limits/    # Enforce subscription limits
├── create-payment/        # Payment creation
├── webhook-handler/       # Payment webhooks
└── usage-tracker/         # Track processing events
```

**Implementation**:

```typescript
// supabase/functions/check-usage-limits/index.ts
import { createClient } from '@supabase/supabase-js'

export default async function(req: Request) {
  const supabase = createClient(...)
  const { user_id, file_size } = await req.json()

  // Server-side validation
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user_id)
    .single()

  // Check limits server-side
  const limits = PLAN_LIMITS[subscription.plan]

  // Return authorization decision
  return new Response(JSON.stringify({ allowed, reason }))
}
```

**Migration Path**:
1. Create edge functions
2. Keep client-side checks as "fast fail"
3. Add server-side enforcement
4. Update frontend to call edge functions
5. Remove client-only logic

**Files to modify**:
- `src/hooks/useSubscription.tsx` - Add API calls
- `src/pages/Dashboard.tsx` - Call backend before processing
- New: `supabase/functions/*`

---

### 🔴 1.3 Fix Security Vulnerabilities

#### 1.3.1 Strengthen Password Requirements

```typescript
// src/pages/Auth.tsx
const authSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(100)
    .regex(/[A-Z]/, "Senha deve conter letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter letra minúscula")
    .regex(/[0-9]/, "Senha deve conter número")
    .regex(/[^A-Za-z0-9]/, "Senha deve conter caractere especial"),
});
```

#### 1.3.2 Add Rate Limiting

```typescript
// Use Supabase Database Triggers
CREATE OR REPLACE FUNCTION check_rate_limit(user_ip text)
RETURNS boolean AS $$
DECLARE
  attempt_count integer;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE ip_address = user_ip
  AND created_at > NOW() - INTERVAL '15 minutes';

  RETURN attempt_count < 5;
END;
$$ LANGUAGE plpgsql;
```

#### 1.3.3 Remove Committed .env File

```bash
# Remove from git
git rm --cached .env
echo ".env" >> .gitignore

# Create .env.example
cp .env .env.example
# Replace actual values with placeholders
sed -i 's/=.*/=your_value_here/g' .env.example

git add .env.example .gitignore
git commit -m "chore: remove secrets from git"
```

---

## 🎯 PHASE 2: HIGH PRIORITY (Week 3-4)

### 🟡 2.1 Add Comprehensive Testing

**Setup Testing Infrastructure**:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event msw
```

**Test Structure**:
```
src/
├── __tests__/
│   ├── unit/
│   │   ├── excel-vba-modifier.test.ts
│   │   ├── useSubscription.test.tsx
│   │   └── useAuth.test.tsx
│   ├── integration/
│   │   ├── auth-flow.test.tsx
│   │   ├── payment-flow.test.tsx
│   │   └── file-processing.test.tsx
│   └── e2e/
│       └── complete-user-journey.spec.ts
```

**Priority Tests**:
1. ✅ Payment flow (CRITICAL)
2. ✅ Subscription limit enforcement
3. ✅ File processing logic
4. ✅ Authentication flows
5. ✅ Excel VBA modification accuracy

**Coverage Target**: 80% for business logic

---

### 🟡 2.2 Implement File Processing in Web Worker

**Problem**: Large files freeze UI

**Solution**:

```typescript
// src/workers/excel-processor.worker.ts
import { processExcelFile } from '@/lib/excel-vba-modifier'

self.addEventListener('message', async (e) => {
  const { file, userId } = e.data

  try {
    const result = await processExcelFile(
      file,
      (log) => self.postMessage({ type: 'log', data: log }),
      (progress) => self.postMessage({ type: 'progress', data: progress })
    )

    self.postMessage({ type: 'complete', data: result })
  } catch (error) {
    self.postMessage({ type: 'error', data: error })
  }
})
```

**Usage**:
```typescript
// src/pages/Dashboard.tsx
const worker = new Worker(
  new URL('../workers/excel-processor.worker.ts', import.meta.url),
  { type: 'module' }
)

worker.postMessage({ file, userId })
worker.onmessage = (e) => {
  switch(e.data.type) {
    case 'progress': setProgress(e.data.data); break
    case 'log': addLog(e.data.data); break
    case 'complete': handleComplete(e.data.data); break
  }
}
```

**Benefits**:
- Non-blocking UI
- Can process multiple files
- Better error isolation

---

### 🟡 2.3 Add Error Tracking & Monitoring

**Install Sentry**:

```bash
npm install @sentry/react @sentry/tracing
```

**Configure**:
```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
});

// Wrap app
const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <App />
  </Sentry.ErrorBoundary>
)
```

**Add Analytics** (Privacy-first):
```typescript
// Use Plausible (GDPR compliant, no cookies)
// Add to index.html
<script defer data-domain="yourdomain.com"
  src="https://plausible.io/js/script.js"></script>
```

---

### 🟡 2.4 Improve TypeScript Strictness

**Update `tsconfig.json`**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**Fix compilation errors incrementally**:
1. Enable one flag at a time
2. Fix errors in one file/module
3. Commit and test
4. Repeat

**Estimated effort**: 4-6 hours

---

## 🎯 PHASE 3: MEDIUM PRIORITY (Week 5-6)

### 🟢 3.1 Add User Dashboard Features

**Features to implement**:

1. **Processing History**
```typescript
// New table
CREATE TABLE processing_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  original_filename TEXT,
  processed_filename TEXT,
  file_size_bytes BIGINT,
  patterns_modified INTEGER,
  processed_at TIMESTAMP DEFAULT NOW(),
  download_url TEXT, -- S3/Supabase Storage URL
  expires_at TIMESTAMP -- Auto-delete after 7 days
);
```

2. **File Storage** (Supabase Storage)
```typescript
// Store processed files temporarily
const { data, error } = await supabase.storage
  .from('processed-files')
  .upload(`${userId}/${filename}`, blob, {
    cacheControl: '3600',
    upsert: false
  })
```

3. **Re-download Feature**
```typescript
// Allow users to re-download files within 7 days
const { data } = await supabase.storage
  .from('processed-files')
  .createSignedUrl(`${userId}/${filename}`, 604800) // 7 days
```

---

### 🟢 3.2 Add Internationalization (i18n)

**Install i18next**:
```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

**Structure**:
```
src/
├── locales/
│   ├── pt-BR/
│   │   ├── common.json
│   │   ├── auth.json
│   │   ├── dashboard.json
│   │   └── plans.json
│   └── en-US/
│       └── ...
```

**Benefits**:
- International expansion ready
- Better organized copy
- Easy to update text

---

### 🟢 3.3 Implement Proper Subscription Management

**Features needed**:

1. **Subscription Lifecycle**
```typescript
// Add to subscriptions table
ALTER TABLE subscriptions ADD COLUMN
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP,
  trial_end TIMESTAMP;
```

2. **Renewal Logic** (Cron job via Supabase Edge Function)
```typescript
// supabase/functions/process-renewals/index.ts
// Runs daily via pg_cron
export default async function() {
  // Find expiring subscriptions
  // Attempt to charge
  // Update subscription status
  // Send notification emails
}
```

3. **Downgrade Flow**
```typescript
// Allow plan changes
// Prorate current period
// Apply credits to next billing
```

---

### 🟢 3.4 Add Email Notifications

**Use Supabase Auth Email Templates + Custom Emails**

**Email Types**:
1. Welcome email
2. Payment confirmation
3. Payment failed
4. Subscription expiring soon
5. Usage limit warnings
6. Monthly usage report

**Implementation**:
```typescript
// supabase/functions/send-email/index.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function(req: Request) {
  const { to, template, data } = await req.json()

  await resend.emails.send({
    from: 'noreply@sheetguardian.com',
    to,
    subject: TEMPLATES[template].subject(data),
    html: TEMPLATES[template].html(data)
  })
}
```

---

## 🎯 PHASE 4: NICE TO HAVE (Week 7-8)

### 🔵 4.1 Performance Optimizations

**Bundle Size Reduction**:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'excel-processor': ['jszip']
        }
      }
    }
  }
})
```

**Add React.memo where appropriate**:
```typescript
// src/components/ProcessingLog.tsx
export const ProcessingLog = React.memo(({ logs }: Props) => {
  // Component implementation
})
```

**Optimize React Query**:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})
```

---

### 🔵 4.2 Improve Accessibility

**Additions needed**:
1. ARIA labels on all interactive elements
2. Keyboard navigation testing
3. Screen reader testing
4. Focus management in modals
5. Color contrast improvements
6. Skip links

**Tools**:
```bash
npm install -D @axe-core/react eslint-plugin-jsx-a11y
```

---

### 🔵 4.3 Add Advanced Features

**Ideas**:
1. Batch file processing
2. API for developers
3. Browser extension
4. Desktop app (Tauri)
5. Scheduled processing
6. Team accounts
7. White-label option

---

## 📊 METRICS & KPIs TO TRACK

Once monitoring is in place, track:

**Business Metrics**:
- [ ] MRR (Monthly Recurring Revenue)
- [ ] Churn rate
- [ ] Conversion rate (free → paid)
- [ ] ARPU (Average Revenue Per User)
- [ ] LTV (Lifetime Value)

**Technical Metrics**:
- [ ] Error rate
- [ ] API latency
- [ ] File processing success rate
- [ ] Payment success rate
- [ ] Uptime (target: 99.9%)

**User Metrics**:
- [ ] Daily/Monthly Active Users
- [ ] Files processed per user
- [ ] Average file size
- [ ] Time to complete processing
- [ ] User retention (Day 1, 7, 30)

---

## 🚨 QUICK WINS (Can do today)

1. **Fix .env exposure** (30 min)
   ```bash
   git rm --cached .env
   echo ".env" >> .gitignore
   ```

2. **Improve error messages** (1 hour)
   - Replace technical errors with user-friendly messages
   - Add recovery suggestions

3. **Add loading states** (2 hours)
   - Skeleton screens
   - Better spinners
   - Progress indicators

4. **Create .env.example** (15 min)
   ```env
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
   VITE_SUPABASE_PROJECT_ID=your_project_id_here
   ```

5. **Add basic SEO** (1 hour)
   ```html
   <!-- index.html -->
   <meta name="description" content="...">
   <meta property="og:title" content="...">
   <meta property="og:description" content="...">
   ```

---

## 🎓 RECOMMENDED LEARNING RESOURCES

Before implementing:

1. **Stripe Integration**
   - [Stripe Docs](https://stripe.com/docs)
   - [Supabase + Stripe Guide](https://supabase.com/docs/guides/stripe)

2. **Supabase Edge Functions**
   - [Official Docs](https://supabase.com/docs/guides/functions)
   - [Examples Repo](https://github.com/supabase/supabase/tree/master/examples)

3. **Web Workers**
   - [MDN Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
   - [Vite + Workers](https://vitejs.dev/guide/features.html#web-workers)

4. **Testing React Apps**
   - [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
   - [Vitest Docs](https://vitest.dev/)

---

## 💰 COST ESTIMATES

**Monthly Operating Costs** (Production):

- Supabase Pro: ~$25/month
- Domain: ~$12/year
- Stripe fees: 2.9% + $0.30 per transaction
- Sentry: ~$26/month (10k events)
- Email (Resend): ~$10/month (10k emails)
- CDN/Hosting: ~$0 (if using Vercel free tier)

**Total: ~$80-100/month**

**Development Costs** (if hiring):
- Payment integration: 40-60 hours
- Backend API: 30-40 hours
- Testing setup: 20-30 hours
- Monitoring: 10-15 hours
- Bug fixes: 20-30 hours

**Total: ~120-175 hours (~3-4 weeks full-time)**

---

## 🏁 CONCLUSION

**Must Fix Before Launch**:
1. ✅ Real payment integration
2. ✅ Backend security layer
3. ✅ Remove .env from git
4. ✅ Basic testing

**Should Fix Soon After**:
5. ✅ Error monitoring
6. ✅ Improve TypeScript config
7. ✅ Add rate limiting

**Nice to Have**:
8. ✅ Web Worker processing
9. ✅ Internationalization
10. ✅ Advanced analytics

**The app has great bones, but needs production hardening before going live!**

---

**Next Steps**:
1. Review this document with team
2. Prioritize based on business needs
3. Create GitHub issues for each item
4. Start with Phase 1 items
5. Set up project tracking (GitHub Projects/Linear)

**Questions? Issues? Concerns?**
Review each section carefully and flag any items that need clarification or seem problematic for your specific use case.
