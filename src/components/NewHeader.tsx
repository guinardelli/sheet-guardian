import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Shield, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';

export const NewHeader = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const PLAN_NAMES: Record<string, string> = {
    free: t('plans.free'),
    professional: t('plans.professional'),
    premium: t('plans.premium'),
  };

  const navItems = [
    { name: t('header.home'), path: '/' },
    { name: t('header.plans'), path: '/plans' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  return (
    <header className="fixed top-0 w-full z-[var(--z-sticky)] border-b border-border/40 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid h-16 grid-cols-[auto_1fr_auto] items-center gap-4">
          <div className="flex items-center gap-3">
            <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group no-underline">
              <div className="rounded-lg bg-primary/10 p-2">
                <Shield className="h-6 w-6 text-primary transition-transform group-hover:scale-105" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">Excel VBA Blocker</span>
            </Link>
          </div>

          <nav className="hidden lg:flex items-center justify-center">
            <NavigationMenu>
              <NavigationMenuList>
                {navItems.map((item) => (
                  <NavigationMenuItem key={item.path}>
                    <NavigationMenuLink asChild>
                      <Link
                        to={item.path}
                        className={cn(
                          'group inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-all',
                          'hover:bg-accent/50 hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none',
                          'disabled:pointer-events-none disabled:opacity-50',
                          isActive(item.path) && 'bg-primary/10 text-foreground font-semibold',
                        )}
                      >
                        {item.name}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </nav>

          <div className="flex items-center justify-end gap-2">
            <div className="hidden md:flex items-center gap-2">
              <LanguageSelector />
              {user ? (
                <div className="flex items-center gap-2">
                  {subscription && (
                    <Badge variant={subscription.plan === 'premium' ? 'default' : 'secondary'}>
                      {PLAN_NAMES[subscription.plan]}
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate('/account')}>
                    {t('header.account')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    {t('header.signOut')}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => navigate('/auth')}>
                    {t('header.signIn')}
                  </Button>
                </div>
              )}
            </div>

            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('header.openMenu')}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] sm:w-[360px]">
                <div className="flex h-full flex-col gap-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
                      <Shield className="h-6 w-6 text-primary" />
                      <span className="font-semibold text-foreground">Excel VBA Blocker</span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsMobileMenuOpen(false)}
                      aria-label={t('header.closeMenu')}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  <LanguageSelector />

                  <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors',
                          isActive(item.path) ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </nav>

                  <div className="border-t border-border pt-4">
                    {user ? (
                      <div className="space-y-3">
                        {subscription && (
                          <div className="rounded-lg bg-primary/5 px-4 py-2">
                            <p className="text-sm font-medium text-primary">
                              {t('header.plan')}: {PLAN_NAMES[subscription.plan]}
                            </p>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            navigate('/account');
                          }}
                        >
                          {t('header.myAccount')}
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full"
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            handleSignOut();
                          }}
                        >
                          {t('header.signOut')}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            navigate('/auth');
                          }}
                        >
                          {t('header.signIn')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};
