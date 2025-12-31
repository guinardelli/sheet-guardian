# MELHORIAS_06 - PageSpeed Optimization

> **Origem:** Análise do PageSpeed Insights (Google) em 30/12/2024
> **URL Testada:** https://vbablocker.vercel.app/

---

## Resumo dos Problemas

| Categoria | Problema | Impacto | Prioridade |
|-----------|----------|---------|------------|
| CSP | Google Fonts bloqueado | Fontes não carregam | **CRÍTICO** |
| A11y | Contraste de cores insuficiente | Conformidade WCAG | **ALTO** |
| Perf | JavaScript não utilizado (~163 KiB) | LCP, TTI | **ALTO** |
| Perf | CSS não utilizado (~11 KiB) | FCP | Médio |
| Perf | CSS bloqueando renderização | FCP | Médio |
| Perf | Sem code splitting | TTI | Médio |
| Perf | Animação não composited | Jank visual | Baixo |
| Dev | Source maps ausentes | Debugging | Baixo |

---

## TAREFA 1: Corrigir CSP para Google Fonts [CRÍTICO]

### Arquivo: `vercel.json`

**Problema:** A política CSP atual bloqueia o carregamento de fontes do Google.

**Erro no console:**
```
Refused to load the stylesheet 'https://fonts.googleapis.com/css2?family=Inter...'
because it violates the following Content Security Policy directive: "style-src 'self' 'unsafe-inline'"
```

**Ação:** Atualizar a diretiva `Content-Security-Policy` na linha 34.

**DE:**
```json
"value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://*.functions.supabase.co wss://*.supabase.co wss://*.functions.supabase.co https://api.stripe.com; frame-src https://js.stripe.com https://checkout.stripe.com; img-src 'self' data: https:; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';"
```

**PARA:**
```json
"value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://*.supabase.co https://*.functions.supabase.co wss://*.supabase.co wss://*.functions.supabase.co https://api.stripe.com; frame-src https://js.stripe.com https://checkout.stripe.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';"
```

**Mudanças específicas:**
- `style-src`: Adicionar `https://fonts.googleapis.com`
- `font-src`: Adicionar `https://fonts.gstatic.com`

---

## TAREFA 2: Adicionar Preconnect para Fontes

### Arquivo: `index.html`

**Problema:** Sem resource hints para Google Fonts, aumentando latência.

**Ação:** Adicionar as seguintes linhas dentro do `<head>`, antes do `<title>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

**Resultado esperado após a edição (linhas 3-8):**
```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <title>Bloqueador de Planilhas Excel - VBA Modifier</title>
```

---

## TAREFA 3: Melhorar Contraste de Cores

### Arquivo: `src/index.css`

**Problema:** A variável `--muted-foreground` tem contraste insuficiente para conformidade WCAG AA.

**Ação 1:** Linha 25 - Ajustar light mode:
```css
/* DE: */
--muted-foreground: 220 9% 46%;

/* PARA: */
--muted-foreground: 220 9% 40%;
```

**Ação 2:** Linha 79 - Ajustar dark mode:
```css
/* DE: */
--muted-foreground: 220 9% 60%;

/* PARA: */
--muted-foreground: 220 9% 70%;
```

---

## TAREFA 4: Remover Variáveis CSS do Sidebar (não utilizado)

### Arquivo: `src/index.css`

**Problema:** Variáveis de sidebar ocupam espaço mas nunca são usadas.

**Ação 1:** Deletar linhas 52-59 (light mode sidebar):
```css
/* DELETAR ESTAS LINHAS: */
--sidebar-background: 0 0% 98%;
--sidebar-foreground: 240 5.3% 26.1%;
--sidebar-primary: 240 5.9% 10%;
--sidebar-primary-foreground: 0 0% 98%;
--sidebar-accent: 240 4.8% 95.9%;
--sidebar-accent-foreground: 240 5.9% 10%;
--sidebar-border: 220 13% 91%;
--sidebar-ring: 217.2 91.2% 59.8%;
```

**Ação 2:** Deletar linhas 97-104 (dark mode sidebar):
```css
/* DELETAR ESTAS LINHAS: */
--sidebar-background: 220 25% 10%;
--sidebar-foreground: 220 14% 90%;
--sidebar-primary: 153 56% 42%;
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 220 20% 15%;
--sidebar-accent-foreground: 220 14% 90%;
--sidebar-border: 220 20% 20%;
--sidebar-ring: 217.2 91.2% 59.8%;
```

---

## TAREFA 5: Remover Animação de Gradiente

### Arquivo: `src/index.css`

**Problema:** Animação `background-position` não é GPU-accelerated, causa jank.

**Ação:** Deletar linhas 163-175:
```css
/* DELETAR ESTE BLOCO: */
@keyframes gradient-shift {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.animate-gradient-shift {
  background-size: 200% 200%;
  animation: gradient-shift 8s ease infinite;
}
```

### Arquivo: `src/pages/Index.tsx`

**Ação:** Remover a classe `animate-gradient-shift` do elemento hero background (linha ~23).

**DE:**
```tsx
<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-background animate-gradient-shift" />
```

**PARA:**
```tsx
<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-background" />
```

---

## TAREFA 6: Configurar Build com Source Maps e Code Splitting

### Arquivo: `vite.config.ts`

**Problema:** Build não gera source maps e não divide chunks.

**Ação:** Adicionar configuração de build:

**DE:**
```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
```

**PARA:**
```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-utils': ['jszip', 'file-saver', 'zod'],
        }
      }
    }
  },
}));
```

---

## TAREFA 7: Implementar Lazy Loading de Rotas

### Arquivo: `src/App.tsx`

**Problema:** Todas as páginas são carregadas no bundle inicial.

**Ação 1:** Adicionar imports de lazy e Suspense:
```typescript
import { lazy, Suspense } from 'react';
```

**Ação 2:** Converter imports estáticos para dinâmicos:
```typescript
// DE:
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Plans from "./pages/Plans";
import Account from "./pages/Account";

