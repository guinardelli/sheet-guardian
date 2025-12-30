import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

type PlanName = 'free' | 'professional' | 'premium';

interface SubscriptionStatusProps {
  plan: PlanName;
  paymentStatus: string | null;
  stripeSubscriptionId: string | null;
  stripeProductId: string | null;
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodEnd?: string | null;
  isSyncing?: boolean;
}

export function SubscriptionStatus({
  plan,
  paymentStatus,
  stripeSubscriptionId,
  stripeProductId,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  isSyncing = false,
}: SubscriptionStatusProps) {
  const { t, i18n } = useTranslation();

  const PLAN_LABELS: Record<PlanName, string> = {
    free: t('plans.free'),
    professional: t('plans.professional'),
    premium: t('plans.premium'),
  };

  const isActive = paymentStatus === 'active' && Boolean(stripeSubscriptionId);
  const hasStripeContext = Boolean(stripeProductId || stripeSubscriptionId);
  const isPending = !isActive && (plan !== 'free' || hasStripeContext);
  const cancelDate = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const hasCancelDate = Boolean(cancelAtPeriodEnd && cancelDate && !Number.isNaN(cancelDate.getTime()));
  const daysRemaining = hasCancelDate && cancelDate
    ? Math.max(0, Math.ceil((cancelDate.getTime() - Date.now()) / 86400000))
    : null;
  const formattedCancelDate = hasCancelDate && cancelDate
    ? new Intl.DateTimeFormat(i18n.language === 'pt' ? 'pt-BR' : 'en-US').format(cancelDate)
    : null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">{t('subscriptionStatus.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('subscriptionStatus.plan')}: <Badge variant="secondary">{PLAN_LABELS[plan]}</Badge>
          </p>
        </div>
        {isActive ? (
          <CheckCircle className="h-6 w-6 text-green-500" />
        ) : isPending ? (
          <Clock className="h-6 w-6 text-yellow-500" />
        ) : (
          <XCircle className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      {hasCancelDate && formattedCancelDate && (
        <div className="mt-3 text-sm text-muted-foreground">
          {t('subscriptionStatus.scheduledCancel')} {formattedCancelDate}
          {typeof daysRemaining === 'number' ? ` (${daysRemaining} ${daysRemaining === 1 ? t('subscriptionStatus.day') : t('subscriptionStatus.days')})` : ''}.
        </div>
      )}

      {isPending && (
        <div className="mt-4">
          <p className="text-sm text-yellow-600">
            {isSyncing ? t('subscriptionStatus.syncing') : t('subscriptionStatus.pendingConfirmation')}
          </p>
        </div>
      )}
    </Card>
  );
}
