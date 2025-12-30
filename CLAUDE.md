# Sheet Guardian - AI Assistant Development Guide

## Project Overview

**Sheet Guardian** is a web application that processes Excel files with VBA macros (.xlsm) to modify specific binary patterns in the VBA project. The application provides a subscription-based service with three tiers (free, professional, premium) and integrates with Supabase for authentication and data persistence.

### Core Functionality
- Upload and process .xlsm (Excel macro-enabled) files
- Modify binary patterns in VBA projects (CMG=, DPB=, GC= patterns)
- Track usage limits based on subscription plans
- User authentication and subscription management
- Real-time processing progress with animated UI feedback

---

## Tech Stack

### Frontend Framework
- **React 18** - UI library
- **TypeScript 5.8** - Type safety
- **Vite 5** - Build tool with SWC for fast compilation
- **React Router DOM 6** - Client-side routing

### UI & Styling
- **Tailwind CSS 3** - Utility-first CSS framework
- **shadcn/ui** - Component library built on Radix UI primitives
- **Lucide React** - Icon library
- **next-themes** - Dark mode support
- **Sonner + Toast** - Notification system

### Backend & Data
- **Supabase** - Backend-as-a-Service (authentication, database, real-time)
- **TanStack React Query** - Server state management
- **Zod** - Schema validation
- **React Hook Form** - Form state management

### File Processing
- **JSZip** - Excel file manipulation (reading/writing .xlsm as zip archives)
- **file-saver** - File download functionality

### Development Tools
- **ESLint** - Code linting
- **lovable-tagger** - Development mode component tagging
- **Vitest** - Unit testing

---

## Project Structure

```
sheet-guardian/
??? src/
?   ??? components/           # React components
?   ?   ??? ui/                # shadcn/ui components
?   ??? hooks/                 # Custom React hooks
?   ?   ??? useAuth.tsx
?   ?   ??? useSubscription.tsx
?   ??? integrations/
?   ?   ??? supabase/
?   ?       ??? client.ts
?   ?       ??? types.ts
?   ??? lib/
?   ?   ??? excel-vba-modifier.ts
?   ?   ??? error-tracker.ts
?   ?   ??? logger.ts
?   ?   ??? utils.ts
?   ??? pages/
?   ?   ??? Index.tsx
?   ?   ??? Dashboard.tsx
?   ?   ??? Auth.tsx
?   ?   ??? Plans.tsx
?   ?   ??? Account.tsx
?   ?   ??? NotFound.tsx
?   ??? test/
?   ??? App.tsx
?   ??? main.tsx
?   ??? index.css
??? supabase/
?   ??? config.toml
?   ??? migrations/
??? public/
??? package.json
??? vite.config.ts
??? tailwind.config.ts
??? tsconfig.json
??? eslint.config.js
```


---

## Key Architecture Patterns

### 1. Path Aliases
- `@/` is aliased to `src/` directory
- Use `@/components/ui/button` instead of `../../components/ui/button`
- Configured in both `vite.config.ts` and `tsconfig.json`

### 2. Authentication Flow
```typescript
// AuthProvider wraps the entire app
<AuthProvider>
  {children}
</AuthProvider>

// Use in components
const { user, session, loading, signIn, signUp, signOut } = useAuth();

// Protected routes check authentication in useEffect
useEffect(() => {
  if (!authLoading && !user) {
    navigate('/auth');
  }
}, [user, authLoading, navigate]);
```

### 3. Subscription Management
```typescript
const { subscription, canProcessSheet, incrementUsage } = useSubscription();

// Check limits before processing
const { allowed, reason } = canProcessSheet(fileSizeKB);
if (!allowed) {
  toast.error('Limite atingido', { description: reason });
  return;
}

// Increment usage after successful processing
await incrementUsage();
```

### 4. Supabase Integration
- **Auto-generated types**: `src/integrations/supabase/types.ts` is generated from database schema
- **Client configuration**: Session persistence via localStorage with auto-refresh
- **RLS Policies**: Row-level security ensures users only access their own data
- **Automatic triggers**: New users automatically get profile + free subscription

### 5. Excel Processing Pipeline
```typescript
// 1. Validate file type (.xlsm only)
// 2. Read file as ArrayBuffer
// 3. Unzip using JSZip
// 4. Extract vbaProject.bin
// 5. Search for binary patterns (CMG=", DPB=", GC=")
// 6. Replace pattern values with 'F' characters
// 7. Repack zip with modified VBA
// 8. Return modified file as Blob
```

---

## Database Schema

### Tables

#### `profiles`
- `id` - UUID primary key
- `user_id` - References auth.users(id), unique
- `email` - Text
- `created_at`, `updated_at` - Timestamps

