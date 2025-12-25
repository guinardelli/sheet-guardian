# Plano de Redesign UI/UX - Sheet Guardian

## Objetivo
Redesenhar completamente a interface do Sheet Guardian para torná-la mais simples, moderna e funcional com estilo **minimalista Vercel/Linear**, mantendo as cores atuais (verde teracota + azul) e adicionando novos recursos ao header (busca, notificações, idioma).

---

## Preferências do Usuário
- **Estilo Header**: Minimalista e clean com glassmorphism
- **Elementos Novos**: Barra de pesquisa, notificações, seletor de idioma (PT/EN)
- **Design Geral**: Moderno e espaçoso (inspirado em Stripe/Notion)
- **Cores**: Manter paleta atual (verde #3D7D5D + azul #2563EB) com melhor consistência

---

## FASE 1: Fundação do Sistema de Design (4-6h)

### 1.1 Atualizar `src/index.css`
**Objetivo**: Padronizar tokens de design, z-index e animações

**Adicionar**:
```css
/* Z-Index Strategy */
:root {
  --z-sticky: 1020;      /* Header fixo */
  --z-fixed: 1030;       /* Mobile Sheet/Drawer */
  --z-modal: 1050;       /* Dialogs e Modals */
  --z-popover: 1060;     /* Dropdowns e Popovers */
  --z-toast: 1080;       /* Notificações Toast */
}

/* Color Tokens para padronizar hardcoded colors */
:root {
  --color-warning: 45 93% 47%;           /* Amarelo para avisos */
  --color-success-strong: 142 71% 45%;   /* Verde forte para sucesso */
  --color-info: 217 91% 50%;             /* Azul para info */
  --color-log-bg: 220 25% 9%;            /* Background escuro para logs */
}

/* Animation Tokens */
.ease-smooth {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover Lift Effect */
.hover-lift {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.12);
}

/* Gradient Shift Animation */
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
.animate-gradient-shift {
  background-size: 200% 200%;
  animation: gradient-shift 8s ease infinite;
}

/* Pulse Glow for Premium Cards */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(61, 125, 93, 0.3); }
  50% { box-shadow: 0 0 30px rgba(61, 125, 93, 0.5); }
}
.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

/* Shimmer Loading Skeleton */
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(
    to right,
    hsl(var(--muted)) 0%,
    hsl(var(--muted-foreground) / 0.1) 20%,
    hsl(var(--muted)) 40%,
    hsl(var(--muted)) 100%
  );
  background-size: 1000px 100%;
}
```

### 1.2 Criar `src/components/LoadingSkeleton.tsx`
**Componente reutilizável para estados de carregamento**

```typescript
interface LoadingSkeletonProps {
  variant?: 'card' | 'list' | 'dashboard' | 'table' | 'page';
  count?: number;
}
```

**Variantes**:
- `card`: Skeleton de card (usado em Plans, Account)
- `list`: Items de lista (usado em logs)
- `dashboard`: Layout completo do Dashboard
- `table`: Linhas de tabela
- `page`: Skeleton de página inteira

### 1.3 Criar `src/components/EmptyState.tsx`
**Componente para estados vazios**

```typescript
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

**Uso**: Listas vazias, nenhum arquivo processado, sem notificações

### 1.4 Corrigir cores hardcoded

**Arquivo**: [src/components/ProcessingLog.tsx](src/components/ProcessingLog.tsx)
- Substituir `bg-slate-900` → `bg-[hsl(var(--color-log-bg))]`
- Substituir `text-slate-300` → `text-muted-foreground`

**Arquivo**: [src/components/PasswordStrengthIndicator.tsx](src/components/PasswordStrengthIndicator.tsx)
- Substituir `bg-green-500` → `bg-[hsl(var(--color-success-strong))]`
- Substituir `bg-yellow-500` → `bg-[hsl(var(--color-warning))]`

---

## FASE 2: Redesign do Header (6-8h)

### 2.1 Criar `src/components/SearchBar.tsx`
**Barra de pesquisa com Command Palette (Cmd+K)**

**Features**:
- Atalho: `Cmd+K` (Mac) / `Ctrl+K` (Windows)
- Busca em: Páginas, Ajuda, Arquivos processados (futuro)
- Resultados agrupados por categoria
- Navegação por teclado (setas + Enter)

**Componentes usados**: `Command` (shadcn/ui já disponível)

```typescript
const SearchBar = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Command>
      <CommandInput placeholder="Buscar..." />
      <CommandList>
        <CommandGroup heading="Páginas">
          <CommandItem>Dashboard</CommandItem>
          <CommandItem>Planos</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
};
```

### 2.2 Criar `src/components/NotificationBell.tsx`
**Sistema de notificações com badge de contador**

**Features**:
- Badge com número de notificações não lidas
- Popover ao clicar
- Tipos: Limite de uso atingido, upgrade disponível, sistema
- Marcar como lida
- Limpar todas

**Estado inicial** (mock para design):
```typescript
type Notification = {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  read: boolean;
  timestamp: Date;
};
```

**Componentes usados**: `Popover`, `Badge`, `ScrollArea`

### 2.3 Criar `src/components/LanguageSelector.tsx`
**Toggle de idioma PT/EN**

**Features**:
- Ícone de globo + idioma atual
- Dropdown com opções
- Salvar preferência em localStorage
- Preparar para i18n futuro (react-i18next)

**Componentes usados**: `DropdownMenu`, `Globe` icon

```typescript
const LanguageSelector = () => {
  const [lang, setLang] = useState<'pt' | 'en'>('pt');

  const toggleLanguage = (newLang: 'pt' | 'en') => {
    setLang(newLang);
    localStorage.setItem('language', newLang);
    // Futuro: i18n.changeLanguage(newLang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Globe className="w-4 h-4" />
        <span className="text-sm">{lang.toUpperCase()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => toggleLanguage('pt')}>
          Português
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleLanguage('en')}>
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

### 2.4 Redesign `src/components/NewHeader.tsx`
**Transformar em header minimalista com glassmorphism**

**Mudanças principais**:

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ [Logo]    [Search...]    [Nav]    [Notify][Lang][User]  │
└─────────────────────────────────────────────────────────┘
```

**Glassmorphism**:
```typescript
className="fixed top-0 w-full z-[var(--z-sticky)]
  bg-background/60 backdrop-blur-xl
  border-b border-border/40
  supports-[backdrop-filter]:bg-background/60"
```

**Navegação centralizada** (Desktop):
```typescript
<nav className="hidden md:flex items-center gap-1 mx-auto">
  <NavigationMenu>
    <NavigationMenuList>
      <NavigationMenuItem>
        <NavigationMenuLink
          className={cn(
            "group inline-flex h-9 w-max items-center justify-center rounded-md",
            "bg-transparent px-4 py-2 text-sm font-medium transition-all",
            "hover:bg-accent/50 hover:text-accent-foreground",
            "focus:bg-accent focus:text-accent-foreground focus:outline-none",
            "disabled:pointer-events-none disabled:opacity-50",
            "data-[active]:bg-primary/10 data-[active]:text-primary"
          )}
        >
          Início
        </NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</nav>
```

**Ações do usuário** (direita):
```typescript
<div className="hidden md:flex items-center gap-2">
  <SearchBar />
  <NotificationBell />
  <LanguageSelector />
  {user ? (
    <>
      <Badge variant={subscription?.plan === 'premium' ? 'default' : 'secondary'}>
        {subscription?.plan}
      </Badge>
      <Button variant="ghost" size="sm" onClick={() => navigate('/account')}>
        Conta
      </Button>
      <Button variant="ghost" size="sm" onClick={signOut}>
        Sair
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate('/plans')}>
        Planos
      </Button>
      <Button variant="default" size="sm" onClick={() => navigate('/auth')}>
        Entrar
      </Button>
    </>
  )}
