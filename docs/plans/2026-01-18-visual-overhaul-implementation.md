# Visual Overhaul Implementation Plan (Guardian Prism)

> **For Agent:** REQUIRED SUB-SKILL: Use `brand-identity` skill to verify color codes against `design-tokens.json` (update tokens first if needed).

**Goal:** Transform "Sheet Guardian" into a premium, professional SaaS with the "Guardian Prism" design language (Glassmorphism, Emerald/Slate palette, Micro-interactions).

**Architecture:** Update Tailwind configuration and global CSS variables to strict brand tokens. Refactor core Shadcn UI components to use new variants (glass, premium-shadow). No major architectural changes to logic, only presentation.

**Tech Stack:** TailwindCSS, Shadcn UI, Lucide React, CSS Variables.

---

### Task 1: Foundation (Colors, Fonts, Shadows)

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/index.css`
- Modify: `src/App.tsx` (Font loading)

**Step 1.1: Update Tailwind Config**
Update `tailwind.config.ts` to include new color extensions and font families.
- Add `font-mono`: ['JetBrains Mono', 'monospace']
- Add `boxShadow`: 'prism' (colored shadow)

**Step 1.2: Update Global CSS Variables**
Update `src/index.css` with the new palette (Emerald, Slate, Indigo).
- `:root` variables for `primary`, `secondary`, `accent`.
- Add `.glass` utility class with `backdrop-filter`.

---

### Task 2: Core Components Polish

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/input.tsx`

**Step 2.1: Premium Buttons**
Modify `button.tsx` to add `hover-lift` and `active-scale` effects by default.
- Add `shadow-colored` variant for primary buttons.

**Step 2.2: Glass Cards**
Modify `card.tsx` to support a `variant="glass"` prop or default to glass style in dashboard.
- Border: `border-white/10` (dark) or `border-slate-200` (light).

**Step 2.3: Inputs with Focus Rings**
Update `input.tsx` to have a refined focus ring (Indigo/Tech Blue) and subtle background transition.

---

### Task 3: Layout & Navigation

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Step 3.1: Glass Sidebar**
Update `Sidebar.tsx` to use the `glass` utility.
- It should float over the background.

**Step 3.2: Dashboard Background**
Update `Dashboard.tsx` container to have a subtle mesh gradient background (fixed) so glass elements pop.

---

### Task 4: Typography & Empty States

**Files:**
- Modify: `src/components/EmptyState.tsx` (Create if new or modify existing)

**Step 4.1: Data Typography**
Identify areas displaying IDs or Codes and apply `font-mono`.

**Step 4.2: Rich Empty States**
Create a reusable `EmptyState` component with illustration support.
