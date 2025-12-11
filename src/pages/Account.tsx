import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, PLAN_LIMITS, SubscriptionPlan } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Header } from '@/components/Header';
import { Home, Mail, Crown, TrendingUp, Loader2, User, Lock, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
}

const Account = () => {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading, refetch: refetchSubscription } = useSubscription();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    setProfileLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
      setFullName(data.full_name || '');
      setNewEmail(data.email || user.email || '');
    } else {
      setNewEmail(user.email || '');
    }
    setProfileLoading(false);
  };

  const handleSaveFullName = async () => {
    if (!user) return;

    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Erro ao salvar nome', {
        description: error.message
      });
    } else {
      toast.success('Nome atualizado com sucesso!');
      await fetchProfile();
    }
    setSavingName(false);
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user?.email) {
      toast.error('Digite um novo email diferente do atual');
      return;
    }

    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({
      email: newEmail
    });

    if (error) {
      toast.error('Erro ao atualizar email', {
        description: error.message
      });
    } else {
      toast.success('Email de confirmação enviado!', {
        description: 'Verifique sua caixa de entrada para confirmar o novo email.'
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
      redirectTo: `${window.location.origin}/auth`
    });

    if (error) {
      toast.error('Erro ao enviar email de redefinição', {
        description: error.message
      });
    } else {
      toast.success('Email enviado!', {
        description: 'Verifique sua caixa de entrada para redefinir sua senha.'
      });
    }
    setSendingPasswordReset(false);
  };

  if (authLoading || profileLoading) {
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
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <Home className="mr-2 h-4 w-4" />
          Início
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-8">Minha Conta</h1>

        <div className="space-y-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>
                Gerencie suas informações pessoais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <div className="flex gap-2">
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                  <Button
                    onClick={handleSaveFullName}
                    disabled={savingName}
                    size="icon"
                  >
                    {savingName ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">ID do Usuário</Label>
                <p className="font-mono text-sm text-muted-foreground">{user?.id}</p>
              </div>
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email
              </CardTitle>
              <CardDescription>
                Altere seu endereço de email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Endereço de Email</Label>
                <div className="flex gap-2">
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
                  >
                    {savingEmail ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
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

          {/* Password Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Senha
              </CardTitle>
              <CardDescription>
                Redefina sua senha de acesso
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handlePasswordReset}
                disabled={sendingPasswordReset}
                variant="outline"
                className="w-full"
              >
                {sendingPasswordReset ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Enviar Email para Redefinir Senha
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Você receberá um email com um link para criar uma nova senha.
              </p>
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
              {subLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando informações do plano...
                </div>
              ) : subscription ? (
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
                <div className="text-muted-foreground">
                  <p>Não foi possível carregar as informações do plano.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={refetchSubscription}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar novamente
                  </Button>
                </div>
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
