'use client';

import { useState, useCallback, useRef, type ChangeEvent, type DragEvent } from 'react';
import type { ZoningDistrict, FireDistrict } from '@/engine/types';
import { Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { parseSiteFile } from '@/lib/site-file-parser';
import type { UploadStatus, AnalyzeSiteResponse, RoadDirection, SiteCallbacks } from './site-types';
import { ROAD_WIDTH_PRESETS } from './site-types';
import {
  buildPolygonSite,
  buildRoadFromEdge,
  buildZoningData,
  matchDistrict,
  matchFireDistrict,
  normalizeRatio,
} from './site-helpers';

interface FileUploadProps extends SiteCallbacks {
  /** Current road width for fallback */
  roadWidth: number;
  /** Current selected district for fallback */
  selectedDistrict: ZoningDistrict | null;
  /** Callbacks to sync UI state when image analysis returns data */
  onSiteWidthDetected?: (v: string) => void;
  onSiteDepthDetected?: (v: string) => void;
  onRoadWidthDetected?: (w: number) => void;
  onRoadDirectionDetected?: (d: RoadDirection) => void;
  onDistrictDetected?: (d: ZoningDistrict) => void;
  onCoverageDetected?: (v: string) => void;
  onFarDetected?: (v: string) => void;
  onFireDetected?: (f: FireDistrict) => void;
}

export function FileUpload({
  onSiteChange,
  onRoadsChange,
  onZoningChange,
  onLatitudeChange,
  roadWidth,
  selectedDistrict,
  onSiteWidthDetected,
  onSiteDepthDetected,
  onRoadWidthDetected,
  onRoadDirectionDetected,
  onDistrictDetected,
  onCoverageDetected,
  onFarDetected,
  onFireDetected,
}: FileUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ state: 'idle' });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase().split('.').pop() ?? '';
      const isDataFile = ['csv', 'geojson', 'json', 'sim'].includes(ext);
      const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

      if (!isDataFile && !validImageTypes.includes(file.type)) {
        setUploadStatus({ state: 'error', message: '対応形式: JPEG, PNG, WebP, HEIC, PDF, CSV, GeoJSON' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadStatus({ state: 'error', message: 'ファイルサイズは10MB以下にしてください' });
        return;
      }

      if (isDataFile) {
        try {
          const text = await file.text();
          const result = parseSiteFile(file.name, text);
          onSiteChange(result.site);
          if (result.roads.length > 0) onRoadsChange(result.roads);
          if (result.latitude) onLatitudeChange(result.latitude);
          setUploadStatus({ state: 'success', notes: result.notes });
        } catch (e) {
          setUploadStatus({ state: 'error', message: e instanceof Error ? e.message : 'ファイルの読み込みに失敗しました' });
        }
        return;
      }

      setUploadStatus({ state: 'uploading' });

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/analyze-site', { method: 'POST', body: formData });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setUploadStatus({ state: 'error', message: data.error || '解析に失敗しました' });
          return;
        }

        const data: AnalyzeSiteResponse = await res.json();
        if (data.error) {
          setUploadStatus({ state: 'error', message: data.error });
          return;
        }

        const siteData = data.site;
        const roadData = data.roads?.[0];
        const zoningResult = data.zoning;

        // Sync detected values to parent UI state
        if (siteData?.frontageWidth && siteData.frontageWidth > 0) onSiteWidthDetected?.(String(siteData.frontageWidth));
        if (siteData?.depth && siteData.depth > 0) onSiteDepthDetected?.(String(siteData.depth));
        if (roadData) {
          const dirMap: Record<string, RoadDirection> = { south: 'south', north: 'north', east: 'east', west: 'west' };
          const dir = roadData.direction ? dirMap[roadData.direction] : undefined;
          if (dir) onRoadDirectionDetected?.(dir);
          if (roadData.width && roadData.width > 0) onRoadWidthDetected?.(roadData.width);
        }
        if (zoningResult) {
          if (zoningResult.district) {
            const matched = matchDistrict(zoningResult.district);
            if (matched) onDistrictDetected?.(matched);
          }
          if (zoningResult.coverageRatio != null) {
            const n = normalizeRatio(zoningResult.coverageRatio);
            onCoverageDetected?.(n > 0 ? String(Math.round(n * 100)) : '');
          }
          if (zoningResult.floorAreaRatio != null) {
            const n = normalizeRatio(zoningResult.floorAreaRatio);
            onFarDetected?.(n > 0 ? String(Math.round(n * 100)) : '');
          }
          if (zoningResult.fireDistrict) onFireDetected?.(matchFireDistrict(zoningResult.fireDistrict));
        }

        // Build site from polygon vertices
        const hasPolygon = siteData?.vertices && siteData.vertices.length >= 3;
        if (hasPolygon) {
          const verts = siteData!.vertices!;
          onSiteChange(buildPolygonSite(verts, siteData!.area ?? undefined));

          const allRoads = data.roads;
          if (allRoads && allRoads.length > 0) {
            onRoadsChange(allRoads.map((rd) =>
              buildRoadFromEdge(verts, rd.width ?? roadWidth, rd.edgeVertexIndices, rd.direction),
            ));
          } else {
            onRoadsChange([buildRoadFromEdge(verts, roadData?.width ?? roadWidth, undefined, roadData?.direction)]);
          }

          const dist = (zoningResult?.district ? matchDistrict(zoningResult.district) : null) ?? selectedDistrict;
          if (dist) {
            const cov = zoningResult?.coverageRatio != null ? normalizeRatio(zoningResult.coverageRatio) : undefined;
            const far = zoningResult?.floorAreaRatio != null ? normalizeRatio(zoningResult.floorAreaRatio) : undefined;
            const fire = zoningResult?.fireDistrict ? matchFireDistrict(zoningResult.fireDistrict) : undefined;
            onZoningChange(buildZoningData(dist, {
              coverageRatio: cov && cov > 0 ? cov : undefined,
              floorAreaRatio: far && far > 0 ? far : undefined,
              fireDistrict: fire,
            }));
          }
        }

        setUploadStatus({
          state: 'success',
          notes: data.notes || `${data.confidence === 'high' ? '高精度' : data.confidence === 'medium' ? '中精度' : '低精度'}で読み取りました`,
        });
      } catch {
        setUploadStatus({ state: 'error', message: 'サーバーに接続できませんでした' });
      }
    },
    [onSiteChange, onRoadsChange, onZoningChange, onLatitudeChange, roadWidth, selectedDistrict, onSiteWidthDetected, onSiteDepthDetected, onRoadWidthDetected, onRoadDirectionDetected, onDistrictDetected, onCoverageDetected, onFarDetected, onFireDetected],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload],
  );

  const handleInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
      e.target.value = '';
    },
    [handleFileUpload],
  );

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">図面から読み取り</label>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-4 cursor-pointer transition-colors ${
          isDragOver ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-muted-foreground/40'
        } ${uploadStatus.state === 'uploading' ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.csv,.geojson,.json,.sim"
          onChange={handleInput}
          className="hidden"
        />
        {uploadStatus.state === 'uploading' ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-primary">AI解析中...</span>
          </div>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">測量図・座標データをドロップ</span>
            <span className="text-[10px] text-muted-foreground/60">JPEG, PNG, PDF, CSV, GeoJSON, SIMA</span>
          </>
        )}
      </div>

      {uploadStatus.state === 'success' && (
        <div className="flex items-start gap-1.5 rounded-md bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
          <p className="text-[11px] text-emerald-300">{uploadStatus.notes}</p>
        </div>
      )}

      {uploadStatus.state === 'error' && (
        <div className="flex items-start gap-1.5 rounded-md bg-red-950/40 border border-red-800/40 px-2.5 py-2">
          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-400" />
          <p className="text-[11px] text-red-300">{uploadStatus.message}</p>
        </div>
      )}
    </div>
  );
}
