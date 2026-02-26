'use client';

import { useCallback } from 'react';
import type { ZoningData, VolumeResult, SiteBoundary, Road } from '@/engine/types';
import { Button } from '@/components/ui/shadcn/button';
import { FileDown, Save } from 'lucide-react';
import { generatePdfReport } from '@/lib/pdf-export';
import { saveProject } from '@/lib/project-storage';

const DIRECTION_LABELS: Record<number, string> = {
  0: '北', 90: '東', 180: '南', 270: '西',
};

interface ActionToolbarProps {
  zoning: ZoningData | null;
  result: VolumeResult | null;
  site: SiteBoundary | null;
  roads: Road[];
  floorHeights: number[];
  latitude: number;
}

export function ActionToolbar({ zoning, result, site, roads, floorHeights, latitude }: ActionToolbarProps) {
  const handlePdf = useCallback(() => {
    if (!zoning || !result) return;
    const dirLabel = (bearing: number) => DIRECTION_LABELS[bearing] ?? `${bearing}°`;
    generatePdfReport(
      zoning,
      result,
      site?.area ?? 0,
      floorHeights,
      roads.map((r) => ({ direction: dirLabel(r.bearing), width: r.width })),
    );
  }, [zoning, result, site, roads, floorHeights]);

  const handleSave = useCallback(() => {
    if (!site || !zoning || !roads) return;
    saveProject({ site, roads, zoning, latitude, floorHeights, savedAt: '' });
    alert('保存しました');
  }, [site, roads, zoning, latitude, floorHeights]);

  return (
    <div className="flex gap-2">
      <Button
        onClick={handlePdf}
        disabled={!result}
        variant="secondary"
        size="sm"
        className="flex-1"
      >
        <FileDown className="h-3.5 w-3.5 mr-1" />
        PDF出力
      </Button>
      <Button
        onClick={handleSave}
        disabled={!site || !zoning}
        variant="secondary"
        size="sm"
        className="flex-1"
      >
        <Save className="h-3.5 w-3.5 mr-1" />
        保存
      </Button>
    </div>
  );
}
