'use client';

import type { Road } from '@/engine/types';
import { useVolansStore } from '@/stores/useVolansStore';
import { Trash2 } from 'lucide-react';

const DIRECTION_LABELS: Array<{ bearing: number; label: string }> = [
  { bearing: 0, label: '北' },
  { bearing: 90, label: '東' },
  { bearing: 180, label: '南' },
  { bearing: 270, label: '西' },
];

export function RoadEditor() {
  const roads = useVolansStore((s) => s.roads);

  function update(i: number, patch: Partial<Road>) {
    const next = roads.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    useVolansStore.setState({
      roads: next,
      updatedAt: new Date().toISOString(),
    });
  }

  function remove(i: number) {
    const next = roads.filter((_, idx) => idx !== i);
    useVolansStore.setState({
      roads: next,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div className="text-[12px] font-semibold" style={{ color: 'var(--volans-text)' }}>
        前面道路（{roads.length} 本）
      </div>
      {roads.length === 0 ? (
        <div
          className="mt-2 rounded-md px-2 py-3 text-center text-[11px]"
          style={{
            background: 'var(--volans-surface-alt)',
            color: 'var(--volans-muted)',
          }}
        >
          道路情報がありません。住所検索またはCAD取込で自動設定されます。
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {roads.map((r, i) => (
            <div
              key={i}
              className="rounded-md p-2"
              style={{
                background: 'var(--volans-surface-alt)',
                border: `1px solid var(--volans-border)`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: 'var(--volans-text)' }}>
                  道路 #{i + 1}
                </span>
                <button
                  onClick={() => remove(i)}
                  className="flex items-center gap-0.5 text-[10px]"
                  style={{ color: 'var(--volans-danger)' }}
                >
                  <Trash2 className="h-3 w-3" />
                  削除
                </button>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <label className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--volans-muted)' }}>
                  幅員
                  <input
                    type="number"
                    step="0.1"
                    value={r.width}
                    onChange={(e) => {
                      const w = Number(e.target.value);
                      if (Number.isFinite(w) && w > 0) {
                        update(i, { width: w, centerOffset: w / 2 });
                      }
                    }}
                    className="w-16 rounded-md px-1.5 py-0.5 text-[11px] outline-none"
                    style={{
                      background: 'var(--volans-surface)',
                      border: `1px solid var(--volans-border)`,
                      color: 'var(--volans-text)',
                    }}
                  />
                  <span>m</span>
                </label>
                <label className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--volans-muted)' }}>
                  方位
                  <select
                    value={closestBearing(r.bearing).bearing}
                    onChange={(e) => update(i, { bearing: Number(e.target.value) })}
                    className="rounded-md px-1.5 py-0.5 text-[11px] outline-none"
                    style={{
                      background: 'var(--volans-surface)',
                      border: `1px solid var(--volans-border)`,
                      color: 'var(--volans-text)',
                    }}
                  >
                    {DIRECTION_LABELS.map((d) => (
                      <option key={d.bearing} value={d.bearing}>
                        {d.label} ({d.bearing}°)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-1 text-[9px]" style={{ color: 'var(--volans-muted)' }}>
                中心オフセット: {r.centerOffset.toFixed(1)}m / 実方位: {r.bearing.toFixed(0)}°
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function closestBearing(bearing: number): { bearing: number; label: string } {
  let best = DIRECTION_LABELS[0];
  let bestDiff = 360;
  for (const d of DIRECTION_LABELS) {
    const diff = Math.min(Math.abs(bearing - d.bearing), 360 - Math.abs(bearing - d.bearing));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }
  return best;
}
