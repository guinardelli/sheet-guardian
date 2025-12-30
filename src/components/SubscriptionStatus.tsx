import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

type PlanName = 'free' | 'professional' | 'premium';

interface SubscriptionStatusProps {
  plan: PlanName;
  paymentStatus: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripeProductId: string | null;
  onVerify: () => void;
  isVerifying?: boolean;
}

const PLAN_LABELS: Record<PlanName, string> = {
  free: 'Gratuito',
  professional: 'Profissional',
  premium: 'Premium',
};

export function SubscriptionStatus({
  plan,
  paymentStatus,
  stripeSubscriptionId,
  stripeCustomerId,
  stripeProductId,
  onVerify,
  isVerifying = false,
}: SubscriptionStatusProps) {
  const isActive = paymentStatus === 'active' && Boolean(stripeSubscriptionId);
  const hasStripeContext = Boolean(stripeCustomerId || stripeProductId || stripeSubscriptionId);
  const isPending = !isActive && (plan !== 'free' || hasStripeContext);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">Status da Assinatura</h3>
          <p className="text-sm text-muted-foreground">
            Plano: <Badge variant="secondary">{PLAN_LABELS[plan]}</Badge>
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

      {isPending && (
        <div className="mt-4">
          <p className="text-sm text-yellow-600">Assinatura pendente de confirmacao</p>
          <Button
            size="sm"
            variant="outline"
            onClick={onVerify}
            className="mt-2"
            disabled={isVerifying}
          >
            {isVerifying ? 'Verificando...' : 'Verificar Assinatura'}
          </Button>
        </div>
      )}
    </Card>
  );
}
