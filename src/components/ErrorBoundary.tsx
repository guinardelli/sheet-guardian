import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { captureError } from '@/lib/error-tracker';
import { logger } from '@/lib/logger';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    logger.error('React render error', error, { componentStack: info.componentStack });
    void captureError(error, { source: 'react.error_boundary', componentStack: info.componentStack });
  }

  resetErrorBoundary = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <ErrorBoundaryFallback onRetry={this.resetErrorBoundary} error={this.state.error} />;
    }

    return this.props.children;
  }
}

type ErrorFallbackProps = {
  onRetry?: () => void;
  error?: Error | null;
  compact?: boolean;
};

const ErrorBoundaryFallback = ({ onRetry, error, compact = false }: ErrorFallbackProps) => {
  const { t } = useTranslation();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t('errorBoundary.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">{t('errorBoundary.description')}</p>
        {import.meta.env.DEV && error && (
          <pre className="text-xs text-destructive bg-destructive/10 p-2 rounded mb-4 max-w-full overflow-auto">
            {error.message}
          </pre>
        )}
        <Button onClick={handleRetry} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('errorBoundary.reload')}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] items-center justify-center p-4 sm:p-6 lg:p-8">
        <Card className="w-full max-w-md border-border/50 shadow-soft-lg bg-background/95 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-2xl">{t('errorBoundary.title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('errorBoundary.description')}</p>
            {import.meta.env.DEV && error && (
              <pre className="text-xs text-destructive bg-destructive/10 p-2 rounded mt-2 max-w-full overflow-auto text-left">
                {error.message}
              </pre>
            )}
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
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
