import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import ErrorBoundary, { ErrorBoundaryFallback } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const Plans = lazy(() => import("./pages/Plans"));
const Account = lazy(() => import("./pages/Account"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

const queryClient = new QueryClient();

const ConfigurationWarning = () => (
  <div className="fixed bottom-4 right-4 max-w-sm rounded-lg border border-warning/20 bg-warning/10 p-4 shadow-lg z-50">
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0">
        <svg className="w-5 h-5 text-warning" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-medium text-warning">Configuração Pendente</h3>
        <p className="mt-1 text-sm text-warning/80">
          Supabase não configurado. Configure as variáveis de ambiente no Vercel para habilitar autenticação.
        </p>
      </div>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary fallback={<ErrorBoundaryFallback />}>
          <BrowserRouter>
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Index />} />
                <Route
                  path="/dashboard"
                  element={(
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  )}
                />
                <Route path="/auth" element={<Auth />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route
                  path="/account"
                  element={(
                    <ProtectedRoute>
                      <Account />
                    </ProtectedRoute>
                  )}
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
        {!isSupabaseConfigured && <ConfigurationWarning />}
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
