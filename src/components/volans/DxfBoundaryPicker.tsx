'use client';

import { useMemo, useState } from 'react';
import {
  parseDxf,
  BOUNDARY_LABEL,
  BOUNDARY_COLOR,
  chainIntoPolygon,
  type BoundaryKind,
  type DxfLine,
  type DxfParseResult,
} from '@/lib/dxf-parse';
import { useVolansStore } from '@/stores/useVolansStore';
import { Upload, CheckCircle2, AlertTriangle, Eraser } from 'lucide-react';

interface DxfBoundaryPickerProps {
  onApplied?: () => void;
}

/**
 * Workflow:
 *  1. User uploads .dxf
 *  2. All line segments are drawn in the SVG, initially colored by layer
 *  3. User clicks a segment to toggle it through
 *     none → site → road → adjacent → north → ignore → none
 *  4. "敷地に適用" chains `site` segments into a polygon and pushes to store.
 *     `road` segments additionally become road edges on that polygon.
 */
export function DxfBoundaryPicker({ onApplied }: DxfBoundaryPickerProps) {
  const [parsed, setParsed] = useState<DxfParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [kinds, setKinds] = useState<Record<string, BoundaryKind>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(
    null,
  );
  const [defaultRoadWidth, setDefaultRoadWidth] = useState(6);

  async function onFile(f: File) {
    setMessage(null);
    try {
      const text = await f.text();
      const result = parseDxf(text);
      if (result.lines.length === 0) {
        setMessage({ kind: 'err', text: 'DXF に直線/ポリラインが見つかりませんでした' });
        setParsed(null);
        return;
      }
      setParsed(result);
      setFileName(f.name);
      setKinds({});
      setMessage({
        kind: 'info',
        text: `${result.lines.length} 本の線・${result.layers.length} レイヤーを読み込みました。敷地境界を順に選択してください。`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'DXF パースに失敗しました';
      setMessage({ kind: 'err', text: msg });
    }
  }

  function cycleKind(id: string) {
    setKinds((k) => {
      const current = k[id] ?? 'none';
      const order: Array<BoundaryKind | 'none'> = [
        'none',
        'site',
        'road',
        'adjacent',
        'north',
        'ignore',
      ];
      const next = order[(order.indexOf(current as BoundaryKind | 'none') + 1) % order.length];
      const copy = { ...k };
      if (next === 'none') delete copy[id];
      else copy[id] = next as BoundaryKind;
      return copy;
    });
  }

  function clearAll() {
    setKinds({});
    setMessage(null);
  }

  function apply() {
    if (!parsed) return;
    const siteLines = parsed.lines.filter((l) => kinds[l.id] === 'site');
    if (siteLines.length < 3) {
      setMessage({
        kind: 'err',
        text: `敷地境界の選択が ${siteLines.length} 本です。3 本以上必要です。`,
      });
      return;
    }
    const ring = chainIntoPolygon(siteLines);
    if (!ring) {
      setMessage({
        kind: 'err',
        text: '敷地境界が閉じませんでした。線の端点がずれていないか確認してください。',
      });
      return;
    }

    // Road edges: find site-ring indices whose matching segment is a classified 'road' line
    const roadLines = parsed.lines.filter((l) => kinds[l.id] === 'road');
    const roadEdgeIndices: Array<[number, number]> = [];
    const tol = 0.1;
    for (const rl of roadLines) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const matchAB =
          Math.hypot(a.x - rl.ax, a.y - rl.ay) < tol &&
          Math.hypot(b.x - rl.bx, b.y - rl.by) < tol;
        const matchBA =
          Math.hypot(a.x - rl.bx, a.y - rl.by) < tol &&
          Math.hypot(b.x - rl.ax, b.y - rl.ay) < tol;
        if (matchAB || matchBA) {
          roadEdgeIndices.push([i, (i + 1) % ring.length]);
          break;
        }
      }
    }

    useVolansStore.getState().setSiteFromCad(ring, {
      roadEdgeIndices,
      roadWidthDefault: defaultRoadWidth,
    });
    setMessage({
      kind: 'ok',
      text: `敷地 ${ring.length} 頂点・道路 ${roadEdgeIndices.length} 辺を適用しました`,
    });
    onApplied?.();
  }

  const viewBox = useMemo(() => {
    if (!parsed) return '0 0 100 100';
    const { minX, minY, maxX, maxY } = parsed.bbox;
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const pad = Math.max(w, h) * 0.08;
    return `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`;
  }, [parsed]);

  const stroke = parsed ? Math.max(0.05, (parsed.bbox.maxX - parsed.bbox.minX) * 0.004) : 0.2;

  const counts = useMemo(() => {
    const c: Record<BoundaryKind, number> = {
      site: 0,
      road: 0,
      adjacent: 0,
      north: 0,
      ignore: 0,
    };
    for (const v of Object.values(kinds)) c[v]++;
    return c;
  }, [kinds]);

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-3"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold" style={{ color: 'var(--volans-text)' }}>
          CAD（DXF）取込
        </div>
        {parsed && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-[10px]"
            style={{ color: 'var(--volans-muted)' }}
          >
            <Eraser className="h-3 w-3" />
            選択を全解除
          </button>
        )}
      </div>

      <label
        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-medium"
        style={{
          background: 'var(--volans-primary-soft)',
          color: 'var(--volans-primary-strong)',
          border: `1px dashed var(--volans-primary)`,
        }}
      >
        <Upload className="h-3.5 w-3.5" />
        {fileName ?? '.dxf ファイルを選択'}
        <input
          type="file"
          accept=".dxf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      {message && (
        <div
          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[11px]"
          style={{
            background:
              message.kind === 'ok'
                ? 'var(--volans-success-soft)'
                : message.kind === 'err'
                  ? '#fdecec'
                  : 'var(--volans-primary-soft)',
            color:
              message.kind === 'ok'
                ? 'var(--volans-success)'
                : message.kind === 'err'
                  ? 'var(--volans-danger)'
                  : 'var(--volans-primary-strong)',
          }}
        >
          {message.kind === 'ok' ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : message.kind === 'err' ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          ) : null}
          <span>{message.text}</span>
        </div>
      )}

      {parsed && (
        <>
          <svg
            viewBox={viewBox}
            className="w-full"
            style={{
              aspectRatio: '4/3',
              background: '#fafbfc',
              border: `1px solid var(--volans-border)`,
              borderRadius: 6,
            }}
            preserveAspectRatio="xMidYMid meet"
          >
            <g transform="scale(1,-1)" transform-origin="center">
              {parsed.lines.map((l) => {
                const k = kinds[l.id];
                const color = k ? BOUNDARY_COLOR[k] : '#94a3b8';
                const w = k && k !== 'ignore' ? stroke * 2.4 : stroke;
                return (
                  <DxfLineHit
                    key={l.id}
                    line={l}
                    color={color}
                    strokeWidth={w}
                    onClick={() => cycleKind(l.id)}
                  />
                );
              })}
            </g>
          </svg>

          <Legend counts={counts} />

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <label className="flex items-center gap-1" style={{ color: 'var(--volans-muted)' }}>
              道路幅員（既定）
              <input
                type="number"
                step="0.1"
                value={defaultRoadWidth}
                onChange={(e) => setDefaultRoadWidth(Number(e.target.value) || 0)}
                className="w-14 rounded-md px-1 py-0.5 text-[11px] outline-none"
                style={{
                  border: `1px solid var(--volans-border)`,
                  background: 'var(--volans-surface-alt)',
                  color: 'var(--volans-text)',
                }}
              />
              <span>m</span>
            </label>
            <button
              onClick={apply}
              disabled={counts.site < 3}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--volans-primary)' }}
            >
              敷地に適用
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DxfLineHit({
  line,
  color,
  strokeWidth,
  onClick,
}: {
  line: DxfLine;
  color: string;
  strokeWidth: number;
  onClick: () => void;
}) {
  return (
    <>
      {/* thick invisible hit area */}
      <line
        x1={line.ax}
        y1={line.ay}
        x2={line.bx}
        y2={line.by}
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth * 6, 0.5)}
        onClick={onClick}
        style={{ cursor: 'pointer' }}
      />
      <line
        x1={line.ax}
        y1={line.ay}
        x2={line.bx}
        y2={line.by}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pointerEvents="none"
      />
    </>
  );
}

function Legend({ counts }: { counts: Record<BoundaryKind, number> }) {
  const items: BoundaryKind[] = ['site', 'road', 'adjacent', 'north', 'ignore'];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
      <span style={{ color: 'var(--volans-muted)' }}>
        線をタップで 敷地 → 道路 → 隣地 → 北側 → 無視 を切替
      </span>
      {items.map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4 rounded"
            style={{ background: BOUNDARY_COLOR[k] }}
          />
          <span style={{ color: 'var(--volans-text)' }}>{BOUNDARY_LABEL[k]}</span>
          <span className="tabular-nums" style={{ color: 'var(--volans-muted)' }}>
            ({counts[k]})
          </span>
        </span>
      ))}
    </div>
  );
}
