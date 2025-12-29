import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const authSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }).max(255),
  password: z
    .string()
    .min(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
    .max(100, { message: 'Senha não pode exceder 100 caracteres' }),
});

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => searchParams.get('mode') === 'reset');
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !isRecoveryMode) {
      navigate('/dashboard');
    }
  }, [user, isRecoveryMode, navigate]);

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
          title: 'Erro de validação',
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
      toast({
        title: 'Erro ao entrar',
        description:
          error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/dashboard');
    }
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
        message = 'Este email já está cadastrado. Tente fazer login.';
      }
      toast({
        title: 'Erro ao cadastrar',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Conta criada!',
        description: 'Você já pode acessar o sistema.',
      });
      navigate('/dashboard');
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: 'Email necessário',
        description: 'Digite seu email para recuperar a senha.',
        variant: 'destructive',
      });
      return;
    }

    try {
      z.string().email().parse(email);
    } catch {
      toast({
        title: 'Email inválido',
        description: 'Digite um email válido.',
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
      title: 'Email enviado!',
      description: 'Se o email existir em nossa base, você receberá instruções para redefinir sua senha.',
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
            <CardTitle className="text-2xl">Excel VBA Blocker</CardTitle>
            <CardDescription className="text-base">
              Faça login ou crie uma conta para continuar
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" className="transition-all duration-200">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="register" className="transition-all duration-200">
                  Cadastrar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="animate-fade-in space-y-5 pt-6">
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
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
                      Senha
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
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
                      {resetLoading ? 'Enviando...' : 'Esqueceu a senha?'}
                    </Button>
                  </div>
                  <Button type="submit" className="w-full h-11 shadow-soft" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="animate-fade-in space-y-5 pt-6">
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-sm font-medium">
                      Email
                    </Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="seu@email.com"
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
                      Senha
                    </Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
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
                    {loading ? 'Cadastrando...' : 'Criar Conta'}
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