</div>
```

**Mobile**: Mesmo Sheet, mas incluir SearchBar, NotificationBell, LanguageSelector no topo

### 2.5 Remover `src/components/Header.tsx`
**Deletar arquivo legado**

---

## FASE 3: Melhorias nas Páginas (12-16h)

### 3.1 Atualizar `src/pages/Index.tsx` (3-4h)
**Hero section moderno com gradiente animado**

**Hero Section**:
```typescript
<section className="relative py-20 md:py-28 lg:py-32 overflow-hidden">
  {/* Gradient Background Animado */}
  <div className="absolute inset-0 -z-10">
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-background animate-gradient-shift" />
  </div>

  {/* Content */}
  <div className="container px-4 sm:px-6 lg:px-8">
    <div className="max-w-4xl mx-auto text-center space-y-8">
      <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight">
        <span className="text-gradient-primary">
          Proteja suas planilhas
        </span>
        <br />
        com segurança profissional
      </h1>

      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
        Modifique automaticamente arquivos Excel com VBA,
        mantendo suas macros seguras e funcionais.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        {user ? (
          <Button size="lg" onClick={() => navigate('/dashboard')} className="hover-lift">
            Ir para Dashboard
          </Button>
        ) : (
          <Button size="lg" onClick={() => navigate('/auth')} className="hover-lift">
            Começar Gratuitamente
          </Button>
        )}
        <Button size="lg" variant="outline" onClick={() => navigate('/plans')} className="hover-lift">
          Ver Planos
        </Button>
      </div>
    </div>
  </div>
