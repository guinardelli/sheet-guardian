# Plano de Reestruturação - Sheet Guardian

## Resumo Executivo

Este plano detalha a implementação de:
1. Novas regras de negócio para planos de assinatura
2. Atualização visual da página de Planos com novo plano Anual
3. Ajustes de navegação no Header
4. Correção de erro de validação de arquivos

---

## Fase 1: Atualização das Regras de Negócio (Backend)

### 1.1 Atualizar PLAN_LIMITS no Cliente
**Arquivo**: `src/hooks/useSubscription.tsx` (linhas 46-50)

```typescript
// DE:
const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free:         { sheetsPerWeek: null, sheetsPerMonth: 1, maxFileSizeMB: 1 },
  professional: { sheetsPerWeek: 5, sheetsPerMonth: null, maxFileSizeMB: 1 },
  premium:      { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
};

// PARA:
const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free:         { sheetsPerWeek: null, sheetsPerMonth: 2, maxFileSizeMB: 1 },
  professional: { sheetsPerWeek: 5, sheetsPerMonth: null, maxFileSizeMB: 3 },
  premium:      { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
};
```

### 1.2 Atualizar PLAN_LIMITS no Servidor
**Arquivo**: `supabase/functions/validate-processing/index.ts` (linhas 22-26)

```typescript
// DE:
const PLAN_LIMITS = {
  free:         { sheetsPerWeek: null, sheetsPerMonth: 1, maxFileSizeMB: 1 },
  professional: { sheetsPerWeek: 5, sheetsPerMonth: null, maxFileSizeMB: 1 },
  premium:      { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
};

// PARA:
const PLAN_LIMITS = {
  free:         { sheetsPerWeek: null, sheetsPerMonth: 2, maxFileSizeMB: 1 },
  professional: { sheetsPerWeek: 5, sheetsPerMonth: null, maxFileSizeMB: 3 },
  premium:      { sheetsPerWeek: null, sheetsPerMonth: null, maxFileSizeMB: null },
};
```

### 1.3 Simplificação: Anual = Premium no Banco

**DECISÃO**: O plano anual será registrado como "premium" no banco de dados.
- **Motivo**: Usa o mesmo product_id do Stripe (`prod_TaJsysi99Q1g2J`)
- **Benefício**: Sem necessidade de migration ou alteração no webhook
- **Resultado**: Anual é apenas uma opção de faturamento (yearly vs monthly)

---

## Fase 2: Interface de Planos e Preços (Frontend)

### 2.1 Atualizar Constantes Stripe
**Arquivo**: `src/lib/stripe.ts`

Adicionar price_id do plano anual:
```typescript
export const STRIPE_PLANS = {
  professional: {
    product_id: 'prod_TaJslOsZAWnhcN',
    price_id: 'price_1Sd9EhJkxX3Me4wlrU22rZwM',
  },
  premium: {
    product_id: 'prod_TaJsysi99Q1g2J',
    price_id: 'price_1Sd9F5JkxX3Me4wl1xNRb5Kh',
  },
  anual: {
    product_id: 'prod_TaJsysi99Q1g2J', // Mesmo produto do premium
    price_id: 'NOVO_PRICE_ID_ANUAL',   // Novo price_id a ser criado no Stripe
  },
} as const;
```

> **ATENÇÃO**: Será necessário criar o preço anual no Stripe Dashboard com valor R$ 612,00.

### 2.2 Atualizar Página de Planos
**Arquivo**: `src/pages/Plans.tsx`

#### Alterações de Preço:
- **Premium**: R$ 38 → R$ 68/mês
- **Novo Card Anual**: R$ 612/ano (equivale a 9 meses, 3 grátis)
- **Professional**: Atualizar descrição de limite de arquivo para "Até 3MB"
- **Free**: Atualizar descrição para "2 processamentos por mês"

#### Estrutura do Novo Card Anual:
```typescript
{
  id: 'anual',
  name: 'Anual',
  price: 612,
  period: '/ano',
  icon: Star, // ou Trophy
  features: [
    'Processamentos ilimitados',
    'Sem limite de tamanho',
    'Suporte VIP',
    'Processamento prioritário',
    '3 meses grátis (pague 9, leve 12)',
  ],
  recommended: true, // Destacar como melhor valor
}
```

### 2.3 Atualizar Traduções
**Arquivos**: `src/locales/pt.json` e `src/locales/en.json`

Adicionar novas chaves para plano anual e atualizar descrições existentes.

---

## Fase 3: Ajustes de Navegação (Header)

### 3.1 Adicionar Link para Dashboard
**Arquivo**: `src/components/NewHeader.tsx` (linhas 33-36)

```typescript
// DE:
const navItems = [
  { name: t('header.home'), path: '/' },
  { name: t('header.plans'), path: '/plans' },
];

// PARA:
const navItems = [
  { name: t('header.home'), path: '/' },
  { name: t('header.dashboard'), path: '/dashboard' },
  { name: t('header.plans'), path: '/plans' },
];
```

### 3.2 Remover Badge do Plano
**Arquivo**: `src/components/NewHeader.tsx` (linhas 96-100)

Remover o bloco:
```typescript
{subscription && (
  <Badge variant={subscription.plan === 'premium' ? 'default' : 'secondary'}>
    {PLAN_NAMES[subscription.plan]}
  </Badge>
)}
```

### 3.3 Atualizar Traduções do Header
**Arquivos**: `src/locales/pt.json` e `src/locales/en.json`

Adicionar chave `header.dashboard`:
```json
{
  "header": {
    "home": "Início",
    "dashboard": "Dashboard",
    "plans": "Planos"
  }
}
```

---

## Fase 4: Correção de Erro de Validação

### 4.1 Analisar Suporte a .xls

