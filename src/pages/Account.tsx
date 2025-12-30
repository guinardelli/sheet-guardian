import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const PLAN_BADGE_STYLES: Record<SubscriptionPlan, string> = {
  free: 'bg-muted text-muted-foreground',
  professional: 'bg-primary/10 text-primary',
  premium: 'bg-gradient-to-r from-primary to-accent text-white',
};

const Account = () => {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading, refetch: refetchSubscription } = useSubscription();
  const navigate = useNavigate();
  const { openCustomerPortal, loading: portalLoading } = useSubscriptionManagement();

  const PLAN_NAMES: Record<SubscriptionPlan, string> = {
    free: t('plans.free'),
    professional: t('plans.professional'),
    premium: t('plans.premium'),
  };

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
      toast.error(t('account.messages.emailDifferent'));
      return;
    }

    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });

    if (error) {
      toast.error(t('account.messages.emailUpdateError'), {
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
      toast.error(t('account.messages.profileSyncError'), {
        description: profileError.message,
      });
    } else {
      toast.success(t('account.messages.confirmationSent'), {
        description: t('account.messages.confirmationSentDesc'),
      });
    }
    setSavingEmail(false);
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast.error(t('account.messages.emailNotFound'));
      return;
    }

    setSendingPasswordReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      toast.error(t('account.messages.resetEmailError'), {
        description: error.message,
      });
    } else {
      toast.success(t('account.messages.resetEmailSent'), {
        description: t('account.messages.resetEmailSentDesc'),
      });
    }
    setSendingPasswordReset(false);
  };

  const handleRetrySubscription = async () => {
    if (retryCount >= 3) {
      toast.error(t('account.messages.retryLimit'), {
        description: t('account.messages.retryLimitDesc'),
      });
      return;
    }

    setRetrying(true);
    setRetryCount((prev) => prev + 1);

    try {
      const refreshed = await refetchSubscription();

      if (refreshed) {
        toast.success(t('account.messages.subscriptionCreated'));
        setRetryCount(0);
        setLastError(null);
      } else {
        setLastError(t('account.messages.subscriptionError'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.error');
      setLastError(message);
      toast.error(t('account.messages.subscriptionError'), { description: message });
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
          <p className="text-primary font-medium">{t('dashboard.unlimitedUsage')}</p>
          <p className="text-sm text-muted-foreground">{t('account.noRestrictions')}</p>
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
            <span className="text-muted-foreground">{t('account.monthlyUsage')}:</span>
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
            <span className="text-muted-foreground">{t('account.weeklyUsage')}:</span>
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

  const cancellationInfo = (() => {
    if (!subscription?.cancel_at_period_end || !subscription.current_period_end) {
      return null;
    }

    const endDate = new Date(subscription.current_period_end);
    if (Number.isNaN(endDate.getTime())) {
      return null;
    }

    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000));
    const formattedDate = new Intl.DateTimeFormat('pt-BR').format(endDate);

    return { formattedDate, daysRemaining };
  })();

  return (
    <div className="min-h-screen bg-background pt-20">
      <NewHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-8">
          <Home className="mr-2 h-4 w-4" />
          {t('common.home')}
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-10 tracking-tight">{t('account.title')}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  {t('account.personalInfo')}
                </CardTitle>
                <CardDescription>{t('account.personalInfoDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">{t('account.userId')}</Label>
                  <p className="font-mono text-sm text-muted-foreground">{user?.id}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  {t('account.emailSection')}
                </CardTitle>
                <CardDescription>{t('account.emailSectionDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('account.emailAddress')}</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder={t('auth.emailPlaceholder')}
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
                      {t('common.change')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('account.emailChangeNote')}
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
                  {t('account.security')}
                </CardTitle>
                <CardDescription>{t('account.securityDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handlePasswordReset}
                  disabled={sendingPasswordReset}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {sendingPasswordReset ? <LoadingSpinner /> : <Lock className="h-4 w-4" />}
                  {t('account.sendResetEmail')}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t('account.resetEmailNote')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-soft bg-gradient-to-br from-background to-muted/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {t('account.currentPlan')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <LoadingSpinner />
                    {t('account.loadingPlan')}
                  </div>
                ) : subscription ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className={PLAN_BADGE_STYLES[subscription.plan]}>
                        {PLAN_NAMES[subscription.plan]}
                      </Badge>
                      {subscription.plan === 'premium' && (
                        <span className="text-sm text-muted-foreground">
                          {t('account.allFeaturesUnlocked')}
                        </span>
                      )}
                    </div>
                    {cancellationInfo && (
                      <div className="text-sm text-muted-foreground">
                        {t('account.cancellationScheduled')} {cancellationInfo.formattedDate}
                        {` (${cancellationInfo.daysRemaining} ${
                          cancellationInfo.daysRemaining === 1 ? t('account.day') : t('account.days')
                        })`}
                        .
                      </div>
                    )}

                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3">{t('account.planUsage')}</h4>
                      {getUsageDisplay()}
                    </div>

                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3">{t('account.planLimits')}</h4>
                      <ul className="space-y-2 text-sm">
                        {planLimits && planLimits.sheetsPerMonth !== null && (
                          <li className="flex justify-between">
                            <span className="text-muted-foreground">{t('account.processingsPerMonth')}:</span>
                            <span>{planLimits.sheetsPerMonth}</span>
                          </li>
                        )}
                        {planLimits && planLimits.sheetsPerWeek !== null && (
                          <li className="flex justify-between">
                            <span className="text-muted-foreground">{t('account.processingsPerWeek')}:</span>
                            <span>{planLimits.sheetsPerWeek}</span>
                          </li>
                        )}
                        {planLimits && planLimits.maxFileSizeMB !== null && (
                          <li className="flex justify-between">
                            <span className="text-muted-foreground">{t('account.maxFileSize')}:</span>
                            <span>{planLimits.maxFileSizeMB} MB</span>
                          </li>
                        )}
                        {subscription.plan === 'premium' && (
                          <>
                            <li className="flex justify-between">
                              <span className="text-muted-foreground">{t('account.processings')}:</span>
                              <span>{t('common.unlimited')}</span>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-muted-foreground">{t('account.fileSize')}:</span>
                              <span>{t('account.noLimit')}</span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                    <div className="pt-4 border-t space-y-2">
                      {subscription.plan === 'free' ? (
                        <Button onClick={() => navigate('/plans')} className="w-full">
                          <CreditCard className="h-4 w-4 mr-2" />
                          {t('account.doUpgrade')}
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
                            {t('account.manageProSubscription')}
                          </Button>
                          <Button
                            onClick={openCustomerPortal}
                            disabled={portalLoading}
                            variant="destructive"
                            className="w-full"
                          >
                            {t('account.cancelPlan')}
                          </Button>
                          <Button onClick={() => navigate('/plans')} className="w-full">
                            <Crown className="h-4 w-4 mr-2" />
                            {t('account.upgradeToPremium')}
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
                            {t('account.managePremiumSubscription')}
                          </Button>
                          <Button
                            onClick={openCustomerPortal}
                            disabled={portalLoading}
                            variant="destructive"
                            className="w-full"
                          >
                            {t('account.cancelPlan')}
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">
                    <p>{t('account.planLoadError')}</p>
                    {lastError && (
                      <p className="text-xs text-destructive mt-2">
                        {t('common.error')}: {lastError}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('account.createFreeSubscription')}
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
                        ? t('account.creatingSubscription')
                        : retryCount >= 3
                          ? t('account.limitReached')
                          : `${t('account.createSubscription')}${retryCount > 0 ? ` (${t('account.attempt')} ${retryCount}/3)` : ''}`}
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
                {t('account.upgradeSection')}
              </CardTitle>
              <CardDescription>{t('account.upgradeSectionDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/plans')} className="w-full">
                {t('account.viewPlans')}
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
