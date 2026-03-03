'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  calculateFeasibility,
  USE_TYPE_DEFAULTS,
  type FeasibilityResult,
  type UseType,
} from '@/engine/feasibility';
import { Input } from '@/components/ui/shadcn/input';

const USE_TYPES: UseType[] = ['マンション', 'オフィス', '商業', 'ホテル', '混合'];

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
  const [useType, setUseType] = useState<UseType>('マンション');
  const [landCostOkuStr, setLandCostOkuStr] = useState('');
  const [customCostStr, setCustomCostStr] = useState('');
  const [customRentalStr, setCustomRentalStr] = useState('');
  const [customSaleStr, setCustomSaleStr] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const defaults = USE_TYPE_DEFAULTS[useType];

  const values = useMemo(() => {
    const landCost = (Number.parseFloat(landCostOkuStr) || 0) * 10000;
    const constructionCostPerTsubo =
      Number.parseFloat(customCostStr) || defaults.constructionCostPerTsubo;
    const rentalIncomePerTsubo =
      Number.parseFloat(customRentalStr) || defaults.rentalIncomePerTsubo || undefined;
    const salePricePerTsubo =
      Number.parseFloat(customSaleStr) || defaults.salePricePerTsubo || undefined;

    if (totalFloorArea <= 0) {
      return null;
    }

    const result = calculateFeasibility({
      totalFloorArea,
      useType,
      constructionCostPerTsubo,
      landCost,
      rentalIncomePerTsubo,
      salePricePerTsubo,
    });

    const snapshot: FeasibilitySnapshot = {
      useType,
      landCost,
      constructionCostPerTsubo,
      rentalIncomePerTsubo,
      salePricePerTsubo,
      result,
    };

    return snapshot;
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
      <h3 className="text-xs font-semibold text-muted-foreground mb-2">事業性概算</h3>

      <div className="rounded-lg bg-card border border-border px-3 py-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {USE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setUseType(type)}
              className={
                useType === type
                  ? 'text-[11px] px-2.5 py-1 rounded border border-primary bg-primary/10 text-primary'
                  : 'text-[11px] px-2.5 py-1 rounded border border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
              }
            >
              {USE_TYPE_DEFAULTS[type].label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">土地取得費</span>
          <div className="flex items-center gap-1.5">
            <Input
              value={landCostOkuStr}
              onChange={(e) => setLandCostOkuStr(e.target.value)}
              type="number"
              step="0.1"
              min="0"
              placeholder="5"
              className="h-7 w-24 text-xs text-right"
            />
            <span className="text-xs text-muted-foreground">億円</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCustom((prev) => !prev)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showCustom ? '▾ 単価をカスタマイズ' : '▸ 単価をカスタマイズ'}
        </button>

        {showCustom && (
          <div className="space-y-2 pl-2 border-l border-border/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">建設単価</span>
              <div className="flex items-center gap-1.5">
                <Input
                  value={customCostStr}
                  onChange={(e) => setCustomCostStr(e.target.value)}
                  type="number"
                  min="0"
                  placeholder={String(defaults.constructionCostPerTsubo)}
                  className="h-6 w-20 text-[11px] text-right"
                />
                <span className="text-[10px] text-muted-foreground">万円/坪</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">想定賃料</span>
              <div className="flex items-center gap-1.5">
                <Input
                  value={customRentalStr}
                  onChange={(e) => setCustomRentalStr(e.target.value)}
                  type="number"
                  min="0"
                  placeholder={String(defaults.rentalIncomePerTsubo)}
                  className="h-6 w-20 text-[11px] text-right"
                />
                <span className="text-[10px] text-muted-foreground">円/坪月</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">販売単価</span>
              <div className="flex items-center gap-1.5">
                <Input
                  value={customSaleStr}
                  onChange={(e) => setCustomSaleStr(e.target.value)}
                  type="number"
                  min="0"
                  placeholder={String(defaults.salePricePerTsubo)}
                  className="h-6 w-20 text-[11px] text-right"
                />
                <span className="text-[10px] text-muted-foreground">万円/坪</span>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border/60">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-[11px] text-muted-foreground">延床（坪）</span>
            <span className="text-[11px] text-right">{fmtMan(values.result.totalFloorAreaTsubo)} 坪</span>
            <span className="text-[11px] text-muted-foreground">概算建設費</span>
            <span className="text-[11px] text-right">{fmtMan(values.result.constructionCost)} 万円</span>
            <span className="text-[11px] text-muted-foreground">総事業費</span>
            <span className="text-[11px] text-right font-medium">
              {fmtMan(values.result.totalProjectCost)} 万円
            </span>
          </div>

          {values.result.annualRentalIncome !== null && (
            <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-[11px] text-muted-foreground">年間賃料収入</span>
              <span className="text-[11px] text-right">
                {fmtMan(values.result.annualRentalIncome)} 万円
              </span>
              <span className="text-[11px] text-muted-foreground">表面利回り</span>
              <span className="text-[11px] text-right font-medium text-emerald-500">
                {fmtPct(values.result.grossYield)}
              </span>
            </div>
          )}

          {values.result.totalSaleRevenue !== null && (
            <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-[11px] text-muted-foreground">販売総額</span>
              <span className="text-[11px] text-right">{fmtMan(values.result.totalSaleRevenue)} 万円</span>
              <span className="text-[11px] text-muted-foreground">事業収支</span>
              <span
                className={
                  values.result.profitLoss !== null && values.result.profitLoss >= 0
                    ? 'text-[11px] text-right font-medium text-emerald-500'
                    : 'text-[11px] text-right font-medium text-red-500'
                }
              >
                {fmtMan(values.result.profitLoss)} 万円
              </span>
              <span className="text-[11px] text-muted-foreground">利益率</span>
              <span className="text-[11px] text-right">{fmtPct(values.result.profitMargin)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
