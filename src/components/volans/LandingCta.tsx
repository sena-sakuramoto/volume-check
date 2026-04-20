'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Smartphone } from 'lucide-react';
import { setRippleOrigin } from '@/lib/button-press';
import { hapticTap } from '@/lib/haptic';

/**
 * Landing CTA row. Client-only so pointer handlers + router prefetch work.
 * Uses the shared `.volans-btn-press` press-feedback (Apple HIG + Material
 * Design 3 hybrid): scale 0.94 on press, ripple from click origin,
 * brightness dip, and bounce-back release.
 */
export function LandingCta() {
  const router = useRouter();
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <button
        onPointerDown={setRippleOrigin}
        onClick={() => {
          hapticTap(10);
          router.push('/sky');
        }}
        className="volans-btn-press volans-btn-primary group flex items-center gap-2 overflow-hidden rounded-lg px-6 py-3 text-[14px] font-semibold"
      >
        今すぐ試す
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
      <Link
        href="/m"
        onPointerDown={setRippleOrigin}
        className="volans-btn-press volans-btn-secondary flex items-center gap-2 overflow-hidden rounded-lg px-5 py-3 text-[14px] font-medium hover:border-[var(--volans-primary)] hover:text-[var(--volans-primary-strong)]"
      >
        <Smartphone className="h-4 w-4" />
        モバイル版
      </Link>
    </div>
  );
}
