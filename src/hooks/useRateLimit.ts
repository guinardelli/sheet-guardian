import { useState, useCallback, useRef } from 'react';

interface RateLimitState {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 3;
const WINDOW_MS = 60 * 1000; // 1 minute
const LOCKOUT_MS = 60 * 1000; // 1 minute lockout

export const useRateLimit = (key: string = 'auth') => {
  const stateRef = useRef<RateLimitState>({
    attempts: 0,
    lastAttempt: 0,
    lockedUntil: null,
  });

  const [isLocked, setIsLocked] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const checkRateLimit = useCallback((): { allowed: boolean; message?: string } => {
    const now = Date.now();
    const state = stateRef.current;

    // Check if currently locked out
    if (state.lockedUntil && now < state.lockedUntil) {
      const remaining = Math.ceil((state.lockedUntil - now) / 1000);
      setRemainingTime(remaining);
      setIsLocked(true);
      return {
        allowed: false,
        message: `Muitas tentativas. Aguarde ${remaining} segundos.`,
      };
    }

    // Reset if lockout expired
    if (state.lockedUntil && now >= state.lockedUntil) {
      state.lockedUntil = null;
      state.attempts = 0;
      setIsLocked(false);
    }

    // Reset attempts if window expired
    if (now - state.lastAttempt > WINDOW_MS) {
      state.attempts = 0;
    }

    return { allowed: true };
  }, []);

  const recordAttempt = useCallback((success: boolean) => {
    const now = Date.now();
    const state = stateRef.current;

    if (success) {
      // Reset on successful attempt
      state.attempts = 0;
      state.lastAttempt = now;
      state.lockedUntil = null;
      setIsLocked(false);
      return;
    }

    // Record failed attempt
    state.attempts += 1;
    state.lastAttempt = now;

    // Lock if max attempts reached
    if (state.attempts >= MAX_ATTEMPTS) {
      state.lockedUntil = now + LOCKOUT_MS;
      setIsLocked(true);
      setRemainingTime(Math.ceil(LOCKOUT_MS / 1000));
    }
  }, []);

  const getRemainingAttempts = useCallback((): number => {
    return Math.max(0, MAX_ATTEMPTS - stateRef.current.attempts);
  }, []);

  return {
    checkRateLimit,
    recordAttempt,
    getRemainingAttempts,
    isLocked,
    remainingTime,
  };
};
