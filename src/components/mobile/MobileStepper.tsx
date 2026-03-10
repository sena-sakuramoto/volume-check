'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Step } from '@/components/sidebar/SidebarStepper';

interface MobileStepperProps {
  activeStep: Step;
  onStepChange: (step: Step) => void;
  completedSteps?: { 1: boolean; 2: boolean; 3: boolean };
  readySteps: { 1: boolean; 2: boolean; 3: boolean };
}

const TABS: Array<{ step: Step; label: string; sublabel: string }> = [
  { step: 1, label: '敷地入力', sublabel: '敷地と接道' },
  { step: 2, label: '法規設定', sublabel: '用途地域など' },
  { step: 3, label: '結果確認', sublabel: 'ボリューム' },
];

export function MobileStepper({
  activeStep,
  onStepChange,
  completedSteps,
  readySteps,
}: MobileStepperProps) {
  return (
    <div className="shrink-0">
      <div className="ui-surface-soft grid grid-cols-3 gap-1.5 px-2 py-2">
        {TABS.map((tab) => {
          const isActive = activeStep === tab.step;
          const isCompleted = completedSteps?.[tab.step] === true;
          const isReady = readySteps[tab.step];

          return (
            <button
              key={tab.step}
              type="button"
              onClick={() => onStepChange(tab.step)}
              className={cn(
                'rounded-2xl px-2 py-2.5 text-left transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : isReady
                    ? 'bg-white/80 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    : 'border border-dashed border-border/80 bg-white/60 text-muted-foreground',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold',
                    isActive
                      ? 'border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground'
                      : isCompleted
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border/80 bg-white text-muted-foreground',
                  )}
                >
                  {isCompleted && !isActive ? <Check className="h-3.5 w-3.5" /> : tab.step}
                </span>
                {!isCompleted && !isReady ? (
                  <span className="text-[9px] font-semibold tracking-[0.08em] text-amber-800">
                    途中
                  </span>
                ) : null}
              </div>
              <div className="mt-2 text-[11px] font-semibold">{tab.label}</div>
              <div
                className={cn(
                  'text-[9px]',
                  isActive ? 'text-primary-foreground/80' : 'text-muted-foreground',
                )}
              >
                {tab.sublabel}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
