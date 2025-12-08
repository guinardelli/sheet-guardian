import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { ExcelIcon } from '@/components/ExcelIcon';
import { LogOut, CreditCard, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const PLAN_NAMES: Record<string, string> = {
  free: 'Gratuito',
  professional: 'Profissional',
  premium: 'Premium',
};

export const Header = () => {
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <ExcelIcon className="w-8 h-8 text-primary" />
          <span className="font-semibold text-foreground hidden sm:inline">
            Excel VBA Blocker
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {subscription && (
                <Badge variant={subscription.plan === 'premium' ? 'default' : 'secondary'}>
                  {PLAN_NAMES[subscription.plan]}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate('/plans')}>
                <CreditCard className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Planos</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/plans')}>
                <CreditCard className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Planos</span>
              </Button>
              <Button size="sm" onClick={() => navigate('/auth')}>
                <User className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Entrar</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
