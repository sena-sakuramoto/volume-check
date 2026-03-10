'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SnapPoint = 'collapsed' | 'half' | 'full';

const SNAP_VH: Record<SnapPoint, number> = {
  collapsed: 12,
  half: 56,
  full: 92,
};

interface BottomSheetProps {
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ children, className }: BottomSheetProps) {
  const [snap, setSnap] = useState<SnapPoint>('half');
  const [dragOffset, setDragOffset] = useState(0);
  const [dragBaseVh, setDragBaseVh] = useState(SNAP_VH.half);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  const currentVh = SNAP_VH[snap];

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setDragBaseVh(SNAP_VH[snap]);
    setIsDragging(true);
  }, [snap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const dy = startY.current - e.touches[0].clientY;
    setDragOffset(dy);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const baseVh = dragBaseVh;
    const windowH = window.innerHeight;
    const deltaVh = (dragOffset / windowH) * 100;
    const targetVh = baseVh + deltaVh;

    let bestSnap: SnapPoint = 'half';
    let bestDist = Infinity;
    for (const [key, val] of Object.entries(SNAP_VH)) {
      const dist = Math.abs(targetVh - val);
      if (dist < bestDist) {
        bestDist = dist;
        bestSnap = key as SnapPoint;
      }
    }

    setSnap(bestSnap);
    setDragOffset(0);
  }, [dragBaseVh, dragOffset]);

  const heightStyle = isDragging
    ? { height: `calc(${dragBaseVh}vh + ${dragOffset}px)` }
    : { height: `${currentVh}vh` };

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 z-20 flex flex-col rounded-t-[28px] border-t border-white/70 bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(247,241,230,0.96))] shadow-[0_-18px_42px_rgba(24,37,43,0.16)] backdrop-blur-xl transition-[height] duration-300 ease-out',
        isDragging && 'transition-none',
        className,
      )}
      style={heightStyle}
    >
      <div
        className="shrink-0 cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => {
          startY.current = e.clientY;
          setDragBaseVh(SNAP_VH[snap]);
          setIsDragging(true);
          const handleMove = (ev: MouseEvent) => {
            setDragOffset(startY.current - ev.clientY);
          };
          const handleUp = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
            handleTouchEnd();
          };
          document.addEventListener('mousemove', handleMove);
          document.addEventListener('mouseup', handleUp);
        }}
      >
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1.5 w-12 rounded-full bg-primary/25" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {children}
      </div>
    </div>
  );
}
