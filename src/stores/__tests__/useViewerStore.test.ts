import { useViewerStore } from '../useViewerStore';

describe('useViewerStore basic preset defaults', () => {
  beforeEach(() => {
    useViewerStore.setState((state) => ({
      ...state,
      preset: 'basic',
      layers: { ...state.layers },
    }));
    useViewerStore.getState().selectPreset('basic');
  });

  it('starts with practical legal overlays visible (road/adjacent/north/absolute)', () => {
    const { layers } = useViewerStore.getState();
    expect(layers.road).toBe(true);
    expect(layers.adjacent).toBe(true);
    expect(layers.north).toBe(true);
    expect(layers.absoluteHeight).toBe(true);
    expect(layers.shadow).toBe(false);
    expect(layers.buildingPatternOptimal).toBe(false);
  });
});