</section>
```

**Feature Cards** (com hover lift):
```typescript
<Card className="border-border/50 shadow-soft hover-lift transition-all duration-200">
  <CardContent className="pt-6 space-y-3">
    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <h3 className="text-lg font-semibold">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
  </CardContent>
</Card>
```

### 3.2 Atualizar `src/pages/Dashboard.tsx` (4-5h)
**Layout mais espaçoso com LoadingSkeleton**

**Mudanças**:

1. **Aumentar whitespace**:
   - `gap-4` → `gap-6`
   - `py-6` → `py-8`
   - `space-y-6` → `space-y-8`

2. **Usage Info Card** (melhorar visual):
```typescript
<Card className="border-border/50 shadow-soft bg-gradient-to-br from-background to-muted/20">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Info className="w-5 h-5 text-primary" />
      Informações de Uso
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Progress com gradiente */}
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Uso Mensal</span>
        <span className="font-medium">{used} / {limit}</span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  </CardContent>
</Card>
```

3. **Loading State** (substituir spinner):
```typescript
{isProcessing ? (
  <LoadingSkeleton variant="dashboard" />
) : (
  <FileDropzone ... />
)}
```

4. **StatisticsCard** (adicionar animação de entrada):
```typescript
<div className="animate-fade-in">
  <StatisticsCard statistics={result.statistics} />
</div>
```

### 3.3 Atualizar `src/pages/Plans.tsx` (3-4h)
**Cards de planos com hover effects e destaque Premium**

**Card Premium** (com brilho):
```typescript
<Card className={cn(
  "relative border-border/50 shadow-soft transition-all duration-300",
  "hover:scale-[1.02] hover:shadow-soft-lg hover:z-10",
  isPremium && "border-primary/50 animate-pulse-glow"
)}>
  {isPremium && (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
      <Badge className="bg-gradient-to-r from-primary to-accent text-white shadow-lg">
        Recomendado
      </Badge>
    </div>
  )}

  <CardHeader className="space-y-3">
    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto">
      <Icon className="w-8 h-8 text-primary" />
    </div>
    <CardTitle className="text-2xl text-center">{planName}</CardTitle>
  </CardHeader>

  {/* ... rest of card */}
