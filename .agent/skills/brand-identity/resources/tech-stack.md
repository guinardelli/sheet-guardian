# Technology Stack & Constraints

Use this document to guide technical decisions, library choices, and architecture patterns.

## Core Framework & Runtime
- **Frontend**: React 18+
- **Build Tool**: Vite (SWC)
- **Language**: TypeScript 5+ (Strict mode)
- **Routing**: React Router DOM v6

## Styling & UX
- **CSS Engine**: TailwindCSS v3.4+
- **Component Library**: Shadcn UI (Radix UI)
- **Icons**: Lucide React
- **Theming**: `next-themes` (Dark/Light mode support)
- **Animations**: `tailwindcss-animate` + Custom CSS keyframes

## State & Data Management
- **Server State**: Tanstack Query (React Query) v5
- **Local State**: React Context / Hooks (Zustand optional if needed)
- **Form Management**: React Hook Form + Zod (Validation)

## Backend & Infrastructure
- **Platform**: Supabase
- **Database**: PostgreSQL (via Supabase)
- **Auth**: Supabase Auth (Email/Password)
- **Serverless**: Supabase Edge Functions (Deno/TypeScript)
- **Storage**: Supabase Storage

## Testing & Quality
- **Unit/Integration**: Vitest + React Testing Library
- **E2E**: Playwright
- **Linting**: ESLint + Prettier
- **Error Tracking**: Sentry

## Key Implementation Patterns
- **Functional Components**: Use React functional components with Hooks.
- **Composition**: Prefer composition over inheritance.
- **Mobile First**: All designs must be responsive, starting from mobile breakpoints.
- **Type Safety**: Avoid `any`; use rigorous type definitions (Zod schemas for runtime validation).
