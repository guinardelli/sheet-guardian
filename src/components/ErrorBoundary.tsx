import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { captureError } from '@/lib/error-tracker';
import { logger } from '@/lib/logger';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    logger.error('React render error', error, { componentStack: info.componentStack });
    void captureError(error, { source: 'react.error_boundary', componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <ErrorBoundaryFallback />;
    }

    return this.props.children;
  }
}

const ErrorBoundaryFallback = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] items-center justify-center p-4 sm:p-6 lg:p-8">
        <Card className="w-full max-w-md border-border/50 shadow-soft-lg bg-background/95 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl">{t('errorBoundary.title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('errorBoundary.description')}</p>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => window.location.reload()}>
              {t('errorBoundary.reload')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export { ErrorBoundaryFallback };
export default ErrorBoundary;
