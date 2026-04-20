'use client';

/**
 * Click handler that sets CSS custom properties for the ripple origin so
 * the ::after expands from where the user actually pressed. Attach to
 * onPointerDown (not onClick) so the ripple fires on press, not release.
 *
 * Usage:
 *   <button
 *     className="volans-btn-press volans-btn-primary ..."
 *     onPointerDown={setRippleOrigin}
 *     onClick={...}
 *   />
 */
export function setRippleOrigin(e: React.PointerEvent<HTMLElement>): void {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  el.style.setProperty('--ripple-x', `${x}px`);
  el.style.setProperty('--ripple-y', `${y}px`);
}
