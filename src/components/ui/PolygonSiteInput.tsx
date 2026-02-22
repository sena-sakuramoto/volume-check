'use client';

import { useState, useMemo, useCallback } from 'react';
import type { SiteBoundary } from '@/engine/types';

interface Vertex {
  id: string;
  x: string;
  y: string;
}

interface PolygonSiteInputProps {
  onSiteChange: (site: SiteBoundary) => void;
}

let nextId = 1;
function genId() {
  return String(nextId++);
}

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

export function PolygonSiteInput({ onSiteChange }: PolygonSiteInputProps) {
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

  // SVG preview dimensions
  const svgSize = 120;
  const svgPath = useMemo(() => {
    if (parsedVertices.length < 3) return '';
    const xs = parsedVertices.map((v) => v.x);
    const ys = parsedVertices.map((v) => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const padding = 10;
    const scale = Math.min(
      (svgSize - padding * 2) / rangeX,
      (svgSize - padding * 2) / rangeY,
    );
    const points = parsedVertices.map((v) => {
      const sx = padding + (v.x - minX) * scale;
      // Flip Y so north is up in SVG
      const sy = svgSize - padding - (v.y - minY) * scale;
      return `${sx},${sy}`;
    });
    return points.join(' ');
  }, [parsedVertices]);

  const handleVertexChange = useCallback(
    (id: string, field: 'x' | 'y', value: string) => {
      setVertices((prev) =>
        prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)),
      );
    },
    [],
  );

  const handleAddVertex = useCallback(() => {
    setVertices((prev) => [...prev, { id: genId(), x: '0', y: '0' }]);
  }, []);

  const handleRemoveVertex = useCallback((id: string) => {
    setVertices((prev) => {
      if (prev.length <= 3) return prev;
      return prev.filter((v) => v.id !== id);
    });
  }, []);

  const handleApply = useCallback(() => {
    if (!isValid) return;
    onSiteChange({
      vertices: parsedVertices,
      area,
    });
  }, [isValid, parsedVertices, area, onSiteChange]);

  return (
    <div className="flex flex-col gap-2">
      {/* SVG Preview */}
      <div className="flex justify-center">
        <svg
          width={svgSize}
          height={svgSize}
          className="rounded border border-gray-700 bg-gray-900"
        >
          {svgPath && (
            <polygon
              points={svgPath}
              fill="rgba(59, 130, 246, 0.3)"
              stroke="#3b82f6"
              strokeWidth="1.5"
            />
          )}
          {/* Vertex dots */}
          {parsedVertices.length >= 3 &&
            svgPath.split(' ').map((pt, i) => {
              const [cx, cy] = pt.split(',').map(Number);
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r="3"
                  fill="#60a5fa"
                  stroke="#1d4ed8"
                  strokeWidth="1"
                />
              );
            })}
        </svg>
      </div>

      {/* Vertex table */}
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-1 text-[10px] text-gray-500 px-0.5">
          <span className="w-5">#</span>
          <span>X (m)</span>
          <span>Y (m)</span>
          <span className="w-5"></span>
        </div>
        {vertices.map((v, i) => (
          <div
            key={v.id}
            className="grid grid-cols-[auto_1fr_1fr_auto] gap-1 items-center"
          >
            <span className="w-5 text-[10px] text-gray-500 text-center">
              {i + 1}
            </span>
            <input
              type="number"
              value={v.x}
              onChange={(e) => handleVertexChange(v.id, 'x', e.target.value)}
              step="0.1"
              className="w-full rounded border border-gray-600 bg-gray-800 px-1.5 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="number"
              value={v.y}
              onChange={(e) => handleVertexChange(v.id, 'y', e.target.value)}
              step="0.1"
              className="w-full rounded border border-gray-600 bg-gray-800 px-1.5 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={() => handleRemoveVertex(v.id)}
              disabled={vertices.length <= 3}
              className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
              title="頂点を削除"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddVertex}
        className="w-full rounded border border-dashed border-gray-600 py-1 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-300 transition-colors"
      >
        + 頂点を追加
      </button>

      {/* Area display */}
      {area > 0 && (
        <div className="text-[10px] text-gray-500">
          敷地面積: <span className="font-mono text-gray-300">{area.toFixed(1)}</span> m²
        </div>
      )}

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={!isValid}
        className="w-full rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        敷地を適用
      </button>
    </div>
  );
}
