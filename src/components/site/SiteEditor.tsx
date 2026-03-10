'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { SiteBoundary } from '@/engine/types';
import { Input } from '@/components/ui/shadcn/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/shadcn/toggle-group';

interface SiteEditorProps {
  site: SiteBoundary | null;
  onSiteChange: (site: SiteBoundary) => void;
  siteWidth: string;
  siteDepth: string;
  onSiteWidthChange: (v: string) => void;
  onSiteDepthChange: (v: string) => void;
  siteMode: 'rect' | 'polygon';
  onSiteModeChange: (mode: 'rect' | 'polygon') => void;
}

interface Vertex {
  id: string;
  x: string;
  y: string;
}

let nextId = 1;
function genId() {
  return String(nextId++);
}

function computeArea(vertices: { x: number; y: number }[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

function formatCoord(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '0.0';
}

const DEFAULT_VERTICES: Vertex[] = [
  { id: genId(), x: '0', y: '0' },
  { id: genId(), x: '10', y: '0' },
  { id: genId(), x: '10', y: '15' },
  { id: genId(), x: '0', y: '15' },
];

function toVertexState(site: SiteBoundary | null): Vertex[] {
  if (!site || site.vertices.length < 3) return DEFAULT_VERTICES;
  return site.vertices.map((vertex) => ({
    id: genId(),
    x: formatCoord(vertex.x),
    y: formatCoord(vertex.y),
  }));
}

function createInitialPolygonDraft(site: SiteBoundary | null): {
  vertices: Vertex[];
  selectedVertexId: string | null;
} {
  const vertices = toVertexState(site);
  return {
    vertices,
    selectedVertexId: vertices[0]?.id ?? null,
  };
}

function PolygonEditor({
  site,
  onSiteChange,
}: {
  site: SiteBoundary | null;
  onSiteChange: (site: SiteBoundary) => void;
}) {
  const [draft, setDraft] = useState(() => createInitialPolygonDraft(site));
  const [draggingVertexId, setDraggingVertexId] = useState<string | null>(null);
  const vertices = draft.vertices;
  const selectedVertexId = draft.selectedVertexId;

  const setVertices = useCallback((updater: Vertex[] | ((prev: Vertex[]) => Vertex[])) => {
    setDraft((prev) => ({
      ...prev,
      vertices: typeof updater === 'function'
        ? (updater as (prev: Vertex[]) => Vertex[])(prev.vertices)
        : updater,
    }));
  }, []);

  const setSelectedVertexId = useCallback((value: string | null) => {
    setDraft((prev) => ({ ...prev, selectedVertexId: value }));
  }, []);

  const parsedVertices = useMemo(
    () =>
      vertices.map((vertex) => ({
        id: vertex.id,
        x: Number.parseFloat(vertex.x),
        y: Number.parseFloat(vertex.y),
      })),
    [vertices],
  );

  const validVertices = useMemo(
    () => parsedVertices.filter((vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y)),
    [parsedVertices],
  );

  const area = useMemo(() => {
    if (validVertices.length < 3) return 0;
    return computeArea(validVertices);
  }, [validVertices]);

  const isValid = validVertices.length >= 3 && area > 0;
  const svgSize = 220;
  const padding = 18;

  const viewState = useMemo(() => {
    if (validVertices.length === 0) return null;

    const xs = validVertices.map((vertex) => vertex.x);
    const ys = validVertices.map((vertex) => vertex.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = Math.min((svgSize - padding * 2) / rangeX, (svgSize - padding * 2) / rangeY);

    const toSvg = (point: { x: number; y: number }) => ({
      x: padding + (point.x - minX) * scale,
      y: svgSize - padding - (point.y - minY) * scale,
    });

    const fromSvg = (point: { x: number; y: number }) => ({
      x: minX + (point.x - padding) / scale,
      y: minY + (svgSize - padding - point.y) / scale,
    });

    return {
      toSvg,
      fromSvg,
      minX,
      minY,
      maxX,
      maxY,
      scale,
    };
  }, [validVertices]);

  const svgPoints = useMemo(() => {
    if (!viewState) return [];
    return parsedVertices.map((vertex) => ({
      id: vertex.id,
      rawX: vertex.x,
      rawY: vertex.y,
      ...viewState.toSvg({
        x: Number.isFinite(vertex.x) ? vertex.x : 0,
        y: Number.isFinite(vertex.y) ? vertex.y : 0,
      }),
    }));
  }, [parsedVertices, viewState]);

  const svgPath = useMemo(
    () => svgPoints.map((point) => `${point.x},${point.y}`).join(' '),
    [svgPoints],
  );

  const selectedVertexIndex = vertices.findIndex((vertex) => vertex.id === selectedVertexId);
  const selectedVertex = selectedVertexIndex >= 0 ? vertices[selectedVertexIndex] : null;
  const selectedSvgPoint = svgPoints.find((point) => point.id === selectedVertexId) ?? null;

  useEffect(() => {
    if (!isValid) return;
    onSiteChange({
      vertices: validVertices.map(({ x, y }) => ({ x, y })),
      area,
    });
  }, [area, isValid, onSiteChange, validVertices]);

  const handleVertexChange = useCallback((id: string, field: 'x' | 'y', value: string) => {
    setVertices((prev) => prev.map((vertex) => (vertex.id === id ? { ...vertex, [field]: value } : vertex)));
  }, [setVertices]);

  const handleAddVertexAfter = useCallback((id: string) => {
    setVertices((prev) => {
      const index = prev.findIndex((vertex) => vertex.id === id);
      if (index < 0) return prev;

      const current = prev[index];
      const next = prev[(index + 1) % prev.length];
      const currentX = Number.parseFloat(current.x);
      const currentY = Number.parseFloat(current.y);
      const nextX = Number.parseFloat(next.x);
      const nextY = Number.parseFloat(next.y);
      const safeCurrentX = Number.isFinite(currentX) ? currentX : 0;
      const safeCurrentY = Number.isFinite(currentY) ? currentY : 0;
      const safeNextX = Number.isFinite(nextX) ? nextX : safeCurrentX;
      const safeNextY = Number.isFinite(nextY) ? nextY : safeCurrentY;

      const inserted: Vertex = {
        id: genId(),
        x: formatCoord((safeCurrentX + safeNextX) / 2),
        y: formatCoord((safeCurrentY + safeNextY) / 2),
      };

      const nextVertices = [...prev];
      nextVertices.splice(index + 1, 0, inserted);
      setSelectedVertexId(inserted.id);
      return nextVertices;
    });
  }, [setSelectedVertexId, setVertices]);

  const handleRemoveVertex = useCallback((id: string) => {
    setVertices((prev) => {
      if (prev.length <= 3) return prev;
      const nextVertices = prev.filter((vertex) => vertex.id !== id);
      if (selectedVertexId === id) {
        setSelectedVertexId(nextVertices[0]?.id ?? null);
      }
      return nextVertices;
    });
  }, [selectedVertexId, setSelectedVertexId, setVertices]);

  const moveVertexFromPointer = useCallback((id: string, clientX: number, clientY: number, svg: SVGSVGElement) => {
    if (!viewState) return;

    const rect = svg.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * svgSize;
    const localY = ((clientY - rect.top) / rect.height) * svgSize;
    const clampedX = Math.min(svgSize - padding, Math.max(padding, localX));
    const clampedY = Math.min(svgSize - padding, Math.max(padding, localY));
    const nextPoint = viewState.fromSvg({ x: clampedX, y: clampedY });

    setVertices((prev) =>
      prev.map((vertex) =>
        vertex.id === id
          ? { ...vertex, x: formatCoord(nextPoint.x), y: formatCoord(nextPoint.y) }
          : vertex,
      ),
    );
  }, [padding, setVertices, svgSize, viewState]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/80 bg-white/72 px-3 py-3">
        <p className="text-[11px] font-medium text-foreground">頂点をドラッグして外形を調整</p>
        <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
          点を掴むと、その近くに座標と頂点追加のポップが出ます。細かい数値はあとから直接入力できます。
        </p>
      </div>

      <div className="relative mx-auto w-[220px]">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="touch-none rounded-2xl border border-border bg-card/70"
          onPointerMove={(event) => {
            if (!draggingVertexId) return;
            moveVertexFromPointer(draggingVertexId, event.clientX, event.clientY, event.currentTarget);
          }}
          onPointerUp={() => setDraggingVertexId(null)}
          onPointerLeave={() => setDraggingVertexId(null)}
        >
          {svgPoints.length >= 3 ? (
            <polygon
              points={svgPath}
              fill="rgba(93, 228, 199, 0.18)"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />
          ) : null}

          {svgPoints.map((point) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r={point.id === selectedVertexId ? 7 : 5.5}
              fill="hsl(var(--background))"
              stroke="hsl(var(--primary))"
              strokeWidth={point.id === selectedVertexId ? 3 : 2}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => {
                event.preventDefault();
                setSelectedVertexId(point.id);
                setDraggingVertexId(point.id);
              }}
            />
          ))}
        </svg>

        {selectedVertex && selectedSvgPoint ? (
          <div
            className="absolute z-10 w-[150px] rounded-2xl border border-border/80 bg-white/96 p-2 shadow-[0_14px_28px_rgba(24,37,43,0.16)]"
            style={{
              left: Math.min(svgSize - 150, Math.max(0, selectedSvgPoint.x + 10)),
              top: Math.min(svgSize - 118, Math.max(0, selectedSvgPoint.y - 18)),
            }}
          >
            <p className="text-[10px] font-semibold text-foreground">頂点 {selectedVertexIndex + 1}</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div>
                <label className="mb-0.5 block text-[9px] text-muted-foreground">X</label>
                <Input
                  type="number"
                  value={selectedVertex.x}
                  onChange={(event) => handleVertexChange(selectedVertex.id, 'x', event.target.value)}
                  step="0.1"
                  className="h-7 text-[11px]"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[9px] text-muted-foreground">Y</label>
                <Input
                  type="number"
                  value={selectedVertex.y}
                  onChange={(event) => handleVertexChange(selectedVertex.id, 'y', event.target.value)}
                  step="0.1"
                  className="h-7 text-[11px]"
                />
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => handleAddVertexAfter(selectedVertex.id)}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-secondary px-2 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary/80"
              >
                <Plus className="h-3 w-3" />
                後ろに追加
              </button>
              <button
                type="button"
                onClick={() => handleRemoveVertex(selectedVertex.id)}
                disabled={vertices.length <= 3}
                className="rounded-xl border border-border/80 px-2 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
              >
                削除
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/70 bg-white/70 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">敷地面積</span>
          <span className="font-mono text-[11px] text-foreground">{area.toFixed(1)} m²</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">頂点数</span>
          <span className="text-[11px] text-foreground">{vertices.length}</span>
        </div>
      </div>

      <details className="rounded-xl border border-border/70 bg-white/70">
        <summary className="cursor-pointer list-none px-3 py-3 text-[11px] font-medium text-foreground">
          数値で細かく調整する
        </summary>
        <div className="space-y-1 border-t border-border/70 px-3 py-3">
          <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-1 px-0.5 text-[10px] text-muted-foreground">
            <span className="w-5">#</span>
            <span>X (m)</span>
            <span>Y (m)</span>
            <span className="w-5" />
          </div>
          {vertices.map((vertex, index) => (
            <div key={vertex.id} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedVertexId(vertex.id)}
                className="w-5 text-center text-[10px] text-muted-foreground"
              >
                {index + 1}
              </button>
              <Input
                type="number"
                value={vertex.x}
                onChange={(event) => handleVertexChange(vertex.id, 'x', event.target.value)}
                step="0.1"
                className="h-7 text-xs"
              />
              <Input
                type="number"
                value={vertex.y}
                onChange={(event) => handleVertexChange(vertex.id, 'y', event.target.value)}
                step="0.1"
                className="h-7 text-xs"
              />
              <button
                type="button"
                onClick={() => handleRemoveVertex(vertex.id)}
                disabled={vertices.length <= 3}
                className="flex h-5 w-5 items-center justify-center text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const base = vertices[vertices.length - 1];
              const nextVertex: Vertex = {
                id: genId(),
                x: base?.x ?? '0',
                y: base?.y ?? '0',
              };
              setVertices((prev) => [...prev, nextVertex]);
              setSelectedVertexId(nextVertex.id);
            }}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border py-2 text-[10px] text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            頂点を追加
          </button>
        </div>
      </details>

      {!isValid ? (
        <p className="text-[10px] text-amber-800">
          面積が 0 にならないように、3点以上で閉じた形にしてください。
        </p>
      ) : null}
    </div>
  );
}

export function SiteEditor({
  site,
  onSiteChange,
  siteWidth,
  siteDepth,
  onSiteWidthChange,
  onSiteDepthChange,
  siteMode,
  onSiteModeChange,
}: SiteEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">敷地形状</label>
        <ToggleGroup
          type="single"
          value={siteMode}
          onValueChange={(value) => value && onSiteModeChange(value as 'rect' | 'polygon')}
          size="sm"
        >
          <ToggleGroupItem value="rect" className="h-7 px-3 text-[11px]">
            矩形
          </ToggleGroupItem>
          <ToggleGroupItem value="polygon" className="h-7 px-3 text-[11px]">
            多角形
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {siteMode === 'rect' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] text-muted-foreground">間口 (m)</label>
              <Input
                type="number"
                value={siteWidth}
                onChange={(event) => onSiteWidthChange(event.target.value)}
                placeholder="10"
                min="1"
                step="0.5"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] text-muted-foreground">奥行 (m)</label>
              <Input
                type="number"
                value={siteDepth}
                onChange={(event) => onSiteDepthChange(event.target.value)}
                placeholder="15"
                min="1"
                step="0.5"
                className="h-8 text-sm"
              />
            </div>
          </div>
          {site ? (
            <p className="text-[10px] text-muted-foreground">
              敷地面積 <span className="font-mono text-foreground">{site.area.toFixed(1)}</span> m²
            </p>
          ) : null}
        </div>
      ) : (
        <PolygonEditor
          key={site ? site.vertices.map((vertex) => `${vertex.x.toFixed(3)},${vertex.y.toFixed(3)}`).join('|') : 'default'}
          site={site}
          onSiteChange={onSiteChange}
        />
      )}
    </div>
  );
}
