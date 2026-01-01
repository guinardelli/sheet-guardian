import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CreditCard,
  Crown,
  FileSpreadsheet,
  Loader2,
  QrCode,
  Settings,
  Trophy,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import { NewHeader } from '@/components/NewHeader';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';

import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement';
import { useToast } from '@/hooks/use-toast';

import { supabase } from '@/services/supabase/client';
import { logger } from '@/lib/logger';
import { PLANS_CONFIG, AVAILABLE_PLANS, STRIPE_PLANS } from '@/config/plans';
import { cn } from '@/lib/utils';

interface PlanInfo {
  name: string;
  description: string;
  features: string[];
  extras: string[];
  currentPrice: number;
  originalPrice: number | null;
  periodLabel?: string;
  recommended?: boolean;
}

type PlanId = 'free' | 'professional' | 'premium' | 'anual';

const PLAN_ICONS: Record<PlanId, typeof Crown> = {
  free: FileSpreadsheet,
  professional: Zap,
  premium: Crown,
  anual: Trophy,
};

const buildPlanInfo = (t: (key: string) => string): Record<PlanId, PlanInfo> => {
  return Object.fromEntries(
    Object.entries(PLANS_CONFIG).map(([id, config]) => [
      id,
      {
        name: t(config.i18n.nameKey),
        description: t(config.i18n.descriptionKey),
        features: config.i18n.featureKeys.map((k) => t(k)),
        extras: config.i18n.extraKeys.map((k) => t(k)),
        currentPrice: config.pricing.current,
        originalPrice: config.pricing.original,
        periodLabel: config.pricing.period === 'year' ? t('plansPage.perYear') : t('plansPage.perMonth'),
        recommended: config.recommended,
      },
    ]),
  ) as Record<PlanId, PlanInfo>;
};

