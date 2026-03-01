'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import type { Step } from '@/components/sidebar/SidebarStepper';

interface MobileStepperProps {
  activeStep: Step;
  onStepChange: (step: Step) => void;
}

const TABS: { value: string; label: string; step: Step }[] = [
  { value: '1', label: '敷地', step: 1 },
  { value: '2', label: '法規', step: 2 },
  { value: '3', label: '結果', step: 3 },
];

export function MobileStepper({ activeStep, onStepChange }: MobileStepperProps) {
  return (
    <div className="px-3 pt-1 pb-2 shrink-0">
      <Tabs
        value={String(activeStep)}
        onValueChange={(v) => onStepChange(Number(v) as Step)}
      >
        <TabsList className="w-full">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-1 text-xs">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
