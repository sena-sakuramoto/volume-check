import { create } from 'zustand';

export type LayerPreset = 'basic' | 'shadow' | 'pattern' | 'custom';
export type PatternKey = 'lowRise' | 'midHighRise' | 'optimal';

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
    road: true, adjacent: true, north: true, absoluteHeight: true,
    shadow: false, reverseShadowContours: false, reverseShadowHeightmap: false,
    shadowMeasurementLines: false, shadowHeatmap: false, shadowTimeShadow: false,
    floorPlates: true, buildingPatternLowRise: false, buildingPatternMidHigh: false,
    buildingPatternOptimal: true,
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
  selectedPattern: PatternKey | null;

  selectPreset: (p: LayerPreset) => void;
  selectPattern: (key: PatternKey | null) => void;
  toggleLayer: (key: keyof LayerState) => void;
  setShadowTime: (value: number) => void;
}

const PATTERN_LAYER_KEYS: Record<PatternKey, keyof Pick<
  LayerState,
  'buildingPatternLowRise' | 'buildingPatternMidHigh' | 'buildingPatternOptimal'
>> = {
  lowRise: 'buildingPatternLowRise',
  midHighRise: 'buildingPatternMidHigh',
  optimal: 'buildingPatternOptimal',
};

export const useViewerStore = create<ViewerStore>((set) => ({
  preset: 'basic',
  layers: { ...PRESETS.basic },
  shadowTimeValue: 120,
  selectedPattern: null,

  selectPreset: (p) =>
    set(() => {
      if (p === 'custom') return { preset: 'custom', selectedPattern: null };
      return { preset: p, layers: { ...PRESETS[p] }, selectedPattern: null };
    }),

  selectPattern: (key) =>
    set(() => {
      if (key === null) {
        return {
          preset: 'pattern',
          layers: { ...PRESETS.pattern },
          selectedPattern: null,
        };
      }

      return {
        preset: 'pattern',
        layers: {
          ...PRESETS.pattern,
          buildingPatternLowRise: false,
          buildingPatternMidHigh: false,
          buildingPatternOptimal: false,
          [PATTERN_LAYER_KEYS[key]]: true,
        },
        selectedPattern: key,
      };
    }),

  toggleLayer: (key) =>
    set((state) => ({
      preset: 'custom',
      selectedPattern: null,
      layers: { ...state.layers, [key]: !state.layers[key] },
    })),

  setShadowTime: (value) => set({ shadowTimeValue: value }),
}));
