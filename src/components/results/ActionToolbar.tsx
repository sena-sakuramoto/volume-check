'use client';

import { useCallback } from 'react';
import { FilePdf } from '@phosphor-icons/react';
import type { Road, SiteBoundary, VolumeResult, ZoningData } from '@/engine/types';
import type { FeasibilitySnapshot } from '@/components/results/FeasibilitySection';
import type { SitePrecision } from '@/components/site/site-types';
import { getSitePrecisionLabel } from '@/components/site/site-types';
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
  sitePrecision: SitePrecision;
  roadReady: boolean;
  roads: Road[];
  floorHeights: number[];
  feasibility: FeasibilitySnapshot | null;
}

export function ActionToolbar({
  zoning,
  result,
  site,
  sitePrecision,
  roadReady,
  roads,
  floorHeights,
  feasibility,
}: ActionToolbarProps) {
  const handlePdf = useCallback(() => {
    if (!zoning || !result || !roadReady) return;
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
  }, [feasibility, floorHeights, result, roadReady, roads, site, zoning]);

  return (
    <div className="ui-surface flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          Export
        </p>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          現在の計算結果と試算条件を PDF レポートとして出力します。
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          敷地状態: {getSitePrecisionLabel(sitePrecision)}
        </p>
        {!roadReady ? (
          <p className="mt-1 text-[10px] text-amber-700">
            接道条件を確定すると PDF 出力できます。
          </p>
        ) : null}
      </div>
      <Button onClick={handlePdf} disabled={!result || !roadReady} size="sm" className="shrink-0">
        <FilePdf className="mr-1 h-3.5 w-3.5" weight="regular" />
        PDF出力
      </Button>
    </div>
  );
}
