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

const PLAN_INFO: Record<'professional' | 'premium', { 
  name: string; 
  description: string; 
  features: string[];
  extras: string[];
  currentPrice: number;
  originalPrice: number;
}> = {
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

const AVAILABLE_PLANS: Array<'professional' | 'premium'> = ['professional', 'premium'];

const Plans = () => {
  const { user } = useAuth();
  const { subscription, updatePlan, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleSelectPlan = (plan: 'professional' | 'premium') => {
    if (!user) {
      navigate('/auth');
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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
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

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {AVAILABLE_PLANS.map((plan) => {
            const info = PLAN_INFO[plan];
            const isCurrentPlan = subscription?.plan === plan;
            const isPremium = plan === 'premium';

            return (
              <Card 
                key={plan} 
                className={`relative ${isPremium ? 'border-primary shadow-lg' : ''}`}
              >
                {isPremium && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Recomendado
                  </Badge>
                )}
                
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{info.name}</CardTitle>
                  <CardDescription>{info.description}</CardDescription>
                  <div className="mt-4 flex flex-col items-center gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-foreground">
                        R$ {info.currentPrice}
                      </span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    <span className="text-lg text-muted-foreground line-through">
                      R$ {info.originalPrice}
                    </span>
                    <Badge variant="secondary" className="mt-2">
                      {Math.round((1 - info.currentPrice / info.originalPrice) * 100)}% OFF
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Limites</p>
                    <ul className="space-y-2">
                      {info.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Adicionais</p>
                    <ul className="space-y-2">
                      {info.extras.map((extra, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm text-foreground">{extra}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
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
              <span>Cartão de Crédito</span>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Pagamento</DialogTitle>
            <DialogDescription>
              {selectedPlan && PLAN_INFO[selectedPlan as keyof typeof PLAN_INFO] && (
                `Plano ${PLAN_INFO[selectedPlan as keyof typeof PLAN_INFO].name} - R$ ${PLAN_INFO[selectedPlan as keyof typeof PLAN_INFO].currentPrice}/mês`
              )}
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
                    Cartão de Crédito
                  </Label>
                </div>
              </RadioGroup>
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
