# Preferred Tech Stack & Implementation Rules

When generating code or UI components for **Tekla PlaNnix**, you **MUST** strictly adhere to the following technology choices.

## Core Stack
* **Language:** TypeScript 5+ (Strict Mode)
* **Framework:** React 19
* **Build Tool:** Vite 7
* **Styling Engine:** Tailwind CSS 3.4
  * **Configuration:** Use `tailwind.config.ts` (supports `satisfies Config`)
  * **Dark Mode:** Class-based strategy
* **Component Library:** shadcn/ui (Radix UI Primitives)
* **Icons:** Lucide React

## Backend & Data
* **Backend as a Service:** Supabase (PostgreSQL, Auth, Edge Functions)
* **Data Fetching:** TanStack Query (React Query) v5
* **Routing:** React Router DOM v6

## Specialized Libraries
* **Charts:** Chart.js 4 with `react-chartjs-2`
* **Drag & Drop:** `@dnd-kit/core` (and related packages)
* **Forms:** `react-hook-form` + `zod` (implied via shadcn Form)
* **Date Handling:** `date-fns`
* **PDF Generation:** `jspdf` + `html2canvas`

## Implementation Guidelines

### 1. Tailwind Usage
* Use utility classes directly in JSX.
* Utilize the color tokens defined in `design-tokens.json` (e.g., `bg-primary`, `text-brand-primary`).
* **Custom Brand Colors:** Access via `brand-*` utilities (e.g., `bg-brand-primary`, `text-brand-primary-light`).
* **Animations:** Use `tailwindcss-animate` utilities (e.g., `animate-accordion-down`).

### 2. Component Patterns
* **Buttons:** Primary actions should use the default variant or `brand` colors if a specific brand emphasis is needed.
* **Layout:** Use Flexbox and CSS Grid.
* **Imports:** Use absolute imports via `@/` alias (e.g., `import { Button } from '@/components/ui/button'`).

### 3. Forbidden Patterns
* Do NOT use standard CSS files for component styling (except global `index.css`).
* Do NOT use Styled Components or Emotion.
* Do NOT use Redux (prefer React Query + Context for server/auth state).
