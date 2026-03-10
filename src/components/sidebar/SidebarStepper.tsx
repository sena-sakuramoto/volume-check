'use client';

import type { ComponentType } from 'react';
import { cn } from '@/lib/cn';
import { MapPin, Scale } from 'lucide-react';
import { ChartBar } from '@phosphor-icons/react';

export type Step = 1 | 2 | 3;

interface SidebarStepperProps {
  activeStep: Step;
  onStepChange: (step: Step) => void;
  completedSteps: { 1: boolean; 2: boolean; 3: boolean };
  readySteps: { 1: boolean; 2: boolean; 3: boolean };
}

type StepIcon = ComponentType<{ className?: string }>;

const STEPS: Array<{
  step: Step;
  label: string;
  sublabel: string;
  Icon: StepIcon;
}> = [
  { step: 1, label: '敷地', sublabel: '入力', Icon: MapPin },
  { step: 2, label: '法規', sublabel: '設定', Icon: Scale },
  { step: 3, label: '結果', sublabel: '確認', Icon: ChartBar },
];

export function SidebarStepper({
  activeStep,
  onStepChange,
  completedSteps,
  readySteps,
}: SidebarStepperProps) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 pb-4">
      {STEPS.map(({ step, label, sublabel, Icon }) => {
        const isActive = activeStep === step;
        const isCompleted = completedSteps[step];
        const isReady = readySteps[step];

        return (
          <button
            key={step}
            onClick={() => onStepChange(step)}
            className={cn(
              'ui-surface-soft flex min-h-[90px] flex-col items-start gap-2 px-3 py-3 text-left transition-all',
              isActive
                ? 'border-[rgba(15,140,131,0.28)] bg-[linear-gradient(180deg,rgba(226,248,244,0.96),rgba(245,250,247,0.92))] shadow-[0_12px_28px_rgba(15,140,131,0.12)]'
                : isCompleted
                  ? 'border-[rgba(15,140,131,0.18)]'
                  : isReady
                    ? 'opacity-88 hover:opacity-100'
                    : 'border-dashed border-border/80 bg-white/55 text-muted-foreground/90 hover:bg-white/70',
            )}
          >
            <div className="flex w-full items-center justify-between">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCompleted
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border bg-white/80 text-muted-foreground',
                )}
              >
                {isCompleted && !isActive ? '✓' : step}
              </div>
              <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : isReady ? 'text-muted-foreground' : 'text-muted-foreground/70')} />
            </div>

            <div>
              <p className="text-[11px] font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground">{sublabel}</p>
              {!isCompleted && !isReady ? (
                <p className="mt-1 text-[9px] font-medium text-amber-800">前の入力がまだ途中</p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