#### `subscriptions`
- `id` - UUID primary key
- `user_id` - References auth.users(id), unique
- `plan` - Enum: 'free' | 'professional' | 'premium'
- `sheets_used_today` - Integer (daily counter)
- `sheets_used_week` - Integer (weekly counter)
- `sheets_used_month` - Integer (monthly counter)
- `last_sheet_date` - Date (last processing date)
- `last_reset_date` - Date (last monthly reset)
- `stripe_customer_id`, `stripe_subscription_id`, `stripe_product_id` - Text
- `payment_method`, `payment_status` - Text
- `created_at`, `updated_at` - Timestamps

#### `auth_attempts`
- Tracks authentication attempts for rate limiting

#### `error_logs`
- Client-side error logs captured in production

### Subscription Plan Limits
```typescript
free:         { sheetsPerWeek: null, sheetsPerMonth: 1,    maxFileSizeMB: 1 }
professional: { sheetsPerWeek: 5,    sheetsPerMonth: null, maxFileSizeMB: 1 }
premium:      { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null }
```

### RLS Policies
- Users can only SELECT/UPDATE/INSERT their own profile and subscription
- Enforced at database level via `auth.uid() = user_id` checks

---

## Development Guidelines

### Code Style & Conventions

1. **TypeScript Strictness**
   - Strict mode enabled: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`
   - Fix type errors instead of suppressing; add explicit types when it improves clarity

2. **Component Patterns**
   - Prefer functional components with hooks
   - Use `React.FC` or explicit prop types
   - Export components as default or named (be consistent per file)

3. **State Management**
   - Local state: `useState` for component-specific state
   - Global auth: `AuthContext` via `useAuth()`
   - Server state: React Query for data fetching
   - Subscription state: Custom hook `useSubscription()`

4. **Error Handling**
   - Use `toast` from Sonner for user-facing errors
   - Use `logger` for dev logs and `error-tracker` for production errors
   - Provide Portuguese error messages for better UX

5. **File Organization**
   - UI components go in `components/ui/` (shadcn)
   - Business logic components in `components/`
   - Reusable hooks in `hooks/`
   - Utilities in `lib/`

### Common Development Tasks

#### Adding a New Page
1. Create component in `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`:
   ```typescript
   <Route path="/new-page" element={<NewPage />} />
   ```
3. Add navigation link in `Header.tsx` if needed

#### Adding a New Component
1. For UI primitives, use shadcn CLI:
   ```bash
   npx shadcn@latest add component-name
   ```
2. For custom components, create in `src/components/`
3. Use path alias: `import { Component } from '@/components/Component'`

#### Modifying Supabase Schema
1. Create migration in `supabase/migrations/`
2. Update local types:
   ```bash
   # If using Supabase CLI
   supabase db diff -f migration_name
   ```
3. Regenerate types or update `src/integrations/supabase/types.ts` manually
4. Update queries/hooks to use new schema

#### Working with Forms
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const formSchema = z.object({
  email: z.string().email(),
});

const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
});

const onSubmit = (values: z.infer<typeof formSchema>) => {
  // Handle form submission
};
```

### Testing Approach
- Automated tests with Vitest (`npm test -- --run`)
- Test authentication flow: signup → email confirmation → login
- Test subscription limits: try exceeding daily/monthly limits
- Test file processing: upload various .xlsm files
- Test responsive design on mobile and desktop

---

## Environment Variables

Required in `.env`:
```env
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon-key]
VITE_SUPABASE_PROJECT_ID=[project-id]
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_WEBHOOK_SECRET=whsec_webhook_secret
SERVICE_ROLE_KEY=service_role_key
```

**Important**: Never commit `.env` with real credentials. Use `.env.example` for templates.

---

## Common Patterns & Best Practices

### 1. Async Operations
```typescript
// Always handle errors
try {
  const result = await processExcelFile(file, onLog, onProgress);
  toast.success('Processamento concluído!');
} catch (error) {
  toast.error('Erro ao processar arquivo', {
    description: error.message
  });
}
```

### 2. Supabase Queries
```typescript
// Always check for errors
const { data, error } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('user_id', user.id)
  .maybeSingle();

if (error) {
  logger.error('Database error', error);
  return;
}
```

### 3. File Handling
```typescript
// Read file as ArrayBuffer for binary operations
const arrayBuffer = await file.arrayBuffer();
const uint8Array = new Uint8Array(arrayBuffer);

// Download processed file
const blob = new Blob([modifiedData], { type: file.type });
saveAs(blob, newFileName);
```