const Plans = () => {
  const { t } = useTranslation();
  const { user, session } = useAuth();
  const {
    subscription,
    updatePlan,
    loading: subLoading,
    refetch,
    syncSubscription,
    isSyncing,
    syncError,
  } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openCustomerPortal, loading: portalLoading } = useSubscriptionManagement();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(false);
  const [autoVerifyError, setAutoVerifyError] = useState<string | null>(null);
  const [isAutoVerifying, setIsAutoVerifying] = useState(false);
  const autoVerifyStartedRef = useRef(false);

  const PLAN_INFO = buildPlanInfo(t);

  const verifySubscriptionWithRetry = useCallback(async (): Promise<boolean> => {
    setAutoVerifyError(null);

    const initialCheck = await syncSubscription(true);
    if (initialCheck) {
      return true;
    }

    const delays = [3000, 5000, 8000, 12000, 20000];

    for (const delay of delays) {
      await new Promise((resolve) => setTimeout(resolve, delay));

      const verified = await syncSubscription(true);
      if (verified) {
        return true;
      }
    }

    setAutoVerifyError(t('plansPage.messages.autoVerifyError'));
    return false;
  }, [syncSubscription, t]);

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true' && !autoVerifyStartedRef.current) {
      autoVerifyStartedRef.current = true;
      setIsAutoVerifying(true);
      setAutoVerifyError(null);
      toast({
        title: t('plansPage.messages.paymentSuccess'),
        description: t('plansPage.messages.paymentSuccessDesc'),
      });

      const verifyWithRetry = async () => {
        const verified = await verifySubscriptionWithRetry();
        setIsAutoVerifying(false);
        if (verified) {
          toast({
            title: t('plansPage.messages.subscriptionActivated'),
            description: t('plansPage.messages.subscriptionActivatedDesc'),
          });
        }
      };

      verifyWithRetry();
    } else if (canceled === 'true') {
      toast({
        title: t('plansPage.messages.paymentCanceled'),
        description: t('plansPage.messages.paymentCanceledDesc'),
        variant: 'destructive',
      });
    }
  }, [searchParams, verifySubscriptionWithRetry, toast, t]);

  const handleSelectPlan = async (plan: PlanId) => {
    if (!user) {
      toast({
        title: t('plansPage.messages.createAccountPrompt'),
        description: plan === 'free'
          ? t('plansPage.messages.createAccountToStart')
          : `${t('plansPage.messages.createAccountForPlan')} ${PLAN_INFO[plan].name}.`,
      });
      navigate('/auth');
      return;
    }

    if (plan === 'free') {
      try {
        if (!subscription) {
          toast({
            title: t('plansPage.messages.creatingSubscription'),
            description: t('plansPage.messages.creatingSubscriptionDesc'),
          });

          const created = await refetch();
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const refreshed = await refetch();
          const resolved = refreshed ?? created;

          if (!resolved) {
            throw new Error(t('plansPage.messages.autoVerifyError'));
          }
        }

        const result = await updatePlan('free');
        if (!result.success) {
          throw new Error(result.error || t('plansPage.messages.errorSwitchingPlan'));
        }
        toast({
          title: t('plansPage.messages.planUpdated'),
          description: t('plansPage.messages.planUpdatedDesc'),
        });
        navigate('/dashboard');
      } catch (error) {
        const message = error instanceof Error ? error.message : t('common.error');
        logger.error('Error switching to free plan', error, { userId: user.id });
        toast({
          title: t('plansPage.messages.errorSwitchingPlan'),
          description: message,
          variant: 'destructive',
        });
      }
      return;
    }
    setProcessing(true);
    try {
      const priceId = STRIPE_PLANS[plan].price_id;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('URL de checkout não recebida');
      }
    } catch (error: unknown) {
      logger.error('Checkout error', error);
      const message = error instanceof Error ? error.message : t('common.error');
      toast({
        title: t('plansPage.messages.checkoutError'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const hasActiveSubscription =
    subscription?.plan && subscription.plan !== 'free' && subscription.payment_status === 'active';

  return (
    <div className="min-h-screen bg-background pt-20">
      <NewHeader />
      <div className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>

          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">{t('plansPage.title')}</p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5 tracking-tight">
              {t('plansPage.heading')}
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
              {t('plansPage.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-10">
            {AVAILABLE_PLANS.map((plan) => {
              const info = PLAN_INFO[plan];
              const Icon = PLAN_ICONS[plan];
              const isCurrentPlan = subscription?.plan === plan;
              const isRecommended = Boolean(info.recommended);
              const isFree = plan === 'free';
              const periodLabel = info.periodLabel ?? t('plansPage.perMonth');

              return (
                <Card
                  key={plan}
                  className={cn(
                    'relative border-border/50 shadow-soft transition-all duration-300',
                    'hover:scale-[1.02] hover:shadow-soft-lg hover:z-10',
                    isRecommended && 'border-primary/50 animate-pulse-glow',
                  )}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-primary to-accent text-white shadow-lg">
                        {t('plansPage.recommended')}
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="space-y-3 text-center pb-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">{info.name}</CardTitle>
                    <CardDescription>{info.description}</CardDescription>

                    <div className="text-center space-y-1 pt-2">
                      {isFree ? (
                        <span className="text-4xl font-black text-primary">{t('plansPage.free')}</span>
                      ) : (
                        <>
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-4xl font-black text-primary">R$ {info.currentPrice}</span>
                            <span className="text-muted-foreground">{periodLabel}</span>
                          </div>
                          {info.originalPrice && (
                            <div className="text-sm text-muted-foreground line-through">
                              {t('plansPage.originalPrice')} {info.originalPrice}
                            </div>
                          )}
                          {info.originalPrice && (
                            <Badge variant="secondary" className="mt-2 font-semibold">
                              {Math.round((1 - info.currentPrice / info.originalPrice) * 100)}% {t('plansPage.off')}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5 pt-2">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">{t('plansPage.limits')}</p>
                      <ul className="space-y-2.5">
                        {info.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2.5">
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Check className="h-3 w-3 text-primary" />
                            </div>
                            <span className="text-sm text-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {info.extras.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">{t('plansPage.extras')}</p>
                        <ul className="space-y-2.5">
                          {info.extras.map((extra, index) => (
                            <li key={index} className="flex items-center gap-2.5">
                              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Check className="h-3 w-3 text-primary" />
                              </div>
                              <span className="text-sm text-foreground">{extra}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-4">
                    <Button
                      className={cn('w-full h-11', isRecommended && !isCurrentPlan && 'shadow-soft')}
                      variant={isCurrentPlan ? 'outline' : 'default'}
                      disabled={isCurrentPlan || processing}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('common.processing')}
                        </>
                      ) : isCurrentPlan ? (
                        t('plansPage.currentPlan')
                      ) : !user ? (
                        isFree ? t('plansPage.createFreeAccount') : t('plansPage.createAccount')
                      ) : subscription && subscription.plan !== 'free' && plan !== 'free' ? (
                        t('plansPage.changePlan')
                      ) : plan === 'free' ? (
                        t('plansPage.switchToFree')
                      ) : (
                        t('plansPage.doUpgrade')
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {subscription && (
            <div className="mb-10 space-y-4">
              <SubscriptionStatus
                plan={subscription.plan}
                paymentStatus={subscription.payment_status}
                stripeSubscriptionId={subscription.stripe_subscription_id ?? null}
                stripeProductId={subscription.stripe_product_id ?? null}
                cancelAtPeriodEnd={subscription.cancel_at_period_end ?? null}
                currentPeriodEnd={subscription.current_period_end ?? null}
                isSyncing={isAutoVerifying || isSyncing}
              />
              {(autoVerifyError || syncError) && !isAutoVerifying && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{autoVerifyError ?? syncError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {isAutoVerifying && (
            <Alert className="mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>{t('plansPage.syncingSubscription')}</AlertDescription>
            </Alert>
          )}

          {hasActiveSubscription && (
            <div className="flex justify-center mb-10">
              <Button
                variant="outline"
                onClick={openCustomerPortal}
                disabled={portalLoading || processing}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                {t('plansPage.manageSubscription')}
              </Button>
            </div>
          )}

          <div className="bg-card rounded-xl p-6 border border-border/50 shadow-soft">
            <h2 className="text-base font-semibold text-foreground mb-4">{t('plansPage.paymentMethods')}</h2>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <QrCode className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{t('plansPage.pix')}</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <CreditCard className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{t('plansPage.creditCard')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Plans;

