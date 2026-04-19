'use client';

import { Sun, Mountain, GripHorizontal, Building2 } from 'lucide-react';
import { useViewerStore } from '@/stores/useViewerStore';
import type { LayerState } from '@/stores/useViewerStore';

type ToggleSpec = {
  key: keyof LayerState;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TOGGLES: ToggleSpec[] = [
  { key: 'shadow', label: '日影投影', icon: Sun },
  { key: 'reverseShadowContours', label: '逆日影 等高線', icon: Mountain },
  { key: 'reverseShadowHeightmap', label: '逆日影 ヒートマップ', icon: GripHorizontal },
  { key: 'floorPlates', label: '階床', icon: Building2 },
];

/**
 * Compact layer toggles mapped to the existing useViewerStore preset engine.
 * Toggling any switch puts the viewer in 'custom' preset mode.
 */
export function LayerToggle() {
  const layers = useViewerStore((s) => s.layers);
  const toggle = useViewerStore((s) => s.toggleLayer);

  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl p-3"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div className="text-[12px] font-semibold" style={{ color: 'var(--volans-text)' }}>
        表示レイヤー
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {TOGGLES.map((t) => {
          const Icon = t.icon;
          const active = layers[t.key];
          return (
            <button
              key={t.key}
              onClick={() => toggle(t.key)}
              className="flex items-center justify-between gap-1 rounded-md px-2 py-1.5 text-[11px] transition"
              style={{
                background: active
                  ? 'var(--volans-primary-soft)'
                  : 'var(--volans-surface-alt)',
                border: `1px solid ${active ? 'var(--volans-primary)' : 'var(--volans-border)'}`,
                color: active ? 'var(--volans-primary-strong)' : 'var(--volans-text)',
              }}
            >
              <span className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {t.label}
              </span>
              <span
                className="inline-block h-3.5 w-6 rounded-full transition"
                style={{
                  background: active ? 'var(--volans-primary)' : 'var(--volans-border-strong)',
                  position: 'relative',
                }}
              >
                <span
                  className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all"
                  style={{ left: active ? 13 : 2 }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
