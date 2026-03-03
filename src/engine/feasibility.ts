const SQM_TO_TSUBO = 1 / 3.30579;

export type UseType = 'マンション' | 'オフィス' | '商業' | 'ホテル' | '混合';

export interface FeasibilityInput {
  /** 延床面積（㎡） */
  totalFloorArea: number;
  /** 想定用途 */
  useType: UseType;
  /** 建設単価（万円/坪） */
  constructionCostPerTsubo: number;
  /** 土地取得費（万円） */
  landCost: number;
  /** 想定賃料（円/坪・月） */
  rentalIncomePerTsubo?: number;
  /** 想定販売単価（万円/坪） */
  salePricePerTsubo?: number;
}

export interface FeasibilityResult {
  /** 延床面積（坪） */
  totalFloorAreaTsubo: number;
  /** 概算建設費（万円） */
  constructionCost: number;
  /** 総事業費（万円） */
  totalProjectCost: number;
  /** 年間賃料収入（万円） */
  annualRentalIncome: number | null;
  /** 表面利回り（%） */
  grossYield: number | null;
  /** 販売総額（万円） */
  totalSaleRevenue: number | null;
  /** 事業収支（万円） */
  profitLoss: number | null;
  /** 利益率（%） */
  profitMargin: number | null;
}

/** 用途別の初期値（概算） */
export const USE_TYPE_DEFAULTS: Record<
  UseType,
  {
    constructionCostPerTsubo: number;
    rentalIncomePerTsubo: number;
    salePricePerTsubo: number;
    label: string;
  }
> = {
  マンション: {
    constructionCostPerTsubo: 130,
    rentalIncomePerTsubo: 15000,
    salePricePerTsubo: 350,
    label: 'マンション',
  },
  オフィス: {
    constructionCostPerTsubo: 170,
    rentalIncomePerTsubo: 20000,
    salePricePerTsubo: 0,
    label: 'オフィス',
  },
  商業: {
    constructionCostPerTsubo: 150,
    rentalIncomePerTsubo: 25000,
    salePricePerTsubo: 0,
    label: '商業施設',
  },
  ホテル: {
    constructionCostPerTsubo: 250,
    rentalIncomePerTsubo: 0,
    salePricePerTsubo: 0,
    label: 'ホテル',
  },
  混合: {
    constructionCostPerTsubo: 160,
    rentalIncomePerTsubo: 18000,
    salePricePerTsubo: 300,
    label: '複合施設',
  },
};

export function calculateFeasibility(input: FeasibilityInput): FeasibilityResult {
  const totalFloorAreaTsubo = input.totalFloorArea * SQM_TO_TSUBO;
  const constructionCost = totalFloorAreaTsubo * input.constructionCostPerTsubo;
  const totalProjectCost = input.landCost + constructionCost;

  let annualRentalIncome: number | null = null;
  let grossYield: number | null = null;

  if (typeof input.rentalIncomePerTsubo === 'number' && input.rentalIncomePerTsubo > 0) {
    // 円 -> 万円
    annualRentalIncome = (totalFloorAreaTsubo * input.rentalIncomePerTsubo * 12) / 10000;
    grossYield = totalProjectCost > 0 ? (annualRentalIncome / totalProjectCost) * 100 : null;
  }

  let totalSaleRevenue: number | null = null;
  let profitLoss: number | null = null;
  let profitMargin: number | null = null;

  if (typeof input.salePricePerTsubo === 'number' && input.salePricePerTsubo > 0) {
    totalSaleRevenue = totalFloorAreaTsubo * input.salePricePerTsubo;
    profitLoss = totalSaleRevenue - totalProjectCost;
    profitMargin = totalProjectCost > 0 ? (profitLoss / totalProjectCost) * 100 : null;
  }

  return {
    totalFloorAreaTsubo,
    constructionCost,
    totalProjectCost,
    annualRentalIncome,
    grossYield,
    totalSaleRevenue,
    profitLoss,
    profitMargin,
  };
}
