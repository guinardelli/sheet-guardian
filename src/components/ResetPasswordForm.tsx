import { useState } from 'react';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { ExcelIcon } from '@/components/ExcelIcon';

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ResetPasswordFormProps {
  onSuccess: () => void;
}

export const ResetPasswordForm = ({ onSuccess }: ResetPasswordFormProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter no minimo 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Senhas nao coincidem',
        description: 'As senhas digitadas sao diferentes.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({
        title: 'Erro ao redefinir senha',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Senha redefinida',
      description: 'Sua senha foi atualizada com sucesso.',
    });

    setTimeout(() => onSuccess(), 1500);
  };

  return (
    <Card className="w-full max-w-md border-border/50 shadow-soft-lg bg-background/95 backdrop-blur-sm relative">
      <CardHeader className="space-y-3 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto">
          <ExcelIcon className="w-10 h-10 text-primary" />
        </div>
        <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
        <CardDescription className="text-base">Digite sua nova senha abaixo</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm font-medium">
              Nova Senha
            </Label>
            <Input
              id="new-password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="h-11"
            />
            <PasswordStrengthIndicator password={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm font-medium">
              Confirmar Senha
            </Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="********"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="h-11"
            />
          </div>

          <Button type="submit" className="w-full h-11 shadow-soft" disabled={loading}>
            {loading ? (
              'Redefinindo...'
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Redefinir Senha
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
