import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, CreditCard, User, LayoutDashboard, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { ExcelIcon } from '@/components/ExcelIcon';
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
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleSignOutMobile = async () => {
    setIsMobileMenuOpen(false);
    await signOut();
    navigate('/');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const isOnDashboard = location.pathname === '/dashboard';

  const handleLinkClick = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    navigate(path);
  };

  const linkClass =
    'px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors duration-200 flex items-center gap-2 no-underline';
  const mobileLinkClass =
    'px-4 py-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors duration-200 flex items-center gap-2 w-full no-underline';

  return (
    <>
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-lg sticky top-0 z-[100] shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group no-underline">
            <ExcelIcon className="w-8 h-8 text-primary transition-transform group-hover:scale-105" />
            <span className="font-semibold text-foreground hidden sm:inline tracking-tight">
              Excel VBA Blocker
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
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
                  <a
                    onClick={(e) => { e.preventDefault(); handleLinkClick(e, '/dashboard'); }}
                    href="/dashboard"
                    className={`${linkClass} cursor-pointer`}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Inicio
                  </a>
                )}
                <a
                  onClick={(e) => { e.preventDefault(); handleLinkClick(e, '/plans'); }}
                  href="/plans"
                  className={`${linkClass} cursor-pointer`}
                >
                  <CreditCard className="h-4 w-4" />
                  Planos
                </a>
                <a
                  onClick={(e) => { e.preventDefault(); handleLinkClick(e, '/account'); }}
                  href="/account"
                  className={`${linkClass} cursor-pointer`}
                >
                  <User className="h-4 w-4" />
                  Minha Conta
                </a>
                <button type="button" onClick={handleSignOut} className={`${linkClass} cursor-pointer`}>
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link to="/plans" className={linkClass}>
                  <CreditCard className="h-4 w-4" />
                  Planos
                </Link>
                <Link
                  to="/auth"
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors duration-200 flex items-center gap-2 no-underline"
                >
                  <User className="h-4 w-4" />
                  Entrar
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 hover:bg-accent rounded-md transition-colors"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-[90] md:hidden" onClick={closeMobileMenu} />
      )}

      {isMobileMenuOpen && (
        <nav
          id="mobile-menu"
          className="fixed top-[60px] right-0 w-[280px] sm:w-[320px] h-[calc(100vh-60px)] bg-background border-l border-border shadow-lg flex flex-col gap-2 p-4 z-[95] md:hidden"
        >
          {user ? (
            <>
              {subscription && (
                <div className="pb-2 border-b border-border mb-2">
                  <Badge
                    variant={subscription.plan === 'premium' ? 'default' : 'secondary'}
                    className="font-medium tracking-wide"
                  >
                    {PLAN_NAMES[subscription.plan]}
                  </Badge>
                </div>
              )}
              {!isOnDashboard && (
                <a
                  onClick={(e) => { e.preventDefault(); handleLinkClick(e, '/dashboard'); closeMobileMenu(); }}
                  href="/dashboard"
                  className={`${mobileLinkClass} cursor-pointer`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Inicio
                </a>
              )}
              <a
                onClick={(e) => { e.preventDefault(); handleLinkClick(e, '/plans'); closeMobileMenu(); }}
                href="/plans"
                className={`${mobileLinkClass} cursor-pointer`}
              >
                <CreditCard className="h-4 w-4" />
                Planos
              </a>
              <a
                onClick={(e) => { e.preventDefault(); handleLinkClick(e, '/account'); closeMobileMenu(); }}
                href="/account"
                className={`${mobileLinkClass} cursor-pointer`}
              >
                <User className="h-4 w-4" />
                Minha Conta
              </a>
              <button
                type="button"
                onClick={handleSignOutMobile}
                className={`${mobileLinkClass} cursor-pointer text-left`}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/plans" className={mobileLinkClass} onClick={closeMobileMenu}>
                <CreditCard className="h-4 w-4" />
                Planos
              </Link>
              <Link
                to="/auth"
                className="px-4 py-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors duration-200 flex items-center gap-2 w-full no-underline"
                onClick={closeMobileMenu}
              >
                <User className="h-4 w-4" />
                Entrar
              </Link>
            </>
          )}
        </nav>
      )}
    </>
  );
};
