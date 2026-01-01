import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

type MockSubscription = {
  id: string;
  user_id: string;
  plan: 'free' | 'professional' | 'premium';
  sheets_used_today: number;
  sheets_used_week: number;
  sheets_used_month: number;
  last_sheet_date: string | null;
  last_reset_date: string | null;
  payment_method: string | null;
  payment_status: string | null;
  updated_at?: string;
};

const mockSubscriptionRef = vi.hoisted(() => ({
  current: null as MockSubscription | null,
}));

const mockMaybeSingle = vi.hoisted(() =>
  vi.fn(async () => ({ data: mockSubscriptionRef.current, error: null })),
);
const mockInsertSingle = vi.hoisted(() =>
  vi.fn(async () => ({ data: mockSubscriptionRef.current, error: null })),
);
const mockInsertSelect = vi.hoisted(() =>
  vi.fn(() => ({ single: mockInsertSingle })),
);
const mockInsert = vi.hoisted(() =>
  vi.fn(() => ({ select: mockInsertSelect })),
);
const mockRpc = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));

const supabase = vi.hoisted(() => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: mockMaybeSingle,
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    })),
    insert: mockInsert,
  })),
  rpc: mockRpc,
}));

vi.mock('@/services/supabase/client', () => ({ supabase }));
vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@example.com' } }),
}));
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('@/lib/error-tracker', () => ({
  trackSubscriptionIssue: vi.fn(),
}));

import { useSubscription, getLocalDateString, getWeekNumber } from '@/hooks/useSubscription';

const baseSubscription = {
  id: 'sub-1',
  user_id: 'user-1',
  plan: 'professional' as const,
  sheets_used_today: 0,
  sheets_used_week: 3,
  sheets_used_month: 0,
  last_sheet_date: '2025-12-21',
  last_reset_date: '2025-12-01',
  payment_method: null,
  payment_status: 'active',
  updated_at: '2025-12-01',
};

describe('useSubscription logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionRef.current = { ...baseSubscription };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets weekly usage when crossing ISO week', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 22));

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    const stats = result.current.getUsageStats();
    expect(stats?.used).toBe(0);
  });

  it('keeps weekly usage within the same ISO week', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 23));
    mockSubscriptionRef.current = { ...baseSubscription, last_sheet_date: '2025-12-22', sheets_used_week: 4 };

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    const stats = result.current.getUsageStats();
    expect(stats?.used).toBe(4);
  });

  it('resets monthly usage when month changes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 5));
    mockSubscriptionRef.current = {
      ...baseSubscription,
      plan: 'free',
      sheets_used_month: 1,
      last_reset_date: '2025-10-31',
    };

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    const stats = result.current.getUsageStats();
    expect(stats?.used).toBe(0);
  });

  it('keeps monthly usage within the same month', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 5));
    mockSubscriptionRef.current = {
      ...baseSubscription,
      plan: 'free',
      sheets_used_month: 1,
      last_reset_date: '2025-12-01',
    };

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    const stats = result.current.getUsageStats();
    expect(stats?.used).toBe(1);
  });

  it('blocks processing when file exceeds size limit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 5));
    mockSubscriptionRef.current = { ...baseSubscription, plan: 'free' };

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    const response = result.current.canProcessSheet(2048);
    expect(response.allowed).toBe(false);
    expect(response.suggestUpgrade).toBe(true);
  });

  it('blocks processing when weekly limit is reached', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 23));
    mockSubscriptionRef.current = {
      ...baseSubscription,
      plan: 'professional',
      sheets_used_week: 5,
      last_sheet_date: '2025-12-22',
    };

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    const response = result.current.canProcessSheet(100);
    expect(response.allowed).toBe(false);
    expect(response.suggestUpgrade).toBe(true);
  });

  it('uses updated monthly limit for free plan', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 5));
    mockSubscriptionRef.current = {
      ...baseSubscription,
      plan: 'free',
      sheets_used_month: 1,
      last_reset_date: '2025-12-01',
    };

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    const stats = result.current.getUsageStats();
    expect(stats?.limit).toBe(2);
  });

  it('allows processing within professional file size limit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 5));
    mockSubscriptionRef.current = {
      ...baseSubscription,
      plan: 'professional',
      sheets_used_week: 0,
      last_sheet_date: '2025-12-02',
    };

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    const response = result.current.canProcessSheet(3000);
    expect(response.allowed).toBe(true);
  });

  it('blocks processing when professional file exceeds 3 MB', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 5));
    mockSubscriptionRef.current = {
      ...baseSubscription,
      plan: 'professional',
      sheets_used_week: 0,
      last_sheet_date: '2025-12-02',
    };

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    const response = result.current.canProcessSheet(3073);
    expect(response.allowed).toBe(false);
    expect(response.reason).toContain('Limite do seu plano: 3 MB');
  });

  it('returns a stable local date string', () => {
    const value = getLocalDateString(new Date(2025, 0, 5));
    expect(value).toBe('2025-01-05');
  });

  it('handles ISO week boundary changes', () => {
    const sunday = new Date(2025, 11, 21);
    const monday = new Date(2025, 11, 22);
    expect(getWeekNumber(sunday)).not.toBe(getWeekNumber(monday));
  });

  it('creates subscription via RPC when missing', async () => {
    mockSubscriptionRef.current = null;
    const created = { ...baseSubscription, plan: 'free' as const };

    mockRpc.mockImplementationOnce(async () => {
      mockSubscriptionRef.current = created;
      return { data: null, error: null };
    });

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    expect(mockRpc).toHaveBeenCalled();
    expect(result.current.subscription?.plan).toBe('free');
  });

  it('falls back to INSERT when RPC fails', async () => {
    mockSubscriptionRef.current = null;
    const created = { ...baseSubscription, plan: 'free' as const };

    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Function not found' } });
    mockInsertSingle.mockImplementationOnce(async () => {
      mockSubscriptionRef.current = created;
      return { data: created, error: null };
    });

    const { result } = renderHook(() => useSubscription());
    await act(async () => {
      await result.current.refetch();
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(result.current.subscription?.plan).toBe('free');
  });
});

