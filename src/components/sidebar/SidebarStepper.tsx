'use client';

import { cn } from '@/lib/cn';
import { MapPin, Scale, BarChart3 } from 'lucide-react';

export type Step = 1 | 2 | 3;

interface SidebarStepperProps {
  activeStep: Step;
  onStepChange: (step: Step) => void;
  /** Indicates if each step has been completed */
  completedSteps: { 1: boolean; 2: boolean; 3: boolean };
}

const STEPS: { step: Step; label: string; Icon: typeof MapPin }[] = [
  { step: 1, label: '敷地', Icon: MapPin },
  { step: 2, label: '法規', Icon: Scale },
  { step: 3, label: '結果', Icon: BarChart3 },
];

export function SidebarStepper({ activeStep, onStepChange, completedSteps }: SidebarStepperProps) {
  return (
    <div className="flex items-center justify-center gap-0 px-4 py-3">
      {STEPS.map(({ step, label, Icon }, idx) => {
        const isActive = activeStep === step;
        const isCompleted = completedSteps[step];
        return (
          <div key={step} className="flex items-center">
            <button
              onClick={() => onStepChange(step)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : isCompleted
                    ? 'text-primary/60 hover:text-primary/80'
                    : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <div className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : isCompleted
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground',
              )}>
                {isCompleted && !isActive ? (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span className={isActive ? '' : 'hidden sm:inline'}>{label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={cn(
                'h-px w-6 mx-0.5',
                isCompleted ? 'bg-primary/30' : 'bg-border',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
