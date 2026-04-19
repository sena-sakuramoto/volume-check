'use client';

import { useMemo } from 'react';
import type { SiteBoundary } from '@/engine/types';

interface SitePreviewProps {
  site: SiteBoundary;
  height?: number;
  showDimensions?: boolean;
}

/**
 * Lightweight SVG preview of the site polygon with dimensions.
 * No tiles; uses local meter coordinates from the store site.
 */
export function SitePreview({ site, height = 140, showDimensions = true }: SitePreviewProps) {
  const { path, viewBox, edges } = useMemo(() => {
    if (!site || site.vertices.length < 3) {
      return { path: '', viewBox: '0 0 100 100', edges: [] };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of site.vertices) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const pad = Math.max(w, h) * 0.12;

    const vb = `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`;
    const points = site.vertices
      .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');

    const edgeData: Array<{ mx: number; my: number; len: number; angle: number }> = [];
    for (let i = 0; i < site.vertices.length; i++) {
      const a = site.vertices[i];
      const b = site.vertices[(i + 1) % site.vertices.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.1) continue;
      edgeData.push({
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        len,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    }

    return { path: points, viewBox: vb, edges: edgeData };
  }, [site]);

  if (!path) {
    return (
      <div
        className="grid place-items-center rounded-lg text-[11px]"
        style={{
          height,
          background: 'var(--volans-surface-alt)',
          border: `1px solid var(--volans-border)`,
          color: 'var(--volans-muted)',
        }}
      >
        敷地形状が未取得です
      </div>
    );
  }

  const maxEdge = edges.reduce((m, e) => Math.max(m, e.len), 0) || 1;
  const fontSize = Math.max(0.4, maxEdge * 0.06);

  return (
    <svg
      viewBox={viewBox}
      style={{
        width: '100%',
        height,
        background: 'var(--volans-surface-alt)',
        borderRadius: 8,
        border: '1px solid var(--volans-border)',
      }}
    >
      <g transform="scale(1,-1)" transform-origin="center">
        <polygon
          points={path}
          fill="var(--volans-primary-soft)"
          stroke="var(--volans-primary)"
          strokeWidth={Math.max(0.1, maxEdge * 0.01)}
        />
        {showDimensions &&
          edges.map((e, i) => (
            <text
              key={i}
              x={e.mx}
              y={-e.my}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fontSize}
              fill="var(--volans-text)"
              transform={`rotate(${-e.angle}, ${e.mx}, ${-e.my})`}
            >
              {e.len.toFixed(1)}m
            </text>
          ))}
      </g>
    </svg>
  );
}
