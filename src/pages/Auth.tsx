import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ExcelIcon } from '@/components/ExcelIcon';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const authSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
  password: z
    .string()
    .min(8, { message: "Senha deve ter no mínimo 8 caracteres" })
    .max(100, { message: "Senha não pode exceder 100 caracteres" })
    .regex(/[A-Z]/, { message: "Senha deve conter pelo menos uma letra maiúscula" })
    .regex(/[a-z]/, { message: "Senha deve conter pelo menos uma letra minúscula" })
    .regex(/[0-9]/, { message: "Senha deve conter pelo menos um número" })
    .regex(/[^A-Za-z0-9]/, { message: "Senha deve conter pelo menos um caractere especial (!@#$%^&*)" }),
});

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
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
        title: "Erro ao entrar",
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : error.message,
        variant: "destructive",
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
        title: "Erro ao cadastrar",
        description: message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Conta criada!",
        description: "Você já pode acessar o sistema.",
      });
      navigate('/dashboard');
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: "Email necessário",
        description: "Digite seu email para recuperar a senha.",
        variant: "destructive",
      });
      return;
    }

    try {
      z.string().email().parse(email);
    } catch {
      toast({
        title: "Email inválido",
        description: "Digite um email válido.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);

    // Call password reset - note: we don't check for errors to prevent email enumeration
    // Always show success message regardless of whether email exists
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    setResetLoading(false);

    // Always show success to prevent email enumeration attack
    // If email doesn't exist, user won't receive email but attacker can't tell
    toast({
      title: "Email enviado!",
      description: "Se o email existir em nossa base, você receberá instruções para redefinir sua senha.",
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <Card className="w-full max-w-md shadow-soft-lg border-border/50 relative">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-5">
            <div className="p-3 rounded-2xl bg-primary/10">
              <ExcelIcon className="w-12 h-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Excel VBA Blocker</CardTitle>
          <CardDescription className="text-base mt-2">
            Faça login ou crie uma conta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="font-medium">Entrar</TabsTrigger>
              <TabsTrigger value="register" className="font-medium">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
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

            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-sm font-medium">Senha</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
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
  );
};

export default Auth;
