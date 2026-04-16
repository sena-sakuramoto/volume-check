import type { LayerPreset } from '@/stores/useViewerStore';

export interface PresetDef {
  key: LayerPreset;
  label: string;
  icon: string;
}

export const PRESET_DEFS: PresetDef[] = [
  { key: 'basic', label: '基本', icon: 'Box' },
  { key: 'shadow', label: '日影', icon: 'Sun' },
  { key: 'pattern', label: 'パターン', icon: 'LayoutGrid' },
];

export interface LayerDef {
  key: string;
  label: string;
  color: string;
}

export interface LayerGroup {
  label: string;
  items: LayerDef[];
}

export const LAYER_GROUPS: LayerGroup[] = [
  {
    label: '基本',
    items: [
      { key: 'road', label: '道路斜線', color: '#f59e0b' },
      { key: 'adjacent', label: '隣地斜線', color: '#10b981' },
      { key: 'north', label: '北側斜線', color: '#8b5cf6' },
      { key: 'absoluteHeight', label: '絶対高さ', color: '#ef4444' },
      { key: 'shadow', label: '日影エンベロープ', color: '#22d3ee' },
    ],
  },
  {
    label: '影解析',
    items: [
      { key: 'reverseShadowContours', label: '逆日影ライン', color: '#ef4444' },
      { key: 'reverseShadowHeightmap', label: '逆日影高さ', color: '#22c55e' },
      { key: 'shadowMeasurementLines', label: '5m/10mライン', color: '#f59e0b' },
      { key: 'shadowHeatmap', label: '等時間日影図', color: '#dc2626' },
      { key: 'shadowTimeShadow', label: '時刻別日影', color: '#1e293b' },
    ],
  },
  {
    label: '表示',
    items: [
      { key: 'floorPlates', label: '階高表示', color: '#60a5fa' },
    ],
  },
  {
    label: 'パターン比較',
    items: [
      { key: 'buildingPatternLowRise', label: '低層パターン', color: '#f97316' },
      { key: 'buildingPatternMidHigh', label: '中高層パターン', color: '#a855f7' },
      { key: 'buildingPatternOptimal', label: '最適パターン', color: '#22d3ee' },
    ],
  },
];
