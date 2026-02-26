'use client';

import { useState, useMemo, useCallback } from 'react';
import type { SiteBoundary } from '@/engine/types';
import { Input } from '@/components/ui/shadcn/input';
import { Button } from '@/components/ui/shadcn/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/shadcn/toggle-group';
import { Plus, X } from 'lucide-react';

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

// Polygon sub-component (extracted from PolygonSiteInput)
interface Vertex { id: string; x: string; y: string }
let nextId = 1;
function genId() { return String(nextId++); }

function computeArea(vertices: { x: number; y: number }[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

const DEFAULT_VERTICES: Vertex[] = [
  { id: genId(), x: '0', y: '0' },
  { id: genId(), x: '10', y: '0' },
  { id: genId(), x: '10', y: '15' },
  { id: genId(), x: '0', y: '15' },
];

function PolygonEditor({ onSiteChange }: { onSiteChange: (site: SiteBoundary) => void }) {
  const [vertices, setVertices] = useState<Vertex[]>(DEFAULT_VERTICES);

  const parsedVertices = useMemo(() => {
    return vertices
      .map((v) => ({ x: parseFloat(v.x), y: parseFloat(v.y) }))
      .filter((v) => !isNaN(v.x) && !isNaN(v.y));
  }, [vertices]);

  const area = useMemo(() => {
    if (parsedVertices.length < 3) return 0;
    return computeArea(parsedVertices);
  }, [parsedVertices]);

  const isValid = parsedVertices.length >= 3 && area > 0;

  const svgSize = 120;
  const svgPath = useMemo(() => {
    if (parsedVertices.length < 3) return '';
    const xs = parsedVertices.map((v) => v.x);
    const ys = parsedVertices.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const padding = 10;
    const scale = Math.min((svgSize - padding * 2) / rangeX, (svgSize - padding * 2) / rangeY);
    return parsedVertices.map((v) => {
      const sx = padding + (v.x - minX) * scale;
      const sy = svgSize - padding - (v.y - minY) * scale;
      return `${sx},${sy}`;
    }).join(' ');
  }, [parsedVertices]);

  const handleVertexChange = useCallback((id: string, field: 'x' | 'y', value: string) => {
    setVertices((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <svg width={svgSize} height={svgSize} className="rounded-md border border-border bg-card">
          {svgPath && (
            <polygon points={svgPath} fill="rgba(93,228,199,0.2)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
          )}
          {parsedVertices.length >= 3 && svgPath.split(' ').map((pt, i) => {
            const [cx, cy] = pt.split(',').map(Number);
            return <circle key={i} cx={cx} cy={cy} r="3" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" strokeWidth="1" />;
          })}
        </svg>
      </div>

      <div className="space-y-1">
        <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-1 text-[10px] text-muted-foreground px-0.5">
          <span className="w-5">#</span><span>X (m)</span><span>Y (m)</span><span className="w-5" />
        </div>
        {vertices.map((v, i) => (
          <div key={v.id} className="grid grid-cols-[auto_1fr_1fr_auto] gap-1 items-center">
            <span className="w-5 text-[10px] text-muted-foreground text-center">{i + 1}</span>
            <Input type="number" value={v.x} onChange={(e) => handleVertexChange(v.id, 'x', e.target.value)} step="0.1" className="h-7 text-xs" />
            <Input type="number" value={v.y} onChange={(e) => handleVertexChange(v.id, 'y', e.target.value)} step="0.1" className="h-7 text-xs" />
            <button
              onClick={() => setVertices((prev) => prev.length <= 3 ? prev : prev.filter((p) => p.id !== v.id))}
              disabled={vertices.length <= 3}
              className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => setVertices((prev) => [...prev, { id: genId(), x: '0', y: '0' }])}
        className="w-full rounded-md border border-dashed border-border py-1.5 text-[10px] text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
      >
        + 頂点を追加
      </button>

      {area > 0 && (
        <p className="text-[10px] text-muted-foreground">
          敷地面積: <span className="font-mono text-foreground">{area.toFixed(1)}</span> m²
        </p>
      )}

      <Button
        onClick={() => isValid && onSiteChange({ vertices: parsedVertices, area })}
        disabled={!isValid}
        size="sm"
        className="w-full"
      >
        敷地を適用
      </Button>
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
          onValueChange={(v) => v && onSiteModeChange(v as 'rect' | 'polygon')}
          size="sm"
        >
          <ToggleGroupItem value="rect" className="text-[10px] h-6 px-2">矩形</ToggleGroupItem>
          <ToggleGroupItem value="polygon" className="text-[10px] h-6 px-2">多角形</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {siteMode === 'rect' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-0.5">間口 (m)</label>
              <Input
                type="number"
                value={siteWidth}
                onChange={(e) => onSiteWidthChange(e.target.value)}
                placeholder="10"
                min="1"
                step="0.5"
                className="h-7 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-0.5">奥行 (m)</label>
              <Input
                type="number"
                value={siteDepth}
                onChange={(e) => onSiteDepthChange(e.target.value)}
                placeholder="15"
                min="1"
                step="0.5"
                className="h-7 text-xs"
              />
            </div>
          </div>
          {site && (
            <p className="text-[10px] text-muted-foreground">
              敷地面積: <span className="font-mono text-foreground">{site.area.toFixed(1)}</span> m²
            </p>
          )}
        </div>
      ) : (
        <PolygonEditor onSiteChange={onSiteChange} />
      )}
    </div>
  );
}
