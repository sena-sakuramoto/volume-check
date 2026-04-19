'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderOpen, Plus, BarChart3, Menu } from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
};

const ITEMS: NavItem[] = [
  { href: '/m', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/m/compare', label: 'プロジェクト', icon: FolderOpen },
  { href: '/m/input', label: '', icon: Plus, primary: true },
  { href: '/m/3d', label: '解析', icon: BarChart3 },
  { href: '/m/ai', label: 'メニュー', icon: Menu },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      data-volans-bottom-nav="true"
      className="fixed bottom-0 left-0 right-0 z-30 flex h-[60px] items-stretch justify-around px-2 pb-1 pt-1"
      style={{
        background: 'var(--volans-surface)',
        borderTop: `1px solid var(--volans-border)`,
      }}
    >
      {ITEMS.map((it) => {
        const Icon = it.icon;
        const active = pathname === it.href;
        if (it.primary) {
          return (
            <Link
              key={it.href}
              href={it.href}
              className="-mt-5 grid h-12 w-12 place-items-center rounded-full text-white shadow-md"
              style={{ background: 'var(--volans-primary)' }}
              aria-label="新規"
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        }
        return (
          <Link
            key={it.href}
            href={it.href}
            className="flex flex-1 flex-col items-center justify-center gap-0.5"
            style={{
              color: active ? 'var(--volans-primary)' : 'var(--volans-muted)',
            }}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[9px]">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
