import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CreditCard, Crown, FileSpreadsheet, Loader2, QrCode, Settings, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import { NewHeader } from '@/components/NewHeader';

import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement';
import { useToast } from '@/hooks/use-toast';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { STRIPE_PLANS } from '@/lib/stripe';
import { cn } from '@/lib/utils';

const PLAN_INFO: Record<
  'free' | 'professional' | 'premium',
  {
    name: string;
    description: string;
    features: string[];
    extras: string[];
    currentPrice: number;
    originalPrice: number | null;
  }
> = {
  free: {
    name: 'Gratuito',
    description: 'Para experimentar',
    features: ['1 processamento por mês', 'Tamanho máximo: 1 MB'],
    extras: [],
    currentPrice: 0,
    originalPrice: null,
  },
  professional: {
    name: 'Profissional',
    description: 'Para uso regular',
    features: ['5 arquivos por semana', 'Tamanho máximo: 1 MB'],
    extras: ['Funcionalidades nativas'],
    currentPrice: 32,
    originalPrice: 38,
  },
  premium: {
    name: 'Premium',
    description: 'Sem limitações',
    features: ['Processamentos ilimitados', 'Sem limite de tamanho'],
    extras: ['Suporte VIP', 'Processamento prioritário'],
    currentPrice: 38,
    originalPrice: 76,
  },
};

const PLAN_ICONS = {
  free: FileSpreadsheet,
  professional: Zap,
  premium: Crown,
};

const AVAILABLE_PLANS: Array<'free' | 'professional' | 'premium'> = [
  'free',
  'professional',
  'premium',
];

const Plans = () => {
  const { user, session } = useAuth();
  const { subscription, updatePlan, loading: subLoading, refetch } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openCustomerPortal, loading: portalLoading } = useSubscriptionManagement();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  const checkStripeSubscription = useCallback(async () => {
    if (!session?.access_token) return;

    setCheckingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.subscribed) {
        toast({
          title: 'Assinatura ativada!',
          description: `Você agora é assinante do plano ${
            PLAN_INFO[data.plan as keyof typeof PLAN_INFO]?.name || data.plan
          }.`,
        });
        await refetch();
      }
    } catch (error) {
      logger.error('Error checking subscription', error);
    } finally {
      setCheckingSubscription(false);
    }
  }, [session?.access_token, refetch, toast]);

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      toast({
        title: 'Pagamento realizado!',
        description: 'Sua assinatura está sendo processada. Aguarde alguns instantes...',
      });
      checkStripeSubscription();
    } else if (canceled === 'true') {
      toast({
        title: 'Pagamento cancelado',
        description: 'O pagamento foi cancelado. Você pode tentar novamente quando quiser.',
        variant: 'destructive',
      });
    }
  }, [searchParams, checkStripeSubscription, toast]);

  const handleSelectPlan = async (plan: 'free' | 'professional' | 'premium') => {
    if (!user) {
      toast({
        title: 'Crie sua conta',
        description: `Crie uma conta gratuita para ${
          plan === 'free' ? 'começar a usar' : `assinar o plano ${PLAN_INFO[plan].name}`
        }.`,
      });
      navigate('/auth');
      return;
    }

    if (plan === 'free') {
      try {
        const result = await updatePlan('free');
        if (!result.success) {
          throw new Error(result.error || 'Erro ao atualizar plano gratuito');
        }
        toast({
          title: 'Plano atualizado!',
          description: 'Você está no plano Gratuito.',
        });
        navigate('/dashboard');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tente novamente mais tarde.';
        toast({
          title: 'Erro ao mudar para plano gratuito',
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
      const message = error instanceof Error ? error.message : 'Tente novamente mais tarde.';
      toast({
        title: 'Erro ao processar pagamento',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (subLoading || checkingSubscription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          {checkingSubscription && <p className="text-muted-foreground">Verificando assinatura...</p>}
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
            Voltar
          </Button>

          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Planos</p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5 tracking-tight">
              Escolha seu Plano
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
              Selecione o plano ideal para suas necessidades
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-10">
            {AVAILABLE_PLANS.map((plan) => {
              const info = PLAN_INFO[plan];
              const Icon = PLAN_ICONS[plan];
              const isCurrentPlan = subscription?.plan === plan;
              const isPremium = plan === 'premium';
              const isFree = plan === 'free';

              return (
                <Card
                  key={plan}
                  className={cn(
                    'relative border-border/50 shadow-soft transition-all duration-300',
                    'hover:scale-[1.02] hover:shadow-soft-lg hover:z-10',
                    isPremium && 'border-primary/50 animate-pulse-glow',
                  )}
                >
                  {isPremium && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-primary to-accent text-white shadow-lg">
                        Recomendado
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
                        <span className="text-4xl font-black text-primary">Grátis</span>
                      ) : (
                        <>
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-4xl font-black text-primary">R$ {info.currentPrice}</span>
                            <span className="text-muted-foreground">/mês</span>
                          </div>
                          {info.originalPrice && (
                            <div className="text-sm text-muted-foreground line-through">
                              De R$ {info.originalPrice}
                            </div>
                          )}
                          {info.originalPrice && (
                            <Badge variant="secondary" className="mt-2 font-semibold">
                              {Math.round((1 - info.currentPrice / info.originalPrice) * 100)}% OFF
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5 pt-2">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Limites</p>
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
                        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Adicionais</p>
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
                      className={cn('w-full h-11', isPremium && !isCurrentPlan && 'shadow-soft')}
                      variant={isCurrentPlan ? 'outline' : 'default'}
                      disabled={isCurrentPlan || processing}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : isCurrentPlan ? (
                        'Plano Atual'
                      ) : !user ? (
                        isFree ? 'Criar Conta Grátis' : 'Criar Conta'
                      ) : subscription && subscription.plan !== 'free' && plan !== 'free' ? (
                        'Trocar Plano'
                      ) : plan === 'free' ? (
                        'Mudar para Gratuito'
                      ) : (
                        'Fazer Upgrade'
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {hasActiveSubscription && (
            <div className="flex justify-center mb-10">
              <Button
                variant="outline"
                onClick={openCustomerPortal}
                disabled={portalLoading || processing}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Gerenciar Assinatura
              </Button>
            </div>
          )}

          <div className="bg-card rounded-xl p-6 border border-border/50 shadow-soft">
            <h2 className="text-base font-semibold text-foreground mb-4">Formas de Pagamento Aceitas</h2>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <QrCode className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">PIX</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <CreditCard className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Cartão de Crédito</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Plans;
