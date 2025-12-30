import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Crown, Home, Lock, Mail, RefreshCw, Settings, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { NewHeader } from '@/components/NewHeader';

import { useAuth } from '@/hooks/useAuth';
import { PLAN_LIMITS, SubscriptionPlan, useSubscription } from '@/hooks/useSubscription';
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement';

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PLAN_NAMES: Record<SubscriptionPlan, string> = {
  free: 'Gratuito',
  professional: 'Profissional',
  premium: 'Premium',
};

const PLAN_BADGE_STYLES: Record<SubscriptionPlan, string> = {
  free: 'bg-muted text-muted-foreground',
  professional: 'bg-primary/10 text-primary',
  premium: 'bg-gradient-to-r from-primary to-accent text-white',
};

const Account = () => {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading, refetch: refetchSubscription } = useSubscription();
  const navigate = useNavigate();
  const { openCustomerPortal, loading: portalLoading } = useSubscriptionManagement();

  const [profileLoading, setProfileLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    setProfileLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setNewEmail(data.email || user.email || '');
    } else {
      setNewEmail(user.email || '');
    }
    setProfileLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user?.email) {
      toast.error('Digite um novo email diferente do atual');
      return;
    }

    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });

    if (error) {
      toast.error('Erro ao atualizar email', {
        description: error.message,
      });
      setSavingEmail(false);
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ email: newEmail })
      .eq('user_id', user.id);

    if (profileError) {
      toast.error('Erro ao sincronizar perfil', {
        description: profileError.message,
      });
    } else {
      toast.success('Email de confirmação enviado!', {
        description: 'Verifique sua caixa de entrada para confirmar o novo email.',
      });
    }
    setSavingEmail(false);
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast.error('Email não encontrado');
      return;
    }

    setSendingPasswordReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      toast.error('Erro ao enviar email de redefinição', {
        description: error.message,
      });
    } else {
      toast.success('Email enviado!', {
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
    }
    setSendingPasswordReset(false);
  };

  const handleRetrySubscription = async () => {
    if (retryCount >= 3) {
      toast.error('Limite de tentativas atingido', {
        description: 'Entre em contato com o suporte em suporte@sheetguardian.com',
      });
      return;
    }

    setRetrying(true);
    setRetryCount((prev) => prev + 1);

    try {
      const refreshed = await refetchSubscription();

      if (refreshed) {
        toast.success('Assinatura criada com sucesso!');
        setRetryCount(0);
        setLastError(null);
      } else {
        setLastError('Nao foi possivel criar a assinatura.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      setLastError(message);
      toast.error('Erro ao criar assinatura', { description: message });
    } finally {
      setRetrying(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <NewHeader />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <LoadingSkeleton variant="page" count={2} />
        </main>
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
      const percentage = Math.min(
        (subscription.sheets_used_month / planLimits.sheetsPerMonth) * 100,
        100,
      );
      return (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Uso mensal:</span>
            <span className="font-semibold">
              {subscription.sheets_used_month}/{planLimits.sheetsPerMonth}
            </span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-primary transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      );
    }

    if (subscription.plan === 'professional' && planLimits.sheetsPerWeek !== null) {
      const percentage = Math.min(
        (subscription.sheets_used_week / planLimits.sheetsPerWeek) * 100,
        100,
      );
      return (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Uso semanal:</span>
            <span className="font-semibold">
              {subscription.sheets_used_week}/{planLimits.sheetsPerWeek}
            </span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-primary transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <NewHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-8">
          <Home className="mr-2 h-4 w-4" />
          Início
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-10 tracking-tight">Minha Conta</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription>Suas informações de conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">ID do Usuário</Label>
                  <p className="font-mono text-sm text-muted-foreground">{user?.id}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Email
                </CardTitle>
                <CardDescription>Altere seu endereço de email</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Endereço de Email</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                    <Button
                      onClick={handleUpdateEmail}
                      disabled={savingEmail || newEmail === user?.email}
                      variant="outline"
                      className="gap-2"
                    >
                      {savingEmail ? (
                        <LoadingSpinner />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Alterar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ao alterar o email, você receberá um link de confirmação no novo endereço.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Segurança
                </CardTitle>
                <CardDescription>Redefina sua senha de acesso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handlePasswordReset}
                  disabled={sendingPasswordReset}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {sendingPasswordReset ? <LoadingSpinner /> : <Lock className="h-4 w-4" />}
                  Enviar Email para Redefinir Senha
                </Button>
                <p className="text-xs text-muted-foreground">
                  Você receberá um email com um link para criar uma nova senha.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-soft bg-gradient-to-br from-background to-muted/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Plano Atual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <LoadingSpinner />
                    Carregando informações do plano...
                  </div>
                ) : subscription ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className={PLAN_BADGE_STYLES[subscription.plan]}>
                        {PLAN_NAMES[subscription.plan]}
                      </Badge>
                      {subscription.plan === 'premium' && (
                        <span className="text-sm text-muted-foreground">
                          Todas as funcionalidades desbloqueadas
                        </span>
                      )}
                    </div>

                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3">Uso do Plano</h4>
                      {getUsageDisplay()}
                    </div>

                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3">Limites do Plano</h4>
                      <ul className="space-y-2 text-sm">
                        {planLimits && planLimits.sheetsPerMonth !== null && (
                          <li className="flex justify-between">
                            <span className="text-muted-foreground">Processamentos por mês:</span>
                            <span>{planLimits.sheetsPerMonth}</span>
                          </li>
                        )}
                        {planLimits && planLimits.sheetsPerWeek !== null && (
                          <li className="flex justify-between">
                            <span className="text-muted-foreground">Processamentos por semana:</span>
                            <span>{planLimits.sheetsPerWeek}</span>
                          </li>
                        )}
                        {planLimits && planLimits.maxFileSizeMB !== null && (
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
                    <div className="pt-4 border-t space-y-2">
                      {subscription.plan === 'free' ? (
                        <Button onClick={() => navigate('/plans')} className="w-full">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Fazer Upgrade
                        </Button>
                      ) : subscription.plan === 'professional' ? (
                        <>
                          <Button
                            onClick={openCustomerPortal}
                            disabled={portalLoading}
                            variant="outline"
                            className="w-full"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Gerenciar Assinatura Profissional
                          </Button>
                          <Button
                            onClick={openCustomerPortal}
                            disabled={portalLoading}
                            variant="destructive"
                            className="w-full"
                          >
                            Cancelar Plano
                          </Button>
                          <Button onClick={() => navigate('/plans')} className="w-full">
                            <Crown className="h-4 w-4 mr-2" />
                            Upgrade para Premium
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={openCustomerPortal}
                            disabled={portalLoading}
                            variant="outline"
                            className="w-full"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Gerenciar Assinatura Premium
                          </Button>
                          <Button
                            onClick={openCustomerPortal}
                            disabled={portalLoading}
                            variant="destructive"
                            className="w-full"
                          >
                            Cancelar Plano
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">
                    <p>Nao foi possivel carregar as informacoes do plano.</p>
                    {lastError && (
                      <p className="text-xs text-destructive mt-2">
                        Erro: {lastError}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Clique abaixo para tentar criar sua assinatura gratuita.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleRetrySubscription}
                      disabled={retrying || retryCount >= 3}
                    >
                      {retrying ? <LoadingSpinner /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      {retrying
                        ? 'Criando assinatura...'
                        : retryCount >= 3
                          ? 'Limite atingido - Contate o suporte'
                          : `Criar assinatura${retryCount > 0 ? ` (Tentativa ${retryCount}/3)` : ''}`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {subscription && subscription.plan !== 'premium' && (
          <Card className="border-primary/30 shadow-soft mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Fazer Upgrade
              </CardTitle>
              <CardDescription>Desbloqueie mais funcionalidades com um plano superior</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/plans')} className="w-full">
                Ver Planos Disponíveis
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

const LoadingSpinner = () => <RefreshCw className="h-4 w-4 animate-spin" />;

export default Account;