// PARA:
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const Plans = lazy(() => import("./pages/Plans"));
const Account = lazy(() => import("./pages/Account"));
```

**Ação 3:** Envolver Routes com Suspense:
```tsx
<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div></div>}>
  <Routes>
    {/* ... existing routes ... */}
  </Routes>
</Suspense>
```

---

## TAREFA 8: Auditar e Remover Dependências Não Utilizadas

### Arquivo: `package.json`

**Verificar se estas dependências estão sendo usadas:**

1. **recharts** (~70 KiB)
   - Buscar por: `import.*recharts` ou `from.*recharts`
   - Se não encontrar uso, remover: `npm uninstall recharts`

2. **embla-carousel-react** (~15 KiB)
   - Buscar por: `import.*embla` ou `from.*embla`
   - Se não encontrar uso, remover: `npm uninstall embla-carousel-react`

3. **cmdk** (~10 KiB)
   - Buscar por: `import.*cmdk` ou `from.*cmdk`
   - Se não encontrar uso, remover: `npm uninstall cmdk`

---

## TAREFA 9: Deletar Componentes UI Não Utilizados

### Diretório: `src/components/ui/`

**Componentes para DELETAR (25 arquivos):**

```bash
# Execute estes comandos para deletar:
rm src/components/ui/accordion.tsx
rm src/components/ui/alert-dialog.tsx
rm src/components/ui/aspect-ratio.tsx
rm src/components/ui/avatar.tsx
rm src/components/ui/breadcrumb.tsx
rm src/components/ui/carousel.tsx
rm src/components/ui/chart.tsx
rm src/components/ui/collapsible.tsx
rm src/components/ui/context-menu.tsx
rm src/components/ui/drawer.tsx
rm src/components/ui/hover-card.tsx
rm src/components/ui/input-otp.tsx
rm src/components/ui/menubar.tsx
rm src/components/ui/navigation-menu.tsx
rm src/components/ui/pagination.tsx
rm src/components/ui/radio-group.tsx
rm src/components/ui/resizable.tsx
rm src/components/ui/scroll-area.tsx
rm src/components/ui/select.tsx
rm src/components/ui/skeleton.tsx
rm src/components/ui/slider.tsx
rm src/components/ui/switch.tsx
rm src/components/ui/table.tsx
rm src/components/ui/toggle-group.tsx
rm src/components/ui/toggle.tsx
```

**IMPORTANTE:** Antes de deletar, verificar se algum está sendo importado:
```bash
grep -r "from.*ui/accordion" src/
grep -r "from.*ui/alert-dialog" src/
# ... etc
```

**Economia estimada:** 60-80 KiB

---

## Resumo de Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `vercel.json` | Atualizar CSP para permitir Google Fonts |
| `index.html` | Adicionar preconnect hints |
| `src/index.css` | Corrigir contraste, remover sidebar vars, remover animação |
| `vite.config.ts` | Adicionar sourcemaps e code splitting |
| `src/App.tsx` | Implementar lazy loading |
| `src/pages/Index.tsx` | Remover classe animate-gradient-shift |
| `src/components/ui/*.tsx` | Deletar 25 componentes não utilizados |
| `package.json` | Remover dependências não utilizadas |

---

## Resultados Esperados

| Métrica | Antes | Depois (Est.) |
|---------|-------|---------------|
| Bundle JS | ~260 KiB | ~160-180 KiB |
| Bundle CSS | ~14.5 KiB | ~10-11 KiB |
| FCP | ~445ms | ~300-350ms |
| LCP | - | -15-20% |
| Accessibility Score | ~85 | ~95+ |

---

## Ordem de Implementação

1. **TAREFA 1-2:** CSP + Preconnect (correção crítica - fontes quebradas)
2. **TAREFA 3:** Contraste de cores (acessibilidade)
3. **TAREFA 4-5:** Remover CSS não utilizado + animação
4. **TAREFA 6:** Configurar Vite build
5. **TAREFA 7:** Lazy loading de rotas
6. **TAREFA 8:** Auditar dependências
7. **TAREFA 9:** Remover componentes UI não utilizados

---

**Última atualização:** 30/12/2024
