'use client';

import { SidebarStepper, type Step } from './SidebarStepper';
import { PanelLeftClose, PanelLeft } from 'lucide-react';

interface SidebarProps {
  activeStep: Step;
  onStepChange: (step: Step) => void;
  completedSteps: { 1: boolean; 2: boolean; 3: boolean };
  readySteps: { 1: boolean; 2: boolean; 3: boolean };
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  children: React.ReactNode;
}

const STEP_META: Record<
  Step,
  { eyebrow: string; title: string; description: string }
> = {
  1: {
    eyebrow: 'Step 1',
    title: '敷地と道路条件',
    description: '住所検索、図面読取、手入力から敷地と接道条件を固めます。',
  },
  2: {
    eyebrow: 'Step 2',
    title: '法規を確認',
    description: '用途地域や斜線条件を確認し、必要があれば手動で調整します。',
  },
  3: {
    eyebrow: 'Step 3',
    title: 'ボリューム結果',
    description: '最大ボリューム、階高、事業性、出力までをまとめて確認します。',
  },
};

export function Sidebar({
  activeStep,
  onStepChange,
  completedSteps,
  readySteps,
  collapsed,
  onCollapsedChange,
  children,
}: SidebarProps) {
  if (collapsed) {
    return (
      <button
        onClick={() => onCollapsedChange(false)}
        className="ui-surface-soft flex shrink-0 items-center gap-2 self-start px-3 py-3 text-left"
        title="サイドバーを開く"
      >
        <PanelLeft className="h-5 w-5 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground">開く</span>
      </button>
    );
  }

  const meta = STEP_META[activeStep];

  return (
    <aside className="app-panel flex w-[360px] shrink-0 flex-col overflow-hidden">
      <div className="ui-surface-soft border-b border-border/70">
        <div className="flex items-start justify-between px-4 pt-4">
          <div className="pr-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
              {meta.eyebrow}
            </p>
            <h2 className="mt-2 font-display text-lg font-semibold text-foreground">
              {meta.title}
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {meta.description}
            </p>
          </div>
          <button
            onClick={() => onCollapsedChange(true)}
            className="rounded-full border border-white/70 bg-white/75 p-2 text-muted-foreground transition-colors hover:text-foreground"
            title="サイドバーを閉じる"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <div className="pt-3">
          <SidebarStepper
            activeStep={activeStep}
            onStepChange={onStepChange}
            completedSteps={completedSteps}
            readySteps={readySteps}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {children}
      </div>
    </aside>
  );
}
