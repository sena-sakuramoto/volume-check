'use client';

import Link from 'next/link';
import { ChevronLeft, Menu, MoreVertical } from 'lucide-react';
import { VolansLogo } from './VolansLogo';

interface MobileHeaderProps {
  back?: string;
  title?: string;
  subtitle?: string;
  showMenu?: boolean;
  actions?: React.ReactNode;
}

export function MobileHeader({
  back,
  title,
  subtitle,
  showMenu = true,
  actions,
}: MobileHeaderProps) {
  return (
    <header
      className="flex h-12 shrink-0 items-center justify-between gap-2 px-3"
      style={{
        background: 'var(--volans-surface)',
        borderBottom: `1px solid var(--volans-border)`,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {back ? (
          <Link
            href={back}
            className="grid h-8 w-8 place-items-center rounded-md"
            style={{ color: 'var(--volans-text)' }}
            aria-label="戻る"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <VolansLogo size={26} compact />
        )}
        <div className="min-w-0 leading-tight">
          {title && (
            <div
              className="truncate text-[13px] font-semibold"
              style={{ color: 'var(--volans-text)' }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              className="truncate text-[10px]"
              style={{ color: 'var(--volans-muted)' }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {actions}
        {showMenu && (
          <button
            className="grid h-8 w-8 place-items-center rounded-md"
            style={{ color: 'var(--volans-text)' }}
            aria-label="メニュー"
          >
            {back ? <MoreVertical className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        )}
      </div>
    </header>
  );
}
