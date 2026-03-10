'use client';

import { useCallback } from 'react';
import { FilePdf } from '@phosphor-icons/react';
import type { Road, SiteBoundary, VolumeResult, ZoningData } from '@/engine/types';
import type { FeasibilitySnapshot } from '@/components/results/FeasibilitySection';
import { Button } from '@/components/ui/shadcn/button';
import { generatePdfReport } from '@/lib/pdf-export';

const DIRECTION_LABELS: Record<number, string> = {
  0: '北',
  90: '東',
  180: '南',
  270: '西',
};

interface ActionToolbarProps {
  zoning: ZoningData | null;
  result: VolumeResult | null;
  site: SiteBoundary | null;
  roads: Road[];
  floorHeights: number[];
  feasibility: FeasibilitySnapshot | null;
}

export function ActionToolbar({
  zoning,
  result,
  site,
  roads,
  floorHeights,
  feasibility,
}: ActionToolbarProps) {
  const handlePdf = useCallback(() => {
    if (!zoning || !result) return;
    const directionLabel = (bearing: number) => DIRECTION_LABELS[bearing] ?? `${bearing}°`;

    generatePdfReport(
      zoning,
      result,
      site?.area ?? 0,
      floorHeights,
      roads.map((road) => ({
        direction: directionLabel(road.bearing),
        width: road.width,
      })),
      feasibility,
    );
  }, [feasibility, floorHeights, result, roads, site, zoning]);

  return (
    <div className="ui-surface flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          Export
        </p>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          現在の条件と試算結果を PDF レポートとして出力します。
        </p>
      </div>
      <Button onClick={handlePdf} disabled={!result} size="sm" className="shrink-0">
        <FilePdf className="mr-1 h-3.5 w-3.5" weight="regular" />
        PDF出力
      </Button>
    </div>
  );
}
