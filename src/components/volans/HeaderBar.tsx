'use client';

import { Pencil, FileDown } from 'lucide-react';
import { VolansLogo } from './VolansLogo';
import { StepIndicator } from './StepIndicator';
import { ProjectSwitcher } from './ProjectSwitcher';
import { ShareLinkButton } from './ShareLinkButton';
import { AuthBadge } from './AuthBadge';
import { ThemeToggle } from './ThemeToggle';
import { VOLANS_DEMO } from '@/lib/volans-demo';

interface HeaderBarProps {
  activeStep?: number;
  projectName?: string;
  updatedAt?: string;
  onExportPdf?: () => void;
  onEditName?: () => void;
}

export function HeaderBar({
  activeStep = 3,
  projectName,
  updatedAt,
  onExportPdf,
  onEditName,
}: HeaderBarProps) {
  const name = projectName ?? VOLANS_DEMO.projectName;
  const updated = updatedAt ?? VOLANS_DEMO.updatedAt;
  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between px-4"
      style={{
        background: 'var(--volans-surface)',
        borderBottom: `1px solid var(--volans-border)`,
      }}
    >
      <div className="flex items-center gap-6">
        <VolansLogo size={32} />
        <div className="hidden items-center gap-5 md:flex">
          <div className="flex items-center gap-1.5">
            <div
              className="text-[13px] font-semibold"
              style={{ color: 'var(--volans-text)' }}
            >
              {name}
            </div>
            <button
              onClick={() => {
                if (onEditName) return onEditName();
                const next = typeof window !== 'undefined'
                  ? window.prompt('プロジェクト名を変更', name)
                  : null;
                if (next && next.trim()) {
                  import('@/stores/useVolansStore').then((m) =>
                    m.useVolansStore.getState().setProjectName(next.trim()),
                  );
                }
              }}
              aria-label="プロジェクト名を編集"
              className="grid h-5 w-5 place-items-center rounded transition-colors hover:bg-slate-100 hover:text-[var(--volans-primary)]"
              style={{ color: 'var(--volans-muted)' }}
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          <div
            className="text-[11px] tabular-nums"
            style={{ color: 'var(--volans-muted)' }}
          >
            最終更新: {updated}
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <StepIndicator activeId={activeStep} />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onExportPdf}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] transition-all hover:border-[var(--volans-primary)] hover:text-[var(--volans-primary-strong)] active:scale-95"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border-strong)`,
            color: 'var(--volans-text)',
          }}
        >
          <FileDown className="h-3.5 w-3.5" />
          レポート出力 (PDF)
        </button>
        <ShareLinkButton />
        <ProjectSwitcher />
        <ThemeToggle />
        <AuthBadge />
      </div>
    </header>
  );
}
