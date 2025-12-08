import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, PLAN_LIMITS, PLAN_PRICES, SubscriptionPlan } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, QrCode, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const PLAN_INFO: Record<SubscriptionPlan, { name: string; description: string; features: string[] }> = {
  free: {
    name: 'Gratuito',
    description: 'Para testes simples',
    features: [
      '1 planilha por mês',
      'Tamanho máximo: 100 KB',
      'Apenas para testes',
    ],
  },
  professional: {
    name: 'Profissional',
    description: 'Para uso regular',
    features: [
      '5 planilhas por dia',
      'Tamanho máximo: 1.000 KB',
      'Suporte prioritário',
    ],
  },
  premium: {
    name: 'Premium',
    description: 'Sem limitações',
    features: [
      'Planilhas ilimitadas',
      'Sem limite de tamanho',
      'Suporte VIP',
      'Processamento prioritário',
    ],
  },
};

const Plans = () => {
  const { user } = useAuth();
  const { subscription, updatePlan, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (plan === 'free') {
      handleFreePlan();
      return;
    }

    setSelectedPlan(plan);
    setShowPaymentDialog(true);
  };

  const handleFreePlan = async () => {
    setProcessing(true);
    await updatePlan('free');
    setProcessing(false);
    toast({
      title: "Plano atualizado",
      description: "Você está agora no plano Gratuito.",
    });
    navigate('/');
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
      description: `Você agora é assinante do plano ${PLAN_INFO[selectedPlan].name}.`,
    });
    navigate('/');
  };

  if (subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Escolha seu Plano
          </h1>
          <p className="text-muted-foreground text-lg">
            Selecione o plano ideal para suas necessidades
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {(Object.keys(PLAN_INFO) as SubscriptionPlan[]).map((plan) => {
            const info = PLAN_INFO[plan];
            const price = PLAN_PRICES[plan];
            const isCurrentPlan = subscription?.plan === plan;

            return (
              <Card 
                key={plan} 
                className={`relative ${plan === 'professional' ? 'border-primary shadow-lg' : ''}`}
              >
                {plan === 'professional' && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Mais Popular
                  </Badge>
                )}
                
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{info.name}</CardTitle>
                  <CardDescription>{info.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">
                      {price === 0 ? 'Grátis' : `R$ ${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-muted-foreground">/mês</span>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3">
                    {info.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={isCurrentPlan ? 'outline' : 'default'}
                    disabled={isCurrentPlan || processing}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {isCurrentPlan ? 'Plano Atual' : 'Selecionar'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="bg-card rounded-lg p-6 border">
          <h2 className="text-lg font-semibold mb-4">Formas de Pagamento</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <QrCode className="h-5 w-5" />
              <span>PIX</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CreditCard className="h-5 w-5" />
              <span>Cartão de Crédito (físico)</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            * Não aceitamos cartões virtuais
          </p>
        </div>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Pagamento</DialogTitle>
            <DialogDescription>
              {selectedPlan && `Plano ${PLAN_INFO[selectedPlan].name} - R$ ${PLAN_PRICES[selectedPlan]}/mês`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Label>Forma de Pagamento</Label>
              <RadioGroup 
                value={paymentMethod} 
                onValueChange={(v) => setPaymentMethod(v as 'pix' | 'credit_card')}
              >
                <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="pix" id="pix" />
                  <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer flex-1">
                    <QrCode className="h-5 w-5" />
                    PIX
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="credit_card" id="credit_card" />
                  <Label htmlFor="credit_card" className="flex items-center gap-2 cursor-pointer flex-1">
                    <CreditCard className="h-5 w-5" />
                    Cartão de Crédito (físico)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                * Cartões virtuais não são aceitos
              </p>
            </div>

            {paymentMethod === 'pix' && (
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Clique em confirmar para gerar o QR Code do PIX
                </p>
              </div>
            )}

            {paymentMethod === 'credit_card' && (
              <div className="bg-muted p-4 rounded-lg text-center">
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
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handlePayment}
              disabled={processing}
              className="flex-1"
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