</Card>
```

**Price Display** (com destaque):
```typescript
<div className="text-center space-y-1">
  <div className="flex items-baseline justify-center gap-1">
    <span className="text-4xl font-black text-primary">R$ {price}</span>
    <span className="text-muted-foreground">/mês</span>
  </div>
  {discount && (
    <div className="text-sm text-muted-foreground line-through">
      De R$ {originalPrice}
    </div>
  )}
</div>
```

### 3.4 Atualizar `src/pages/Auth.tsx` (2-3h)
**Form com glassmorphism e animações suaves**

**Card com glass effect**:
```typescript
<Card className="border-border/50 shadow-soft-lg bg-background/95 backdrop-blur-sm">
  <CardHeader className="space-y-3 text-center">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto">
      <ExcelIcon className="w-10 h-10 text-primary" />
    </div>
    <CardTitle className="text-2xl">Excel VBA Blocker</CardTitle>
    <CardDescription className="text-base">
      Proteja suas planilhas com segurança profissional
    </CardDescription>
  </CardHeader>

  <Tabs defaultValue="login" className="w-full">
    <TabsList className="grid w-full grid-cols-2">
      <TabsTrigger value="login" className="transition-all duration-200">
        Entrar
      </TabsTrigger>
      <TabsTrigger value="signup" className="transition-all duration-200">
        Cadastrar
      </TabsTrigger>
    </TabsList>

    {/* Tabs content com fade-in */}
    <TabsContent value="login" className="animate-fade-in space-y-4">
      {/* ... form fields */}
    </TabsContent>
  </Tabs>
</Card>
```

**Input com focus melhorado**:
```typescript
<Input
  type="email"
  className={cn(
    "transition-all duration-200",
    "focus:ring-2 focus:ring-primary/20 focus:border-primary"
  )}
/>
```

### 3.5 Atualizar `src/pages/Account.tsx` (2-3h)
**Grid layout com cards organizados**

**Layout em grid**:
```typescript
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Coluna 1: Informações Pessoais + Email */}
  <div className="space-y-6">
    <Card className="border-border/50 shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Informações Pessoais
        </CardTitle>
      </CardHeader>
      {/* ... content */}
    </Card>

    <Card className="border-border/50 shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Email
        </CardTitle>
      </CardHeader>
      {/* ... content */}
    </Card>
  </div>

  {/* Coluna 2: Senha + Plano */}
  <div className="space-y-6">
    <Card className="border-border/50 shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          Segurança
        </CardTitle>
      </CardHeader>
      {/* ... content */}
    </Card>

    <Card className="border-border/50 shadow-soft bg-gradient-to-br from-background to-muted/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Plano Atual
        </CardTitle>
      </CardHeader>
      {/* ... content com progress gradiente */}
    </Card>
  </div>
</div>
```

**Progress bar de uso** (com gradiente):
```typescript
<div className="relative h-2 bg-muted rounded-full overflow-hidden">
  <div
    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-primary transition-all duration-500"
    style={{ width: `${usagePercentage}%` }}
  />
