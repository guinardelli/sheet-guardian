import { Suspense, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import ErrorBoundary, { ErrorBoundaryFallback } from '@/components/ErrorBoundary';

type ProtectedRouteProps = {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
};

const AuthLoadingFallback = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-sm text-muted-foreground">{t('common.verifyingAuth')}</p>
    </div>
  );
};

const SuspenseFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const ProtectedRoute = ({
  children,
  fallback,
  redirectTo = '/auth',
}: ProtectedRouteProps) => {
  const { user, loading, authError } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (loading) {
    return fallback ?? <AuthLoadingFallback />;
  }

  // Handle auth errors (e.g., expired session)
  if (authError && !user) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location, error: authError }}
        replace
      />
    );
  }

  // Redirect to auth page if not authenticated
  if (!user) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location }}
        replace
      />
    );
  }

  // Render protected content with ErrorBoundary and Suspense
  return (
    <ErrorBoundary
      fallback={<ErrorBoundaryFallback compact />}
    >
      <Suspense fallback={<SuspenseFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

export default ProtectedRoute;
export { AuthLoadingFallback, SuspenseFallback };
