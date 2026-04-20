/**
 * Tiny haptic feedback helper for primary actions on mobile.
 *
 * Uses the Vibration API when available (Android Chrome / Samsung Internet /
 * some wrappers). Silently no-ops on iOS Safari where vibrate() is blocked
 * and on desktop where there's no haptic hardware.
 *
 * Scope: primary actions only (CTAs, FAB, submit). Over-use makes the UX
 * noisy, so callers should keep it for meaningful confirmations, not on
 * every tap.
 */
export function hapticTap(durationMs: number = 10): void {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(durationMs);
  } catch {
    // Some privacy contexts throw; silently ignore.
  }
}

export function hapticConfirm(): void {
  hapticTap(18);
}

export function hapticDoubleTap(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate([10, 40, 10]);
  } catch {
    // ignore
  }
}
