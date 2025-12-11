import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, PLAN_LIMITS, SubscriptionPlan } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, QrCode, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

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
  const { user } = useAuth();
  const { subscription, updatePlan, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleSelectPlan = (plan: 'free' | 'professional' | 'premium') => {
    if (!user) {
      toast({
        title: "Crie sua conta",
        description: `Crie uma conta gratuita para ${plan === 'free' ? 'começar a usar' : 'assinar o plano ' + PLAN_INFO[plan].name}.`,
      });
      navigate('/auth');
      return;
    }

    if (plan === 'free') {
      // Free plan - just update directly
      updatePlan('free');
      toast({
        title: "Plano atualizado!",
        description: "Você está no plano Gratuito.",
      });
      navigate('/dashboard');
      return;
    }

    setSelectedPlan(plan);
    setShowPaymentDialog(true);
  };

  const handlePayment = async () => {
    if (!selectedPlan) return;

    setProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await updatePlan(selectedPlan);
    setProcessing(false);
    setShowPaymentDialog(false);
    
    toast({
      title: "Pagamento confirmado!",
      description: `Você agora é assinante do plano ${PLAN_INFO[selectedPlan as keyof typeof PLAN_INFO]?.name || selectedPlan}.`,
    });
    navigate('/dashboard');
  };

  if (subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                    {isCurrentPlan
                      ? 'Plano Atual'
                      : !user
                        ? (isFree ? 'Criar Conta Grátis' : 'Criar Conta')
                        : (subscription && subscription.plan !== 'free' && plan !== 'free')
                          ? 'Trocar Plano'
                          : (plan === 'free' ? 'Mudar para Gratuito' : 'Fazer Upgrade')}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

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

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Finalizar Pagamento</DialogTitle>
            <DialogDescription className="text-base">
              {selectedPlan && PLAN_INFO[selectedPlan as keyof typeof PLAN_INFO] && (
                `Plano ${PLAN_INFO[selectedPlan as keyof typeof PLAN_INFO].name} - R$ ${PLAN_INFO[selectedPlan as keyof typeof PLAN_INFO].currentPrice}/mês`
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Forma de Pagamento</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as 'pix' | 'credit_card')}
                className="gap-3"
              >
                <div className={`flex items-center space-x-3 p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'pix' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <RadioGroupItem value="pix" id="pix" />
                  <Label htmlFor="pix" className="flex items-center gap-2.5 cursor-pointer flex-1 font-medium">
                    <QrCode className="h-5 w-5 text-muted-foreground" />
                    PIX
                  </Label>
                </div>
                <div className={`flex items-center space-x-3 p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'credit_card' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <RadioGroupItem value="credit_card" id="credit_card" />
                  <Label htmlFor="credit_card" className="flex items-center gap-2.5 cursor-pointer flex-1 font-medium">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    Cartão de Crédito
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {paymentMethod === 'pix' && (
              <div className="bg-muted/50 p-4 rounded-xl text-center">
                <p className="text-sm text-muted-foreground">
                  Clique em confirmar para gerar o QR Code do PIX
                </p>
              </div>
            )}

            {paymentMethod === 'credit_card' && (
              <div className="bg-muted/50 p-4 rounded-xl text-center">
                <p className="text-sm text-muted-foreground">
                  Você será redirecionado para o checkout seguro
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
              className="flex-1 h-11"
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePayment}
              disabled={processing}
              className="flex-1 h-11 shadow-soft"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Pagamento'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Plans;