**Decisão Técnica**: O projeto processa arquivos .xlsm extraindo o vbaProject.bin como ZIP. Arquivos .xls (formato binário BIFF8) NÃO podem ser processados da mesma forma, pois não são arquivos ZIP.

**Ação**: Manter suporte apenas para .xlsm, mas melhorar a mensagem de erro para informar explicitamente que .xls não é suportado.

### 4.2 Melhorar Mensagens de Erro
**Arquivos**: `src/locales/pt.json` e `src/locales/en.json`

Atualizar mensagem de erro de extensão:
```json
{
  "dropzone": {
    "errors": {
      "invalidType": "Tipo de arquivo não suportado",
      "invalidTypeDesc": "Apenas arquivos .xlsm são aceitos. Arquivos .xls (formato antigo) não são suportados. Por favor, salve seu arquivo como .xlsm no Excel.",
      "xlsNotSupported": "Arquivos .xls (Excel 97-2003) não são suportados. Por favor, abra o arquivo no Excel e salve como .xlsm (Pasta de Trabalho Habilitada para Macro)."
    }
  }
}
```

### 4.3 Melhorar Tratamento de Erro no FileDropzone
**Arquivo**: `src/components/FileDropzone.tsx`

Atualizar validação de extensão para fornecer mensagem mais específica quando for .xls:

```typescript
const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;

if (!ALLOWED_FILE_EXTENSIONS.includes(extension as any)) {
  const isXls = extension === '.xls';
  toast.error(t('dropzone.errors.invalidType'), {
    description: isXls
      ? t('dropzone.errors.xlsNotSupported') // Nova chave
      : t('dropzone.errors.invalidTypeDesc'),
  });
  return false;
}
```

### 4.4 Verificar Tratamento de Erro na Edge Function
**Arquivo**: `supabase/functions/validate-processing/index.ts`

Garantir que erros 500 retornem mensagens descritivas:
- Adicionar try-catch global
- Retornar status 400 para erros de validação (não 500)
- Incluir código de erro específico para debugging

---

## Arquivos a Modificar

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/hooks/useSubscription.tsx` | Atualizar PLAN_LIMITS |
| `supabase/functions/validate-processing/index.ts` | Atualizar PLAN_LIMITS |
| `src/lib/stripe.ts` | Adicionar price_id anual |
| `src/pages/Plans.tsx` | Novo card + preços atualizados |
| `src/components/NewHeader.tsx` | Adicionar Dashboard + remover Badge |
| `src/components/FileDropzone.tsx` | Melhorar mensagem de erro .xls |
| `src/locales/pt.json` | Novas traduções |
| `src/locales/en.json` | Novas traduções |

---

## Dependências Externas (Ação Manual Necessária)

### Criar Preço Anual no Stripe Dashboard

1. Acesse o [Stripe Dashboard](https://dashboard.stripe.com/)
2. Vá em **Products** → Encontre o produto Premium (`prod_TaJsysi99Q1g2J`)
3. Clique em **Add a price**
4. Configure:
   - **Price**: R$ 612,00
   - **Billing period**: Yearly (anual)
   - **Price ID** será gerado automaticamente (ex: `price_xxx...`)
5. Copie o novo `price_id` gerado

### Variáveis de Ambiente

Adicionar ao `.env`:
```env
VITE_STRIPE_ANNUAL_PRICE_ID=price_XXXXXXXXX  # Copiar do Stripe Dashboard
```

---

## Ordem de Implementação Recomendada

1. **Criar Preço no Stripe** (manual): Antes de começar o código
2. **Backend**: Atualizar PLAN_LIMITS (cliente + servidor)
3. **Stripe Config**: Adicionar constantes do plano anual em stripe.ts
4. **Frontend**: Plans.tsx com novo card e preços atualizados
5. **Header**: Adicionar Dashboard + remover Badge
6. **Validação**: Melhorar mensagens de erro para .xls
7. **Traduções**: Atualizar pt.json e en.json
8. **Testes**: Validar fluxo completo de checkout

---

## Pontos de Atenção

1. **Price ID Anual**: Precisa ser criado no Stripe ANTES de implementar
2. **Webhook Stripe**: Já mapeia corretamente (produto premium = anual)
3. **Backwards Compatibility**: Usuários existentes não serão afetados
4. **Deploy Seguro**: Não requer migration - apenas deploy de código

---

## Decisões Confirmadas

- **Price ID Anual**: Criar no Stripe Dashboard (instruções acima)
- **Preço Professional**: Manter R$ 32/mês (apenas atualizar limite de 1MB → 3MB)
- **Produto Anual**: Usar mesmo product_id do Premium (`prod_TaJsysi99Q1g2J`)
- **Banco de Dados**: Anual será registrado como "premium" (sem migration necessária)

---

## Checklist de Implementação

- [ ] Criar preço anual no Stripe Dashboard
- [ ] Copiar price_id para `.env`
- [ ] Atualizar `src/hooks/useSubscription.tsx` - PLAN_LIMITS
- [ ] Atualizar `supabase/functions/validate-processing/index.ts` - PLAN_LIMITS
- [ ] Atualizar `src/lib/stripe.ts` - adicionar plano anual
- [ ] Atualizar `src/pages/Plans.tsx` - novo card + preços
- [ ] Atualizar `src/components/NewHeader.tsx` - Dashboard link + remover badge
- [ ] Atualizar `src/components/FileDropzone.tsx` - mensagem erro .xls
- [ ] Atualizar `src/locales/pt.json` - traduções
- [ ] Atualizar `src/locales/en.json` - traduções
- [ ] Testar fluxo de checkout (free → professional → premium → anual)
- [ ] Testar validação de arquivo .xls
- [ ] Deploy para produção