### 4. Toast Notifications
```typescript
// Success
toast.success('Operação bem-sucedida!');

// Error with description
toast.error('Erro', {
  description: 'Descrição detalhada do erro'
});

// Warning
toast.warning('Atenção', {
  description: 'Mensagem de aviso'
});
```

---

## Build & Deployment

### Development
```bash
npm run dev        # Start dev server on port 8080
npm run lint       # Run ESLint
```

### Production
```bash
npm run build      # Build for production (outputs to dist/)
npm run preview    # Preview production build locally
```

### Build Modes
- `npm run build` - Production build (optimized, no tagger)
- `npm run build:dev` - Development build (includes lovable-tagger)

### Deployment Notes
- Static site, can be deployed to any static hosting (Vercel, Netlify, etc.)
- Requires Supabase project with correct environment variables
- Ensure Supabase URL and auth redirects are configured for production domain

---

## Troubleshooting

### Common Issues

1. **Import errors with `@/` alias**
   - Verify `vite.config.ts` has correct alias configuration
   - Check `tsconfig.json` paths are set correctly
   - Restart TypeScript server in IDE

2. **Supabase connection issues**
   - Check environment variables are loaded (`.env` in project root)
   - Verify Supabase project is active and not paused
   - Check browser console for CORS or network errors

3. **File processing fails**
   - Ensure file is actually .xlsm (check extension and MIME type)
   - Verify file has VBA content (`xl/vbaProject.bin` exists in zip)
   - Check browser console for detailed error messages

4. **Authentication not persisting**
   - Check localStorage is not blocked/cleared
   - Verify `autoRefreshToken` is enabled in Supabase client config
   - Check for expired or invalid sessions

5. **Subscription limits not working**
   - Verify user has subscription record in database
   - Check date calculations (timezone issues)
   - Ensure `incrementUsage()` is called after successful processing

---

## Key Files Reference

### Core Application Logic
- `src/lib/excel-vba-modifier.ts:79-150` - Main Excel processing function
- `src/hooks/useAuth.tsx:1-74` - Authentication provider and hook
- `src/hooks/useSubscription.tsx:36-170` - Subscription management logic

### Main User Interfaces
- `src/pages/Dashboard.tsx` - Primary file processing interface
- `src/pages/Auth.tsx` - Login/signup forms
- `src/pages/Plans.tsx` - Subscription plan selection

### Configuration
- `vite.config.ts:7-18` - Vite build configuration
- `tailwind.config.ts:3-98` - Tailwind theme and plugin config
- `src/integrations/supabase/client.ts:11-17` - Supabase client setup

---

## AI Assistant Guidelines

When working on this codebase:

1. **Always read before modifying**: Use Read tool on files before suggesting changes
2. **Respect path aliases**: Use `@/` for all imports from `src/`
3. **Follow subscription logic**: Ensure new features respect plan limits
4. **Handle errors gracefully**: Use toast notifications for user feedback
5. **Maintain Portuguese UX**: User-facing messages should be in Portuguese
6. **Test file processing**: Any changes to Excel processing must be thoroughly tested
7. **Preserve RLS security**: Don't bypass or weaken Row-Level Security policies
8. **Use existing hooks**: Leverage `useAuth` and `useSubscription` instead of direct Supabase calls
9. **Keep components simple**: Prefer composition over complex component hierarchies
10. **Document complex logic**: Add comments for non-obvious binary operations or algorithms
11. **USE MCP SERVERS**: Always leverage the available MCP servers when applicable (see MCP Servers section below)

### When to Ask for Clarification
- Binary VBA modification logic (sensitive and complex)
- Subscription plan pricing or limits changes
- Database schema modifications (affects existing users)
- Authentication flow changes
- Payment integration (not currently implemented)

---

## MCP Servers Available

The project has **10 Model Context Protocol (MCP) servers** configured and active. **Always use these MCPs when applicable** to enhance development workflow and capabilities.

### Active MCP Servers

#### 1. **Sentry MCP** (Error Monitoring)
- **Purpose**: Monitor and analyze production errors
- **When to use**:
  - Investigating production issues
  - Analyzing error patterns
  - Tracking performance metrics
  - Creating/updating issues
- **Example**: "Check Sentry for errors in the last 24 hours"

#### 2. **Context7 MCP** (Documentation)
- **Purpose**: Access up-to-date, version-specific documentation
- **When to use**:
  - Looking up framework/library documentation
  - Checking API changes
  - Finding best practices
  - Getting code examples
- **Usage**: Prefix queries with "use context7"
- **Example**: "use context7 to show React Query best practices"

