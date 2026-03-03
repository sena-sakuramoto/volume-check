import { calculateFeasibility, type FeasibilityInput } from '../feasibility';

describe('calculateFeasibility', () => {
  const base: FeasibilityInput = {
    totalFloorArea: 1000, // 1000㎡
    useType: 'マンション',
    constructionCostPerTsubo: 130, // 万円/坪
    landCost: 50000, // 万円（5億円）
  };

  test('概算建設費の計算', () => {
    const result = calculateFeasibility(base);
    // 1000㎡ = 302.5坪, 302.5 × 130 = 39,325万円
    expect(result.totalFloorAreaTsubo).toBeCloseTo(302.5, 0);
    expect(result.constructionCost).toBeCloseTo(39325, -1);
  });

  test('賃貸マンションの利回り計算', () => {
    const input = { ...base, rentalIncomePerTsubo: 15000 }; // 円/坪・月
    const result = calculateFeasibility(input);
    // 年間賃料 = 302.5坪 × 15,000円 × 12ヶ月 = 54,450,000円 = 5,445万円
    expect(result.annualRentalIncome).toBeCloseTo(5445, -1);
    // 利回り = 5,445 / (50,000 + 39,325) × 100 = 6.09%
    expect(result.grossYield).toBeCloseTo(6.09, 0);
  });

  test('分譲の事業収支計算', () => {
    const input = { ...base, salePricePerTsubo: 350 }; // 万円/坪
    const result = calculateFeasibility(input);
    // 販売総額 = 302.5 × 350 = 105,875万円
    expect(result.totalSaleRevenue).toBeCloseTo(105875, -1);
    // 収支 = 105,875 - (50,000 + 39,325) = 16,550万円
    expect(result.profitLoss).toBeCloseTo(16550, -1);
  });
});
