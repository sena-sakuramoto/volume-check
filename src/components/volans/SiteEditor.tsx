'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, RotateCcw, Undo2, Redo2 } from 'lucide-react';
import type { Point2D } from '@/engine/types';
import { useVolansStore } from '@/stores/useVolansStore';
import { useUndoRedo } from '@/hooks/useUndoRedo';

interface SiteEditorProps {
  height?: number;
}

function polygonArea(vertices: Point2D[]): number {
  let a = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    a += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return Math.abs(a) / 2;
}

/**
 * Interactive SVG site polygon editor.
 *   • drag a blue handle to move a vertex
 *   • tap a midpoint (+) to insert a new vertex
 *   • select a vertex then tap 削除 to remove it
 *   • 戻す resets from the last saved site
 */
export function SiteEditor({ height = 260 }: SiteEditorProps) {
  const site = useVolansStore((s) => s.site);
  const initial = useRef(site.vertices);
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Point2D[]>(site.vertices);
  const [selected, setSelected] = useState<number>(-1);
  const [draggingIdx, setDraggingIdx] = useState<number>(-1);
  const { record, undo, redo, canUndo, canRedo } = useUndoRedo();

  // Reset baseline if the store site changes out-of-band. Deferred to a
  // microtask so we don't call setState synchronously inside the effect body.
  useEffect(() => {
    if (draggingIdx !== -1) return;
    if (initial.current === site.vertices) return;
    initial.current = site.vertices;
    queueMicrotask(() => setDraft(site.vertices));
  }, [site.vertices, draggingIdx]);

  const bbox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of draft) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const pad = Math.max(w, h) * 0.15;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }, [draft]);

  const viewBox = `${bbox.minX} ${-bbox.maxY} ${bbox.maxX - bbox.minX} ${bbox.maxY - bbox.minY}`;
  const longEdge = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
  const r = longEdge * 0.018;
  const strokeW = longEdge * 0.006;
  const fontSize = longEdge * 0.028;

  function screenToWorld(evt: React.PointerEvent): Point2D | null {
    if (!svgRef.current) return null;
    const pt = svgRef.current.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return null;
    const world = pt.matrixTransform(ctm.inverse());
    return { x: world.x, y: -world.y };
  }

  function onVertexDown(i: number) {
    return (evt: React.PointerEvent) => {
      evt.stopPropagation();
      evt.preventDefault();
      setSelected(i);
      setDraggingIdx(i);
      record();
      svgRef.current?.setPointerCapture(evt.pointerId);
    };
  }

  function onPointerMove(evt: React.PointerEvent) {
    if (draggingIdx < 0) return;
    const p = screenToWorld(evt);
    if (!p) return;
    setDraft((prev) => prev.map((v, i) => (i === draggingIdx ? p : v)));
  }

  function onPointerUp(evt: React.PointerEvent) {
    if (draggingIdx >= 0) {
      svgRef.current?.releasePointerCapture(evt.pointerId);
      setDraggingIdx(-1);
      commit();
    }
  }

  function commit(next: Point2D[] = draft) {
    if (next.length < 3) return;
    // translate to positive quadrant, normalize CW
    let minX = Infinity, minY = Infinity;
    for (const p of next) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
    }
    let verts = next.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    let signed = 0;
    for (let i = 0; i < verts.length; i++) {
      const j = (i + 1) % verts.length;
      signed += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
    }
    if (signed > 0) verts = [...verts].reverse();
    const area = polygonArea(verts);
    if (area <= 0) return;
    useVolansStore.setState({
      site: { vertices: verts, area },
      updatedAt: new Date().toISOString(),
    });
  }

  function insertAt(edgeIdx: number) {
    record();
    const a = draft[edgeIdx];
    const b = draft[(edgeIdx + 1) % draft.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const next = [...draft.slice(0, edgeIdx + 1), mid, ...draft.slice(edgeIdx + 1)];
    setDraft(next);
    setSelected(edgeIdx + 1);
    commit(next);
  }

  function deleteSelected() {
    if (selected < 0 || draft.length <= 3) return;
    record();
    const next = draft.filter((_, i) => i !== selected);
    setDraft(next);
    setSelected(-1);
    commit(next);
  }

  function reset() {
    record();
    setDraft(initial.current);
    setSelected(-1);
    commit(initial.current);
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-3"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold" style={{ color: 'var(--volans-text)' }}>
          敷地形状を編集
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-40"
            style={{
              background: 'var(--volans-surface)',
              border: `1px solid var(--volans-border-strong)`,
              color: 'var(--volans-text)',
            }}
            title="元に戻す (Ctrl+Z)"
          >
            <Undo2 className="h-3 w-3" />
            元に戻す
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-40"
            style={{
              background: 'var(--volans-surface)',
              border: `1px solid var(--volans-border-strong)`,
              color: 'var(--volans-text)',
            }}
            title="やり直し (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3 w-3" />
            やり直し
          </button>
          <button
            onClick={deleteSelected}
            disabled={selected < 0 || draft.length <= 3}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-40"
            style={{
              background: 'var(--volans-surface)',
              border: `1px solid var(--volans-border-strong)`,
              color: 'var(--volans-text)',
            }}
          >
            <Trash2 className="h-3 w-3" />
            頂点を削除
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium"
            style={{
              background: 'var(--volans-surface)',
              border: `1px solid var(--volans-border-strong)`,
              color: 'var(--volans-text)',
            }}
          >
            <RotateCcw className="h-3 w-3" />
            戻す
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBox}
        style={{
          width: '100%',
          height,
          background: 'var(--volans-surface-alt)',
          border: `1px solid var(--volans-border)`,
          borderRadius: 8,
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform="scale(1,-1)" transform-origin="center">
          <polygon
            points={draft.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
            fill="var(--volans-primary-soft)"
            stroke="var(--volans-primary)"
            strokeWidth={strokeW}
          />

          {/* edge midpoints with + */}
          {draft.map((a, i) => {
            const b = draft[(i + 1) % draft.length];
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
            return (
              <g key={`edge-${i}`}>
                <circle
                  cx={mx}
                  cy={my}
                  r={r * 0.7}
                  fill="var(--volans-surface)"
                  stroke="var(--volans-primary)"
                  strokeWidth={strokeW * 0.8}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    insertAt(i);
                  }}
                  style={{ cursor: 'pointer' }}
                />
                <text
                  x={mx}
                  y={-my}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fill="var(--volans-text-soft)"
                  transform={`rotate(${-angle}, ${mx}, ${-my}) translate(0, ${fontSize * 1.3})`}
                  pointerEvents="none"
                >
                  {len.toFixed(2)}m
                </text>
              </g>
            );
          })}

          {/* vertex handles */}
          {draft.map((p, i) => (
            <circle
              key={`v-${i}`}
              cx={p.x}
              cy={p.y}
              r={r}
              fill={i === selected ? 'var(--volans-warning)' : 'var(--volans-primary)'}
              stroke="#ffffff"
              strokeWidth={strokeW * 0.8}
              onPointerDown={onVertexDown(i)}
              style={{ cursor: 'grab', touchAction: 'none' }}
            />
          ))}
        </g>
      </svg>

      <div className="flex items-center justify-between text-[10px]">
        <span style={{ color: 'var(--volans-muted)' }}>
          頂点 {draft.length} / 面積 {polygonArea(draft).toFixed(2)} ㎡
        </span>
        <span className="flex items-center gap-1" style={{ color: 'var(--volans-muted)' }}>
          <Plus className="h-3 w-3" />
          辺の中央をタップで頂点追加
        </span>
      </div>
    </div>
  );
}
