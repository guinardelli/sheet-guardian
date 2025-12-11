import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, SubscriptionPlan } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, QrCode, ArrowLeft, Loader2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { STRIPE_PLANS } from '@/lib/stripe';

const PLAN_INFO: Record<'free' | 'professional' | 'premium', {
  name: string;
  description: string;
  features: string[];
  extras: string[];
  currentPrice: number;
  originalPrice: number | null;
}> = {
  free: {
    name: 'Gratuito',
    description: 'Para experimentar',
    features: [
      '1 processamento por mês',
      'Tamanho máximo: 1 MB',
    ],
    extras: [],
    currentPrice: 0,
    originalPrice: null,
  },
  professional: {
    name: 'Profissional',
    description: 'Para uso regular',
    features: [
      '5 arquivos por semana',
      'Tamanho máximo: 1 MB',
    ],
    extras: [
      'Funcionalidades nativas',
    ],
    currentPrice: 32,
    originalPrice: 38,
  },
  premium: {
    name: 'Premium',
    description: 'Sem limitações',
    features: [
      'Processamentos ilimitados',
      'Sem limite de tamanho',
    ],
    extras: [
      'Suporte VIP',
      'Processamento prioritário',
    ],
    currentPrice: 38,
    originalPrice: 76,
  },
};

const AVAILABLE_PLANS: Array<'free' | 'professional' | 'premium'> = ['free', 'professional', 'premium'];

const Plans = () => {
  const { user, session } = useAuth();
  const { subscription, updatePlan, loading: subLoading, refetch } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  // Handle Stripe redirect
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      toast({
        title: "Pagamento realizado!",
        description: "Sua assinatura está sendo processada. Aguarde alguns instantes...",
      });
      // Check subscription status after successful payment
      checkStripeSubscription();
    } else if (canceled === 'true') {
      toast({
        title: "Pagamento cancelado",
        description: "O pagamento foi cancelado. Você pode tentar novamente quando quiser.",
        variant: "destructive",
      });
    }
  }, [searchParams]);

  const checkStripeSubscription = async () => {
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
          title: "Assinatura ativada!",
          description: `Você agora é assinante do plano ${PLAN_INFO[data.plan as keyof typeof PLAN_INFO]?.name || data.plan}.`,
        });
        await refetch();
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleSelectPlan = async (plan: 'free' | 'professional' | 'premium') => {
    if (!user) {
      toast({
        title: "Crie sua conta",
        description: `Crie uma conta gratuita para ${plan === 'free' ? 'começar a usar' : 'assinar o plano ' + PLAN_INFO[plan].name}.`,
      });
      navigate('/auth');
      return;
    }

    if (plan === 'free') {
      await updatePlan('free');
      toast({
        title: "Plano atualizado!",
        description: "Você está no plano Gratuito.",
      });
      navigate('/dashboard');
      return;
    }

    // For paid plans, redirect to Stripe Checkout
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
        // Open Stripe Checkout in new tab
        window.open(data.url, '_blank');
      } else {
        throw new Error('URL de checkout não recebida');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: "Erro ao processar pagamento",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!session?.access_token) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('URL do portal não recebida');
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast({
        title: "Erro ao abrir portal",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
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
          {checkingSubscription && (
            <p className="text-muted-foreground">Verificando assinatura...</p>
          )}
        </div>
      </div>
    );
  }

  const hasActiveSubscription = subscription?.plan && subscription.plan !== 'free' && subscription.payment_status === 'active';

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="max-w-5xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
            Planos
          </p>
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
            const isCurrentPlan = subscription?.plan === plan;
            const isPremium = plan === 'premium';
            const isFree = plan === 'free';

            return (
              <Card
                key={plan}
                className={`relative group transition-all duration-300 hover:shadow-soft-lg ${
                  isPremium
                    ? 'border-primary/50 shadow-soft-lg ring-1 ring-primary/20 scale-[1.02]'
                    : 'border-border/50 shadow-soft hover:border-primary/30'
                }`}
              >
                {isPremium && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary shadow-md px-4">
                    Recomendado
                  </Badge>
                )}

                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl font-bold tracking-tight">{info.name}</CardTitle>
                  <CardDescription className="text-sm">{info.description}</CardDescription>
                  <div className="mt-6 flex flex-col items-center gap-1">
                    {isFree ? (
                      <span className="text-4xl font-bold text-foreground">Grátis</span>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-foreground">
                            R$ {info.currentPrice}
                          </span>
                          <span className="text-muted-foreground text-sm">/mês</span>
                        </div>
                        {info.originalPrice && (
                          <span className="text-base text-muted-foreground line-through">
                            R$ {info.originalPrice}
                          </span>
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
                    className={`w-full h-11 ${isPremium && !isCurrentPlan ? 'shadow-soft' : ''}`}
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
                    ) : (subscription && subscription.plan !== 'free' && plan !== 'free') ? (
                      'Trocar Plano'
                    ) : (
                      plan === 'free' ? 'Mudar para Gratuito' : 'Fazer Upgrade'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Manage Subscription Button */}
        {hasActiveSubscription && (
          <div className="flex justify-center mb-10">
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={processing}
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
  );
};

export default Plans;
