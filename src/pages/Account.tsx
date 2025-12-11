import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, PLAN_LIMITS, SubscriptionPlan } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { ArrowLeft, Mail, Crown, TrendingUp, Loader2 } from 'lucide-react';

const PLAN_NAMES: Record<SubscriptionPlan, string> = {
  free: 'Gratuito',
  professional: 'Profissional',
  premium: 'Premium',
};

const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  free: 'bg-gray-500',
  professional: 'bg-blue-500',
  premium: 'bg-yellow-500',
};

const Account = () => {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const planLimits = subscription ? PLAN_LIMITS[subscription.plan] : null;

  const getUsageDisplay = () => {
    if (!subscription || !planLimits) return null;

    if (subscription.plan === 'premium') {
      return (
        <div className="text-center p-4 bg-primary/10 rounded-lg">
          <p className="text-primary font-medium">Uso Ilimitado</p>
          <p className="text-sm text-muted-foreground">Sem restrições de processamento</p>
        </div>
      );
    }

    if (subscription.plan === 'free' && planLimits.sheetsPerMonth !== null) {
      return (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Uso mensal:</span>
            <span className="font-semibold">
              {subscription.sheets_used_month}/{planLimits.sheetsPerMonth}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{
                width: `${Math.min((subscription.sheets_used_month / planLimits.sheetsPerMonth) * 100, 100)}%`
              }}
            />
          </div>
        </div>
      );
    }

    if (subscription.plan === 'professional' && planLimits.sheetsPerWeek !== null) {
      return (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Uso semanal:</span>
            <span className="font-semibold">
              {subscription.sheets_used_today}/{planLimits.sheetsPerWeek}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{
                width: `${Math.min((subscription.sheets_used_today / planLimits.sheetsPerWeek) * 100, 100)}%`
              }}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-8">Minha Conta</h1>

        <div className="space-y-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Informações da Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">ID do Usuário</label>
                <p className="font-mono text-sm text-muted-foreground">{user?.id}</p>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Plano Atual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription ? (
                <>
                  <div className="flex items-center gap-3">
                    <Badge className={PLAN_COLORS[subscription.plan]}>
                      {PLAN_NAMES[subscription.plan]}
                    </Badge>
                    {subscription.plan === 'premium' && (
                      <span className="text-sm text-muted-foreground">Todas as funcionalidades desbloqueadas</span>
                    )}
                  </div>

                  {/* Usage */}
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3">Uso do Plano</h4>
                    {getUsageDisplay()}
                  </div>

                  {/* Plan Details */}
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3">Limites do Plano</h4>
                    <ul className="space-y-2 text-sm">
                      {planLimits?.sheetsPerMonth !== null && (
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">Processamentos por mês:</span>
                          <span>{planLimits.sheetsPerMonth}</span>
                        </li>
                      )}
                      {planLimits?.sheetsPerWeek !== null && (
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">Processamentos por semana:</span>
                          <span>{planLimits.sheetsPerWeek}</span>
                        </li>
                      )}
                      {planLimits?.maxFileSizeMB !== null && (
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">Tamanho máximo de arquivo:</span>
                          <span>{planLimits.maxFileSizeMB} MB</span>
                        </li>
                      )}
                      {subscription.plan === 'premium' && (
                        <>
                          <li className="flex justify-between">
                            <span className="text-muted-foreground">Processamentos:</span>
                            <span>Ilimitados</span>
                          </li>
                          <li className="flex justify-between">
                            <span className="text-muted-foreground">Tamanho de arquivo:</span>
                            <span>Sem limite</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Carregando informações do plano...</p>
              )}
            </CardContent>
          </Card>

          {/* Upgrade CTA */}
          {subscription && subscription.plan !== 'premium' && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Fazer Upgrade
                </CardTitle>
                <CardDescription>
                  Desbloqueie mais funcionalidades com um plano superior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate('/plans')} className="w-full">
                  Ver Planos Disponíveis
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Account;
