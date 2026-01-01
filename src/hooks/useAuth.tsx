/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { getUserIP } from '@/lib/ip';
import type { AsyncState } from '@/types/async';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authError: string | null;
  authState: AuthState;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

type AuthAttemptType = 'login' | 'signup' | 'password_reset';
type AuthSnapshot = { user: User | null; session: Session | null };
export type AuthState = AsyncState<AuthSnapshot>;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Handle auth state changes with proper error detection
  const handleAuthChange = useCallback((event: AuthChangeEvent, newSession: Session | null) => {
    if (!isMounted.current) return;
    const previousSession = sessionRef.current;

    if (event === 'PASSWORD_RECOVERY' && typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const isResetMode = window.location.pathname === '/auth' && searchParams.get('mode') === 'reset';
      if (!isResetMode) {
        logger.info('Password recovery event received, redirecting to reset mode');
        window.location.href = '/auth?mode=reset';
      }
    }

    // Detect token refresh failures
    if (event === 'TOKEN_REFRESHED' && !newSession) {
      logger.warn('Token refresh failed - user may need to re-authenticate');
      setAuthError('Sessão expirada. Por favor, faça login novamente.');
    }

    // Detect unexpected sign outs (could be token refresh failure)
    if (event === 'SIGNED_OUT' && previousSession && !newSession) {
      logger.warn('Unexpected sign out detected');
      setAuthError('Você foi desconectado. Por favor, faça login novamente.');
    }

    setSession(newSession);
    setUser(newSession?.user ?? null);
    setLoading(false);

    // Clear error on successful auth events
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (newSession) {
        setAuthError(null);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!isMounted.current) return;

      if (error) {
        logger.error('Error getting initial session', error);
        setAuthError('Erro ao verificar sessão. Tente recarregar a página.');
      }

      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
    });

    // Cleanup on unmount
    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [handleAuthChange]);

  const logAuthAttempt = async (
    userIp: string,
    userEmail: string,
    attemptType: AuthAttemptType,
    wasSuccessful: boolean
  ): Promise<void> => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    const { error } = await supabase.rpc('log_auth_attempt', {
      user_ip: userIp,
      user_email: userEmail,
      attempt_type: attemptType,
      was_successful: wasSuccessful,
      user_agent_string: userAgent,
    });

    if (error) {
      logger.warn('Failed to log auth attempt', error, { attemptType });
    }
  };

  type RateLimitResult =
    | { status: 'error'; allowed: false; message: string }
    | { status: 'success'; allowed: true; message: string };

  const checkRateLimit = async (userIp: string, attemptType: AuthAttemptType): Promise<RateLimitResult> => {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      user_ip: userIp,
      p_attempt_type: attemptType,
      max_attempts: 5,
      window_minutes: 15,
    });

    if (error) {
      logger.error('Rate limit check failed', error, { attemptType });
      return { status: 'error', allowed: false, message: 'Erro ao validar tentativas. Tente novamente.' };
    }

    if (!data) {
      return {
        status: 'error',
        allowed: false,
        message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      };
    }

    return { status: 'success', allowed: true, message: '' };
  };

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    setAuthError(null);
    const userIp = await getUserIP();

    if (userIp !== 'unknown') {
      const rateLimit = await checkRateLimit(userIp, 'login');
      if (!rateLimit.allowed) {
        setAuthError(rateLimit.message);
        await logAuthAttempt(userIp, email, 'login', false);
        return { error: new Error(rateLimit.message) };
      }
    } else {
      logger.warn('User IP unavailable; skipping rate limit check');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    await logAuthAttempt(userIp, email, 'login', !error);
    if (error) {
      setAuthError(error.message);
    }
    return { error };
  };

  const signUp = async (email: string, password: string): Promise<{ error: Error | null }> => {
    setAuthError(null);
    const redirectUrl = `${window.location.origin}/`;
    const userIp = await getUserIP();

    if (userIp !== 'unknown') {
      const rateLimit = await checkRateLimit(userIp, 'signup');
      if (!rateLimit.allowed) {
        setAuthError(rateLimit.message);
        await logAuthAttempt(userIp, email, 'signup', false);
        return { error: new Error(rateLimit.message) };
      }
    } else {
      logger.warn('User IP unavailable; skipping rate limit check');
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    await logAuthAttempt(userIp, email, 'signup', !error);
    if (error) {
      setAuthError(error.message);
    }
    return { error };
  };

  const signOut = async (): Promise<void> => {
    setAuthError(null);
    setSession(null);
    setUser(null);
    await supabase.auth.signOut();
  };

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const authState: AuthState = loading
    ? { status: 'loading' }
    : authError
    ? { status: 'error', error: authError }
    : { status: 'success', data: { user, session } };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      authError,
      authState,
      signIn,
      signUp,
      signOut,
      clearAuthError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
