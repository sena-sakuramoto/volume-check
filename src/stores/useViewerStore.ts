import { create } from 'zustand';

export type LayerPreset = 'basic' | 'shadow' | 'pattern' | 'custom';

export interface LayerState {
  road: boolean;
  adjacent: boolean;
  north: boolean;
  absoluteHeight: boolean;
  shadow: boolean;
  reverseShadowContours: boolean;
  reverseShadowHeightmap: boolean;
  shadowMeasurementLines: boolean;
  shadowHeatmap: boolean;
  shadowTimeShadow: boolean;
  floorPlates: boolean;
  buildingPatternLowRise: boolean;
  buildingPatternMidHigh: boolean;
  buildingPatternOptimal: boolean;
}

const PRESETS: Record<Exclude<LayerPreset, 'custom'>, LayerState> = {
  basic: {
    // Default practical view: show major legal slope constraints from first render.
    road: true, adjacent: true, north: true, absoluteHeight: true,
    shadow: false, reverseShadowContours: false, reverseShadowHeightmap: false,
    shadowMeasurementLines: false, shadowHeatmap: false, shadowTimeShadow: false,
    floorPlates: false, buildingPatternLowRise: false, buildingPatternMidHigh: false,
    buildingPatternOptimal: false,
  },
  shadow: {
    road: false, adjacent: false, north: false, absoluteHeight: false,
    shadow: true, reverseShadowContours: true, reverseShadowHeightmap: true,
    shadowMeasurementLines: true, shadowHeatmap: false, shadowTimeShadow: false,
    floorPlates: true, buildingPatternLowRise: false, buildingPatternMidHigh: false,
    buildingPatternOptimal: false,
  },
  pattern: {
    road: false, adjacent: false, north: false, absoluteHeight: false,
    shadow: false, reverseShadowContours: false, reverseShadowHeightmap: false,
    shadowMeasurementLines: true, shadowHeatmap: false, shadowTimeShadow: false,
    floorPlates: true, buildingPatternLowRise: true, buildingPatternMidHigh: true,
    buildingPatternOptimal: true,
  },
};

interface ViewerStore {
  preset: LayerPreset;
  layers: LayerState;
  shadowTimeValue: number;

  selectPreset: (p: LayerPreset) => void;
  toggleLayer: (key: keyof LayerState) => void;
  setShadowTime: (value: number) => void;
}

export const useViewerStore = create<ViewerStore>((set) => ({
  preset: 'basic',
  layers: { ...PRESETS.basic },
  shadowTimeValue: 120,

  selectPreset: (p) =>
    set(() => {
      if (p === 'custom') return { preset: 'custom' };
      return { preset: p, layers: { ...PRESETS[p] } };
    }),

  toggleLayer: (key) =>
    set((state) => ({
      preset: 'custom',
      layers: { ...state.layers, [key]: !state.layers[key] },
    })),

  setShadowTime: (value) => set({ shadowTimeValue: value }),
}));
