import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ExcelIcon } from '@/components/ExcelIcon';
import { NewHeader } from '@/components/NewHeader';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';

import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/constants';

const Auth = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaCheckPending, setMfaCheckPending] = useState(false);
  const [searchParams] = useSearchParams();
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => searchParams.get('mode') === 'reset');
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const authSchema = z.object({
    email: z.string().trim().email({ message: t('auth.errors.invalidEmail') }).max(255),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, { message: t('auth.errors.passwordMin') })
      .max(PASSWORD_MAX_LENGTH, { message: t('auth.errors.passwordMax') }),
  });

  useEffect(() => {
    if (user && !isRecoveryMode && !mfaRequired && !mfaCheckPending) {
      navigate('/dashboard');
    }
  }, [user, isRecoveryMode, mfaRequired, mfaCheckPending, navigate]);

  useEffect(() => {
    setIsRecoveryMode(searchParams.get('mode') === 'reset');
  }, [searchParams]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('auth.errors.validation'),
          description: error.errors[0].message,
          variant: 'destructive',
        });
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      setMfaCheckPending(false);
      toast({
        title: t('auth.errors.signInError'),
        description:
          error.message === 'Invalid login credentials' ? t('auth.errors.invalidCredentials') : error.message,
        variant: 'destructive',
      });
    } else {
      setMfaCheckPending(true);
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aalError && aalData?.nextLevel === 'aal2') {
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        const factor = factorsData?.totp?.[0] ?? null;

        if (factorsError || !factor) {
          await supabase.auth.signOut();
          setMfaCheckPending(false);
          toast({
            title: t('auth.errors.signInError'),
            description: t('auth.mfa.errors.missingFactor'),
            variant: 'destructive',
          });
          return;
        }

        setMfaRequired(true);
        setMfaFactorId(factor.id);
        setMfaCheckPending(false);
        return;
      }

      setMfaCheckPending(false);
      navigate('/dashboard');
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId) {
      return;
    }

    const code = mfaCode.replace(/\s+/g, '');
    if (code.length < 6) {
      toast({
        title: t('auth.errors.signInError'),
        description: t('auth.mfa.errors.invalidCode'),
        variant: 'destructive',
      });
      return;
    }

    setMfaVerifying(true);
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code,
    });

    if (error || !data) {
      toast({
        title: t('auth.errors.signInError'),
        description: error?.message ?? t('auth.mfa.errors.invalidCode'),
        variant: 'destructive',
      });
      setMfaVerifying(false);
      return;
    }

    await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    setMfaVerifying(false);
    setMfaRequired(false);
    setMfaFactorId(null);
    setMfaCode('');
    setMfaCheckPending(false);
    navigate('/dashboard');
  };

  const handleCancelMfa = async () => {
    await supabase.auth.signOut();
    setMfaRequired(false);
    setMfaFactorId(null);
    setMfaCode('');
    setMfaCheckPending(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);

    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = t('auth.errors.alreadyRegistered');
      }
      toast({
        title: t('auth.errors.signUpError'),
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('auth.success.accountCreated'),
        description: t('auth.success.accountCreatedDesc'),
      });
      navigate('/dashboard');
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: t('auth.errors.emailRequired'),
        description: t('auth.errors.emailRequiredDesc'),
        variant: 'destructive',
      });
      return;
    }

    try {
      z.string().email().parse(email);
    } catch {
      toast({
        title: t('auth.errors.invalidEmailFormat'),
        description: t('auth.errors.invalidEmailFormatDesc'),
        variant: 'destructive',
      });
      return;
    }

    setResetLoading(true);

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    setResetLoading(false);

    toast({
      title: t('auth.success.emailSent'),
      description: t('auth.success.emailSentDesc'),
    });
  };

  if (isRecoveryMode) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <NewHeader />
        <div className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center p-4 sm:p-6 lg:p-8">
          <ResetPasswordForm onSuccess={() => navigate('/dashboard')} />
        </div>
      </div>
    );
  }

  if (mfaRequired) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <NewHeader />
        <div className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center p-4 sm:p-6 lg:p-8">
          <Card className="w-full max-w-md border-border/50 shadow-soft-lg bg-background/95 backdrop-blur-sm relative">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl">{t('auth.mfa.title')}</CardTitle>
              <CardDescription className="text-base">
                {t('auth.mfa.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyMfa} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mfa-code">{t('auth.mfa.codeLabel')}</Label>
                  <Input
                    id="mfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t('auth.mfa.codePlaceholder')}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="submit" disabled={mfaVerifying}>
                    {mfaVerifying ? t('auth.mfa.verifying') : t('auth.mfa.verify')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleCancelMfa}>
                    {t('auth.mfa.cancel')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <NewHeader />
      <div className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

        <Card className="w-full max-w-md border-border/50 shadow-soft-lg bg-background/95 backdrop-blur-sm relative">
          <CardHeader className="space-y-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto">
              <ExcelIcon className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t('auth.title')}</CardTitle>
            <CardDescription className="text-base">
              {t('auth.subtitle')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" className="transition-all duration-200">
                  {t('auth.loginTab')}
                </TabsTrigger>
                <TabsTrigger value="register" className="transition-all duration-200">
                  {t('auth.registerTab')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="animate-fade-in space-y-5 pt-6">
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium">
                      {t('auth.email')}
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={cn(
                        'h-11 transition-all duration-200',
                        'focus:ring-2 focus:ring-primary/20 focus:border-primary',
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium">
                      {t('auth.password')}
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder={t('auth.passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className={cn(
                        'h-11 transition-all duration-200',
                        'focus:ring-2 focus:ring-primary/20 focus:border-primary',
                      )}
                    />
                  </div>
                  <div className="text-right">
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-sm text-muted-foreground hover:text-primary"
                      onClick={handleForgotPassword}
                      disabled={resetLoading}
                    >
                      {resetLoading ? t('auth.sendingReset') : t('auth.forgotPassword')}
                    </Button>
                  </div>
                  <Button type="submit" className="w-full h-11 shadow-soft" disabled={loading}>
                    {loading ? t('auth.signingIn') : t('auth.signIn')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="animate-fade-in space-y-5 pt-6">
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-sm font-medium">
                      {t('auth.email')}
                    </Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={cn(
                        'h-11 transition-all duration-200',
                        'focus:ring-2 focus:ring-primary/20 focus:border-primary',
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm font-medium">
                      {t('auth.password')}
                    </Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder={t('auth.passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className={cn(
                        'h-11 transition-all duration-200',
                        'focus:ring-2 focus:ring-primary/20 focus:border-primary',
                      )}
                    />
                    <PasswordStrengthIndicator password={password} />
                  </div>
                  <Button type="submit" className="w-full h-11 shadow-soft" disabled={loading}>
                    {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