</div>
```

---

## FASE 4: Micro-animações e Transições (4-6h)

### 4.1 Criar `src/hooks/usePageTransition.ts`
**Hook para transições entre páginas**

```typescript
export const usePageTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 300);
    return () => clearTimeout(timer);
  }, [location]);

  return isTransitioning;
};
```

### 4.2 Criar `src/components/PageTransition.tsx`
**Wrapper para animação de página**

```typescript
export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isTransitioning = usePageTransition();

  return (
    <div className={cn(
      "transition-opacity duration-300",
      isTransitioning ? "opacity-0" : "opacity-100"
    )}>
      {children}
    </div>
  );
};
```

### 4.3 Atualizar `src/components/FileDropzone.tsx`
**Adicionar hover scale**

```typescript
<div className={cn(
  "border-2 border-dashed rounded-lg transition-all duration-200",
  isDragging && "border-primary bg-primary/5 scale-[1.02]",
  !isDragging && "border-border hover:border-primary/50 hover:bg-primary/5"
)}>
```

### 4.4 Atualizar botões globalmente
**Adicionar micro-interações**

Criar utility class em `index.css`:
```css
.button-scale {
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.button-scale:active {
  transform: scale(0.95);
}
```

Aplicar em Button component (opcional) ou inline nas páginas.

---

## FASE 5: Refinamento e Limpeza (3-4h)

### 5.1 Dark Mode Improvements
**Melhorar contraste e sombras**

Em `src/index.css`:
```css
.dark {
  /* Aumentar contraste de textos */
  --foreground: 220 14% 98%; /* was 96% */

  /* Sombras mais sutis */
  .shadow-soft {
    box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.3),
                0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  /* Cards com borda sutil */
  .border-border\/50 {
    border-color: rgba(255, 255, 255, 0.05);
  }
}
```

### 5.2 Consolidar estilos inline
**Remover classes inline repetidas, criar utilities**

Exemplo:
- `className="flex items-center gap-2"` usado 50+ vezes
- Criar `.flex-center-gap` se apropriado
- Ou documentar padrão e manter inline (mais explícito)

### 5.3 Organizar imports
**Padrão consistente em todos os arquivos**

```typescript
// 1. React
import { useState, useEffect } from 'react';

// 2. Libraries
import { useNavigate, useLocation } from 'react-router-dom';

// 3. UI Components
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

// 4. Custom Components
import { NewHeader } from '@/components/NewHeader';
import { FileDropzone } from '@/components/FileDropzone';

// 5. Hooks
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';

// 6. Utils
import { cn } from '@/lib/utils';
import { processExcelFile } from '@/lib/excel-vba-modifier';

// 7. Types
import type { ProcessingResult } from '@/lib/types';
```

### 5.4 Acessibilidade Final
**Checklist**:
- [ ] Todos os ícones têm `aria-label` quando usados sozinhos
- [ ] Inputs têm labels associados
- [ ] Focus states visíveis (ring-2 ring-primary)
- [ ] Contraste de cores >= 4.5:1 (testar com ferramenta)
- [ ] Navegação por teclado funcional
- [ ] Screen reader friendly (testar com NVDA/VoiceOver)

### 5.5 Testes de Responsividade
**Breakpoints a testar**:
- [ ] 320px (iPhone SE)
- [ ] 375px (iPhone 12/13 Pro)
- [ ] 768px (iPad portrait)
- [ ] 1024px (iPad landscape)
- [ ] 1440px (Desktop padrão)
- [ ] 1920px (Full HD)

---

## ORDEM DE IMPLEMENTAÇÃO

### Sprint 1: Fundação (4-6h)
1. ✅ Atualizar `src/index.css` (tokens, z-index, animações)
2. ✅ Criar `src/components/LoadingSkeleton.tsx`
3. ✅ Criar `src/components/EmptyState.tsx`
4. ✅ Corrigir `src/components/ProcessingLog.tsx` (cores)
5. ✅ Corrigir `src/components/PasswordStrengthIndicator.tsx` (cores)

### Sprint 2: Header (6-8h)
6. ✅ Criar `src/components/SearchBar.tsx`
7. ✅ Criar `src/components/NotificationBell.tsx`
8. ✅ Criar `src/components/LanguageSelector.tsx`
9. ✅ Redesign `src/components/NewHeader.tsx` (glassmorphism + layout)
10. ✅ Deletar `src/components/Header.tsx`

### Sprint 3: Páginas Principais (7-9h)
11. ✅ Atualizar `src/pages/Index.tsx` (hero + features)
12. ✅ Atualizar `src/pages/Dashboard.tsx` (whitespace + loading)
13. ✅ Atualizar `src/pages/Plans.tsx` (cards premium)

### Sprint 4: Páginas Secundárias (4-6h)
14. ✅ Atualizar `src/pages/Auth.tsx` (glassmorphism)
15. ✅ Atualizar `src/pages/Account.tsx` (grid layout)

### Sprint 5: Animações (4-6h)
16. ✅ Criar `src/hooks/usePageTransition.ts`
17. ✅ Criar `src/components/PageTransition.tsx`
18. ✅ Atualizar `src/components/FileDropzone.tsx` (hover)
19. ✅ Adicionar button-scale utility

### Sprint 6: Refinamento (3-4h)
20. ✅ Dark mode improvements
21. ⬜ Consolidar estilos inline
22. ✅ Organizar imports (arquivos alterados)
23. ⬜ Acessibilidade checklist
24. ⬜ Testes de responsividade

**Total Estimado**: 28-39 horas

---

## ARQUIVOS CRÍTICOS

### Criar (10 arquivos novos):
- `src/components/SearchBar.tsx`
- `src/components/NotificationBell.tsx`
- `src/components/LanguageSelector.tsx`
- `src/components/LoadingSkeleton.tsx`
- `src/components/EmptyState.tsx`
- `src/components/PageTransition.tsx`
- `src/hooks/usePageTransition.ts`

### Modificar (9 arquivos):
- [src/index.css](src/index.css) - Design tokens e animações
- [src/components/NewHeader.tsx](src/components/NewHeader.tsx) - Redesign completo
- [src/components/ProcessingLog.tsx](src/components/ProcessingLog.tsx) - Padronizar cores
- [src/components/PasswordStrengthIndicator.tsx](src/components/PasswordStrengthIndicator.tsx) - Padronizar cores
- [src/components/FileDropzone.tsx](src/components/FileDropzone.tsx) - Hover effects
- [src/pages/Index.tsx](src/pages/Index.tsx) - Hero moderno
- [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) - Whitespace e loading
- [src/pages/Plans.tsx](src/pages/Plans.tsx) - Cards premium
- [src/pages/Auth.tsx](src/pages/Auth.tsx) - Glassmorphism
- [src/pages/Account.tsx](src/pages/Account.tsx) - Grid layout

### Deletar (1 arquivo):
- `src/components/Header.tsx` - Componente legado

---

## CONSIDERAÇÕES FINAIS

### Acessibilidade
- Manter foco visível em todos os elementos interativos
- ARIA labels em ícones standalone
- Contraste mínimo WCAG AA (4.5:1)
- Navegação por teclado completa
- Screen reader friendly

### Performance
- Lazy load de componentes pesados (Command palette)
- Debounce em search input
- Otimizar animações com `will-change` quando necessário
- Usar CSS transforms (não layout/paint)

### Responsividade
- Mobile-first approach mantido
- Touch targets >= 44px
- Breakpoints consistentes (sm: 640px, md: 768px, lg: 1024px)
- Teste em devices reais

### Manutenibilidade
- Componentes reutilizáveis e bem documentados
- Design tokens centralizados em `index.css`
- Padrões consistentes (imports, naming, estrutura)
- Comentários em lógica complexa

---

## RESULTADO ESPERADO

Ao final deste redesign, o Sheet Guardian terá:

✅ **Header minimalista** estilo Vercel/Linear com glassmorphism
✅ **Busca rápida** com Command Palette (Cmd+K)
✅ **Sistema de notificações** com badge contador
✅ **Seletor de idioma** PT/EN preparado para i18n
✅ **Design moderno** e espaçoso inspirado em Stripe/Notion
✅ **Micro-animações** suaves em hover, click, transitions
✅ **Loading states** profissionais com skeletons
✅ **Dark mode** aprimorado com melhor contraste
✅ **Sistema de cores** consistente sem hardcoded values
✅ **Acessibilidade** WCAG AA compliance
✅ **Responsividade** testada em 6 breakpoints

O resultado será uma aplicação **simples, funcional e visualmente atraente** que transmite **profissionalismo e confiança**.
