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

---

## Project Structure

```
sheet-guardian/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components (Button, Card, etc.)
│   │   ├── ExcelBlocker.tsx
│   │   ├── FileDropzone.tsx
│   │   ├── Header.tsx
│   │   ├── ProcessingLog.tsx
│   │   └── StatisticsCard.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.tsx     # Authentication context and hook
│   │   ├── useSubscription.tsx  # Subscription management
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── integrations/       # Third-party service integrations
│   │   └── supabase/
│   │       ├── client.ts   # Supabase client configuration
│   │       └── types.ts    # Auto-generated database types
│   ├── lib/                # Utility functions
│   │   ├── excel-vba-modifier.ts  # Core Excel processing logic
│   │   └── utils.ts        # General utilities
│   ├── pages/              # Route pages
│   │   ├── Index.tsx       # Landing page
│   │   ├── Dashboard.tsx   # Main app (file processing)
│   │   ├── Auth.tsx        # Login/signup
│   │   ├── Plans.tsx       # Subscription plans
│   │   └── NotFound.tsx    # 404 page
│   ├── App.tsx             # Root component with providers
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global styles
├── supabase/
│   ├── config.toml
│   └── migrations/         # Database migrations
├── public/                 # Static assets
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── eslint.config.js
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
- `sheets_used_month` - Integer (monthly counter)
- `last_sheet_date` - Date (last processing date)
- `last_reset_date` - Date (last monthly reset)
- `payment_method`, `payment_status` - Text
- `created_at`, `updated_at` - Timestamps

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
   - Relaxed settings: `noImplicitAny: false`, `strictNullChecks: false`
   - Unused variables/parameters are allowed (linter disabled)
   - Use explicit types where it improves clarity

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
   - Log detailed errors to console in development
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
- Manual testing in browser (no automated tests configured)
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
  console.error('Database error:', error);
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

### When to Ask for Clarification
- Binary VBA modification logic (sensitive and complex)
- Subscription plan pricing or limits changes
- Database schema modifications (affects existing users)
- Authentication flow changes
- Payment integration (not currently implemented)

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
