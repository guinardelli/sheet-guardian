import type { ReactNode } from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetUserIP = vi.hoisted(() => vi.fn());
const mockSignInWithPassword = vi.hoisted(() => vi.fn());
const mockSignUp = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());
const mockOnAuthStateChange = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

const supabase = vi.hoisted(() => ({
  auth: {
    onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    getSession: (...args: unknown[]) => mockGetSession(...args),
    signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    signUp: (...args: unknown[]) => mockSignUp(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
  rpc: (...args: unknown[]) => mockRpc(...args),
}));

vi.mock('@/services/supabase/client', () => ({ supabase }));
vi.mock('@/lib/ip', () => ({ getUserIP: mockGetUserIP }));

import { AuthProvider, useAuth } from '@/hooks/useAuth';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserIP.mockResolvedValue('1.2.3.4');
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === 'check_rate_limit') {
        return { data: true, error: null };
      }
      return { data: null, error: null };
    });
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
  });

  it('blocks sign-in when rate limit is exceeded', async () => {
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === 'check_rate_limit') {
        return { data: false, error: null };
      }
      return { data: null, error: null };
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => !result.current.loading);

    let response: { error: Error | null } | undefined;
    await act(async () => {
      response = await result.current.signIn('test@example.com', 'password');
    });

    expect(response?.error).toBeInstanceOf(Error);
    expect(result.current.authError).toBe('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in when rate limit allows', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => !result.current.loading);

    let response: { error: Error | null } | undefined;
    await act(async () => {
      response = await result.current.signIn('test@example.com', 'password');
    });

    expect(response?.error).toBeNull();
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
    expect(result.current.authError).toBeNull();
  });
});

