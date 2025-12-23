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

const supabase = vi.hoisted(() => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: mockSubscriptionRef.current, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    })),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase }));
vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@example.com' } }),
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

  it('returns a stable local date string', () => {
    const value = getLocalDateString(new Date(2025, 0, 5));
    expect(value).toBe('2025-01-05');
  });

  it('handles ISO week boundary changes', () => {
    const sunday = new Date(2025, 11, 21);
    const monday = new Date(2025, 11, 22);
    expect(getWeekNumber(sunday)).not.toBe(getWeekNumber(monday));
  });
});
