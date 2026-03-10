'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  calculateFeasibility,
  USE_TYPE_DEFAULTS,
  type FeasibilityResult,
  type UseType,
} from '@/engine/feasibility';
import { Input } from '@/components/ui/shadcn/input';

const USE_TYPES = Object.keys(USE_TYPE_DEFAULTS) as UseType[];
const USE_TYPE_LABELS: Record<UseType, string> = {
  マンション: 'マンション',
  オフィス: 'オフィス',
  商業: '商業',
  ホテル: 'ホテル',
  混合: '混合',
};

export interface FeasibilitySnapshot {
  useType: UseType;
  landCost: number;
  constructionCostPerTsubo: number;
  rentalIncomePerTsubo?: number;
  salePricePerTsubo?: number;
  result: FeasibilityResult;
}

interface FeasibilitySectionProps {
  totalFloorArea: number;
  onSnapshotChange?: (snapshot: FeasibilitySnapshot | null) => void;
}

export function FeasibilitySection({ totalFloorArea, onSnapshotChange }: FeasibilitySectionProps) {
  const [useType, setUseType] = useState<UseType>(USE_TYPES[0]);
  const [landCostOkuStr, setLandCostOkuStr] = useState('');
  const [customCostStr, setCustomCostStr] = useState('');
  const [customRentalStr, setCustomRentalStr] = useState('');
  const [customSaleStr, setCustomSaleStr] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const defaults = USE_TYPE_DEFAULTS[useType];

  const values = useMemo(() => {
    if (totalFloorArea <= 0) return null;

    const landCost = (Number.parseFloat(landCostOkuStr) || 0) * 10000;
    const constructionCostPerTsubo =
      Number.parseFloat(customCostStr) || defaults.constructionCostPerTsubo;
    const rentalIncomePerTsubo =
      Number.parseFloat(customRentalStr) || defaults.rentalIncomePerTsubo || undefined;
    const salePricePerTsubo =
      Number.parseFloat(customSaleStr) || defaults.salePricePerTsubo || undefined;

    const result = calculateFeasibility({
      totalFloorArea,
      useType,
      constructionCostPerTsubo,
      landCost,
      rentalIncomePerTsubo,
      salePricePerTsubo,
    });

    return {
      useType,
      landCost,
      constructionCostPerTsubo,
      rentalIncomePerTsubo,
      salePricePerTsubo,
      result,
    } satisfies FeasibilitySnapshot;
  }, [
    customCostStr,
    customRentalStr,
    customSaleStr,
    defaults.constructionCostPerTsubo,
    defaults.rentalIncomePerTsubo,
    defaults.salePricePerTsubo,
    landCostOkuStr,
    totalFloorArea,
    useType,
  ]);

  useEffect(() => {
    onSnapshotChange?.(values);
  }, [onSnapshotChange, values]);

  const fmtMan = (value: number | null): string =>
    value !== null ? value.toLocaleString('ja-JP', { maximumFractionDigits: 0 }) : '-';
  const fmtPct = (value: number | null): string => (value !== null ? `${value.toFixed(1)}%` : '-');

  if (!values) return null;

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">事業性試算</h3>

      <div className="space-y-3 rounded-lg border border-border bg-card px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          {USE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setUseType(type)}
              className={
                useType === type
                  ? 'rounded border border-primary bg-primary/10 px-2.5 py-1 text-[11px] text-primary'
                  : 'rounded border border-border bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/40'
              }
            >
              {USE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">土地代</span>
          <div className="flex items-center gap-1.5">
            <Input
              value={landCostOkuStr}
              onChange={(event) => setLandCostOkuStr(event.target.value)}
              type="number"
              step="0.1"
              min="0"
              placeholder="5"
              className="h-7 w-24 text-right text-xs"
            />
            <span className="text-xs text-muted-foreground">億円</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCustom((prev) => !prev)}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {showCustom ? 'カスタム設定を閉じる' : 'カスタム設定を開く'}
        </button>

        {showCustom ? (
          <div className="space-y-2 border-l border-border/60 pl-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">建設単価</span>
              <div className="flex items-center gap-1.5">
                <Input
                  value={customCostStr}
                  onChange={(event) => setCustomCostStr(event.target.value)}
                  type="number"
                  min="0"
                  placeholder={String(defaults.constructionCostPerTsubo)}
                  className="h-6 w-20 text-right text-[11px]"
                />
                <span className="text-[10px] text-muted-foreground">万円 / 坪</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">賃料単価</span>
              <div className="flex items-center gap-1.5">
                <Input
                  value={customRentalStr}
                  onChange={(event) => setCustomRentalStr(event.target.value)}
                  type="number"
                  min="0"
                  placeholder={String(defaults.rentalIncomePerTsubo)}
                  className="h-6 w-20 text-right text-[11px]"
                />
                <span className="text-[10px] text-muted-foreground">円 / 坪月</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">売価単価</span>
              <div className="flex items-center gap-1.5">
                <Input
                  value={customSaleStr}
                  onChange={(event) => setCustomSaleStr(event.target.value)}
                  type="number"
                  min="0"
                  placeholder={String(defaults.salePricePerTsubo)}
                  className="h-6 w-20 text-right text-[11px]"
                />
                <span className="text-[10px] text-muted-foreground">万円 / 坪</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="border-t border-border/60 pt-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-[11px] text-muted-foreground">延床面積（坪）</span>
            <span className="text-right text-[11px]">{fmtMan(values.result.totalFloorAreaTsubo)} 坪</span>
            <span className="text-[11px] text-muted-foreground">建設費</span>
            <span className="text-right text-[11px]">{fmtMan(values.result.constructionCost)} 万円</span>
            <span className="text-[11px] text-muted-foreground">総事業費</span>
            <span className="text-right text-[11px] font-medium">
              {fmtMan(values.result.totalProjectCost)} 万円
            </span>
          </div>

          {values.result.annualRentalIncome !== null ? (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border/40 pt-2">
              <span className="text-[11px] text-muted-foreground">年間賃料収入</span>
              <span className="text-right text-[11px]">
                {fmtMan(values.result.annualRentalIncome)} 万円
              </span>
              <span className="text-[11px] text-muted-foreground">表面利回り</span>
              <span className="text-right text-[11px] font-medium text-emerald-700">
                {fmtPct(values.result.grossYield)}
              </span>
            </div>
          ) : null}

          {values.result.totalSaleRevenue !== null ? (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border/40 pt-2">
              <span className="text-[11px] text-muted-foreground">売上想定</span>
              <span className="text-right text-[11px]">{fmtMan(values.result.totalSaleRevenue)} 万円</span>
              <span className="text-[11px] text-muted-foreground">利益</span>
              <span
                className={
                  values.result.profitLoss !== null && values.result.profitLoss >= 0
                    ? 'text-right text-[11px] font-medium text-emerald-700'
                    : 'text-right text-[11px] font-medium text-rose-700'
                }
              >
                {fmtMan(values.result.profitLoss)} 万円
              </span>
              <span className="text-[11px] text-muted-foreground">利益率</span>
              <span className="text-right text-[11px]">{fmtPct(values.result.profitMargin)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
