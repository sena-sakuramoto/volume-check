import { generatePdfReport } from '../pdf-export';
import type { ZoningData, VolumeResult } from '@/engine/types';
import type { FeasibilityResult } from '@/engine/feasibility';

describe('generatePdfReport', () => {
  const originalWindow = global.window;

  afterEach(() => {
    jest.useRealTimers();
    global.window = originalWindow;
    jest.restoreAllMocks();
  });

  test('renders report HTML with feasibility data and wires print on load', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T09:00:00+09:00'));

    const write = jest.fn();
    const open = jest.fn();
    const close = jest.fn();
    const print = jest.fn();
    const addEventListener = jest.fn();

    global.window = {
      open: jest.fn(() => ({
        document: { open, write, close },
        addEventListener,
        print,
      })),
    } as unknown as Window & typeof globalThis;

    const zoning = {
      district: '商業地域',
      fireDistrict: '防火地域',
      heightDistrict: { type: '第二種' },
      coverageRatio: 0.8,
      floorAreaRatio: 5,
      absoluteHeightLimit: 31,
      wallSetback: 1,
      shadowRegulation: null,
      isCornerLot: false,
      districtPlan: { name: '神田地区計画', maxHeight: 28 },
    } as ZoningData;

    const result = {
      maxFloorArea: 1000,
      maxCoverageArea: 200,
      maxHeight: 28,
      maxFloors: 8,
      envelopeVertices: new Float32Array(),
      envelopeIndices: new Uint32Array(),
      setbackEnvelopes: {
        road: null,
        adjacent: null,
        north: null,
        absoluteHeight: null,
        shadow: null,
      },
      shadowProjection: null,
      heightFieldData: null,
      reverseShadow: null,
      buildingPatterns: null,
      buildablePolygon: null,
      shadowBoundary: null,
    } as VolumeResult;

    const feasibilityResult = {
      totalFloorAreaTsubo: 302.5,
      constructionCost: 39325,
      totalProjectCost: 89325,
      annualRentalIncome: 5445,
      grossYield: 6.1,
      totalSaleRevenue: 105875,
      profitLoss: 16550,
      profitMargin: 18.5,
    } as FeasibilityResult;

    generatePdfReport(zoning, result, 200, [3.5, 3.5], [{ direction: '南', width: 6 }], {
      useType: 'マンション',
      landCost: 50000,
      result: feasibilityResult,
    });

    expect(global.window.open).toHaveBeenCalledWith('', '_blank');
    expect(open).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(write).toHaveBeenCalledTimes(1);

    const html = write.mock.calls[0][0] as string;
    expect(html).toContain('2026');
    expect(html).toContain('302.5');
    expect(html).toContain('105,875');
    expect(html).toContain('500%');
    expect(addEventListener).toHaveBeenCalledWith('load', expect.any(Function));

    const onLoad = addEventListener.mock.calls[0][1] as () => void;
    onLoad();
    expect(print).toHaveBeenCalled();
  });
});
