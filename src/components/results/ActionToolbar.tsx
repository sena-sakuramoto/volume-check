'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ZoningData, VolumeResult, SiteBoundary, Road } from '@/engine/types';
import { CheckCircle2 } from 'lucide-react';
import { FilePdf, FloppyDisk } from '@phosphor-icons/react';
import { Button } from '@/components/ui/shadcn/button';
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
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
    if (!site || !zoning) return;
    saveProject({ site, roads, zoning, latitude, floorHeights, savedAt: '' });
    setSaved(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaved(false), 2000);
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
        <FilePdf className="h-3.5 w-3.5 mr-1" weight="regular" />
        PDF出力
      </Button>
      <Button
        onClick={handleSave}
        disabled={!site || !zoning || saved}
        variant="secondary"
        size="sm"
        className="flex-1"
      >
        {saved ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
            保存済み
          </>
        ) : (
          <>
            <FloppyDisk className="h-3.5 w-3.5 mr-1" weight="regular" />
            保存
          </>
        )}
      </Button>
    </div>
  );
}
