import { useState, useCallback } from 'react';

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

export function useLayerPresets() {
  const [preset, setPreset] = useState<LayerPreset>('basic');
  const [layers, setLayers] = useState<LayerState>(PRESETS.basic);

  const selectPreset = useCallback((p: LayerPreset) => {
    setPreset(p);
    if (p !== 'custom') {
      setLayers(PRESETS[p]);
    }
  }, []);

  const toggleLayer = useCallback((key: keyof LayerState) => {
    setLayers(prev => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
    setPreset('custom');
  }, []);

  const setLayersFromPreset = useCallback((p: Exclude<LayerPreset, 'custom'>) => {
    setPreset(p);
    setLayers(PRESETS[p]);
  }, []);

  return { preset, layers, selectPreset, toggleLayer, setLayersFromPreset };
}