#### 3. **Filesystem MCP** (File Operations)
- **Purpose**: Advanced file system operations
- **When to use**:
  - Batch file operations
  - Complex file searches
  - Reading multiple files efficiently
- **Scope**: Limited to project directory for security

#### 4. **GitHub MCP** (Repository Management)
- **Purpose**: Interact with GitHub repositories
- **When to use**:
  - Managing issues and PRs
  - Reviewing commits
  - Creating/managing branches
  - Repository insights
- **Example**: "List all open PRs and their status"

#### 5. **Git MCP** (Local Git Operations)
- **Purpose**: Local Git version control operations
- **When to use**:
  - Checking git status and history
  - Managing local branches
  - Viewing diffs and logs
- **Scope**: Project repository only

#### 6. **PostgreSQL MCP** (Database Queries)
- **Purpose**: Direct PostgreSQL database access
- **When to use**:
  - Complex SQL queries
  - Database analysis
  - Data migration tasks
  - Performance optimization
- **Connection**: Supabase PostgreSQL database
- **Example**: "Show me users who exceeded their monthly limit"

#### 7. **Sequential Thinking MCP** (Structured Reasoning)
- **Purpose**: Step-by-step problem-solving and planning
- **When to use**:
  - Complex architectural decisions
  - Debugging difficult issues
  - Planning multi-step implementations
  - Exploring alternative solutions
- **Example**: "Use sequential thinking to plan the Stripe webhook integration"

#### 8. **Everything MCP** (Testing & Validation)
- **Purpose**: Exercise all MCP protocol features
- **When to use**:
  - Testing MCP functionality
  - Validating configurations
  - Development and debugging
- **Note**: Primarily for testing purposes

#### 9. **Supabase MCP** (Backend Management)
- **Purpose**: Complete Supabase management via chat
- **When to use**:
  - Inspecting database schema
  - Managing tables and data
  - Viewing logs
  - Database migrations
- **Mode**: Read-only (safe for production)
- **Example**: "Show me the structure of the subscriptions table"

#### 10. **Stripe MCP** (Payment Processing)
- **Purpose**: Complete Stripe payment system integration
- **When to use**:
  - Managing customers
  - Creating/managing subscriptions
  - Processing payments
  - Handling refunds
  - Searching Stripe documentation
- **Mode**: Test mode (safe for development)
- **Example**: "Create a subscription for customer X on the Professional plan"

### MCP Usage Guidelines

1. **Combine MCPs for Complex Tasks**
   ```
   "Use sequential thinking to plan a feature, then use Supabase MCP to check
   the database schema, and Stripe MCP to set up the payment flow"
   ```

2. **Use Context7 for Updated Documentation**
   ```
   "use context7 to check the latest React Query patterns for 2025"
   ```

3. **Database Operations: PostgreSQL vs Supabase**
   - **PostgreSQL MCP**: Complex queries, data analysis, write operations
   - **Supabase MCP**: Schema inspection, logs, migrations, read-only queries

4. **Version Control Workflow**
   ```
   "Use Git MCP to check status, then GitHub MCP to create a PR"
   ```

5. **Debugging with MCPs**
   ```
   "Use Sentry to find recent errors, then use sequential thinking
   to debug, and PostgreSQL to check database state"
   ```

### Common MCP Workflows

#### Implementing a New Feature
1. **Sequential Thinking MCP**: Plan the implementation
2. **Context7 MCP**: Check latest framework patterns
3. **Supabase MCP**: Verify database schema
4. **Git MCP**: Create feature branch
5. **GitHub MCP**: Create tracking issue

#### Debugging Production Issues
1. **Sentry MCP**: Identify errors and patterns
2. **Supabase MCP**: Check database state
3. **PostgreSQL MCP**: Run diagnostic queries
4. **Sequential Thinking MCP**: Analyze root cause

#### Payment Integration Development
1. **Stripe MCP**: Set up products and prices
2. **Supabase MCP**: Design subscription sync
3. **Sequential Thinking MCP**: Plan webhook implementation
4. **PostgreSQL MCP**: Verify data integrity

### MCP Configuration Files
- **Location**: `.claude.json` (project-specific)
- **Environment Variables**: `.env` (Stripe, Supabase tokens)
- **Status Check**: Run `claude mcp list` to verify connections

---

## Future Considerations

Potential areas for enhancement (not yet implemented):
- Actual payment processing integration
- Usage analytics and reporting
- Batch file processing
- API for programmatic access
- Email notifications for subscription renewals
- More sophisticated VBA pattern detection
- File history and re-download capability

---

**Last Updated**: 2025-12-10
**Project Version**: 0.0.0
**Primary Language**: Portuguese (BR) for UI, English for code
