'use client';

interface LayerControlsProps {
  layers: Record<string, boolean>;
  onToggle: (key: string) => void;
}

interface LayerDef {
  key: string;
  label: string;
  color: string;
}

const LAYER_DEFS: LayerDef[] = [
  { key: 'road', label: '道路斜線', color: '#f59e0b' },
  { key: 'adjacent', label: '隣地斜線', color: '#10b981' },
  { key: 'north', label: '北側斜線', color: '#8b5cf6' },
  { key: 'absoluteHeight', label: '絶対高さ', color: '#ef4444' },
  { key: 'shadow', label: '日影規制', color: '#6366f1' },
];

export function LayerControls({ layers, onToggle }: LayerControlsProps) {
  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        レイヤー
      </h3>
      <div className="flex flex-col gap-1">
        {LAYER_DEFS.map(({ key, label, color }) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-gray-800 transition-colors"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <input
              type="checkbox"
              checked={layers[key] ?? false}
              onChange={() => onToggle(key)}
              className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 accent-blue-500"
            />
            <span className="text-sm text-gray-300">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
