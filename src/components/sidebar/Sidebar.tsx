'use client';

import { SidebarStepper, type Step } from './SidebarStepper';
import { PanelLeftClose, PanelLeft } from 'lucide-react';

interface SidebarProps {
  activeStep: Step;
  onStepChange: (step: Step) => void;
  completedSteps: { 1: boolean; 2: boolean; 3: boolean };
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  children: React.ReactNode;
}

export function Sidebar({
  activeStep,
  onStepChange,
  completedSteps,
  collapsed,
  onCollapsedChange,
  children,
}: SidebarProps) {
  if (collapsed) {
    return (
      <button
        onClick={() => onCollapsedChange(false)}
        className="shrink-0 flex items-start pt-4 px-1"
        title="サイドバーを開く"
      >
        <PanelLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
      </button>
    );
  }

  return (
    <aside className="app-panel w-[340px] shrink-0 overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between border-b border-border">
        <SidebarStepper
          activeStep={activeStep}
          onStepChange={onStepChange}
          completedSteps={completedSteps}
        />
        <button
          onClick={() => onCollapsedChange(true)}
          className="pr-3 text-muted-foreground hover:text-foreground transition-colors"
          title="サイドバーを閉じる"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </aside>
  );
}
