'use client';

import { MobileBottomNav } from '@/components/volans/MobileBottomNav';
import { useMultiTabSync } from '@/hooks/useMultiTabSync';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  useMultiTabSync();
  return (
    <div
      className="min-h-screen overflow-x-hidden pb-[88px]"
      style={{
        background: 'var(--volans-bg)',
        color: 'var(--volans-text)',
        fontFamily: 'var(--font-body), "Noto Sans JP", sans-serif',
      }}
    >
      <a href="#main" className="sr-only-focusable">
        メインコンテンツへスキップ
      </a>
      <main id="main" className="volans-page">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
