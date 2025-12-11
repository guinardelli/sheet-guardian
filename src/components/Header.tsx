import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { ExcelIcon } from '@/components/ExcelIcon';
import { LogOut, CreditCard, User, LayoutDashboard, Menu, UserCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const PLAN_NAMES: Record<string, string> = {
  free: 'Gratuito',
  professional: 'Profissional',
  premium: 'Premium',
};

export const Header = () => {
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const isOnDashboard = location.pathname === '/dashboard';

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {user ? (
        <>
          {subscription && (
            <Badge
              variant={subscription.plan === 'premium' ? 'default' : 'secondary'}
              className="font-medium tracking-wide"
            >
              {PLAN_NAMES[subscription.plan]}
            </Badge>
          )}
          {!isOnDashboard && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
              className={mobile ? 'w-full justify-start' : ''}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Início
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { navigate('/plans'); setMobileMenuOpen(false); }}
            className={mobile ? 'w-full justify-start' : ''}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Planos
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { navigate('/account'); setMobileMenuOpen(false); }}
            className={mobile ? 'w-full justify-start' : ''}
          >
            <UserCircle className="h-4 w-4 mr-2" />
            Minha Conta
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className={mobile ? 'w-full justify-start' : ''}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </>
      ) : (
        <>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { navigate('/plans'); setMobileMenuOpen(false); }}
            className={mobile ? 'w-full justify-start' : ''}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Planos
          </Button>
          <Button 
            size="sm" 
            onClick={() => { navigate('/auth'); setMobileMenuOpen(false); }}
            className={mobile ? 'w-full' : ''}
          >
            <User className="h-4 w-4 mr-2" />
            Entrar
          </Button>
        </>
      )}
    </>
  );

  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur-lg sticky top-0 z-50 shadow-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <ExcelIcon className="w-8 h-8 text-primary transition-transform group-hover:scale-105" />
          <span className="font-semibold text-foreground hidden sm:inline tracking-tight">
            Excel VBA Blocker
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          <NavItems />
        </nav>

        {/* Mobile Navigation */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] sm:w-[320px]">
            <div className="flex flex-col gap-4 mt-8">
              <NavItems mobile />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};
