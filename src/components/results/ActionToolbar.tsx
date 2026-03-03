'use client';

import { useCallback } from 'react';
import type { ZoningData, VolumeResult, SiteBoundary, Road } from '@/engine/types';
import type { FeasibilitySnapshot } from '@/components/results/FeasibilitySection';
import { FilePdf } from '@phosphor-icons/react';
import { Button } from '@/components/ui/shadcn/button';
import { generatePdfReport } from '@/lib/pdf-export';

const DIRECTION_LABELS: Record<number, string> = {
  0: '北', 90: '東', 180: '南', 270: '西',
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
    const dirLabel = (bearing: number) => DIRECTION_LABELS[bearing] ?? `${bearing}°`;
    generatePdfReport(
      zoning,
      result,
      site?.area ?? 0,
      floorHeights,
      roads.map((r) => ({ direction: dirLabel(r.bearing), width: r.width })),
      feasibility,
    );
  }, [zoning, result, site, roads, floorHeights, feasibility]);

  return (
    <div className="flex">
      <Button
        onClick={handlePdf}
        disabled={!result}
        variant="secondary"
        size="sm"
        className="w-full"
      >
        <FilePdf className="h-3.5 w-3.5 mr-1" weight="regular" />
        PDF出力
      </Button>
    </div>
  );
}
