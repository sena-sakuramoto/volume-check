'use client';

import { MobileBottomNav } from '@/components/volans/MobileBottomNav';
import { useMultiTabSync } from '@/hooks/useMultiTabSync';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  useMultiTabSync();
  return (
    <div
      className="min-h-screen overflow-x-hidden pb-[64px]"
      style={{
        background: 'var(--volans-bg)',
        color: 'var(--volans-text)',
        fontFamily: 'var(--font-body), "Noto Sans JP", sans-serif',
      }}
    >
      {children}
      <MobileBottomNav />
    </div>
  );
}
