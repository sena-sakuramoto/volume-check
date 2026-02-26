'use client';

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SnapPoint = 'collapsed' | 'half' | 'full';

const SNAP_VH: Record<SnapPoint, number> = {
  collapsed: 10,
  half: 50,
  full: 90,
};

interface BottomSheetProps {
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ children, className }: BottomSheetProps) {
  const [snap, setSnap] = useState<SnapPoint>('half');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startSnap = useRef<SnapPoint>('half');

  const currentVh = SNAP_VH[snap];

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startSnap.current = snap;
    setIsDragging(true);
  }, [snap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const dy = startY.current - e.touches[0].clientY;
    setDragOffset(dy);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const baseVh = SNAP_VH[startSnap.current];
    const windowH = window.innerHeight;
    const deltaVh = (dragOffset / windowH) * 100;
    const targetVh = baseVh + deltaVh;

    // Snap to closest
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
  }, [dragOffset]);

  const heightStyle = isDragging
    ? { height: `calc(${SNAP_VH[startSnap.current]}vh + ${dragOffset}px)` }
    : { height: `${currentVh}vh` };

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 z-20 bg-card/98 backdrop-blur-md border-t border-border rounded-t-2xl transition-[height] duration-300 ease-out flex flex-col',
        isDragging && 'transition-none',
        className,
      )}
      style={heightStyle}
    >
      {/* Drag handle */}
      <div
        className="flex justify-center pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing shrink-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => {
          startY.current = e.clientY;
          startSnap.current = snap;
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
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
