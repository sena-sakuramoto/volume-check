# CODEX_FEASIBILITY: 事業性計算 + PDF帳票強化

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ボリューム計算結果から用途別の概算建設費・収益・利回りを算出し、デベ向け事業検討レポートPDFを出力する

**Architecture:** 新しい FeasibilitySection コンポーネントで用途選択→概算計算。PrintReport を全面リビルドして事業検討レポート化。

**Tech Stack:** React, Tailwind CSS, 既存の PrintReport/pdf-export パターン

**UI設計はCLAUDE.mdの「UI設計原則（全プロダクト共通）」12原則に従うこと。特に原則1（選択肢 > 自由入力）と原則10（デフォルト最適化）を厳守。デザイン禁止事項（AIグラデーション、Inter、Lucideのみ、shadcnデフォルト）を遵守。**

---

## 前提知識

### デベが事業性判断に使う数字
- **延床面積**（㎡ → 坪） — 既存の計算結果から取得
- **建設単価**（万円/坪） — 用途別プリセット
- **概算建設費** = 延床(坪) × 建設単価
- **想定賃料 or 販売単価** — 用途別プリセット
- **概算収益** = 延床(坪) × 賃料/販売単価
- **土地取得費** — ユーザー入力
- **表面利回り** = 年間賃料 / (土地+建設費) × 100%
- **事業収支** = 販売総額 - (土地+建設費)

### 既存コード
- `src/components/ui/PrintReport.tsx` — 現行の印刷レポート（規制サマリー + 計算結果 + 階別表）
- `src/lib/pdf-export.ts` — window.print() ベースの出力
- `src/components/results/HeroMetrics.tsx` — 結果表示カード
- `src/components/sidebar/ResultsSection.tsx` — 結果セクション

---

## Task 1: 事業性計算の型とロジック

**Files:**
- Create: `src/engine/feasibility.ts`
- Create: `src/engine/__tests__/feasibility.test.ts`

### Step 1: テスト作成

```typescript
// src/engine/__tests__/feasibility.test.ts
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
```

### Step 2: テストが失敗することを確認

```bash
pnpm test -- --testPathPattern="feasibility" --verbose
```
Expected: FAIL（モジュールが存在しない）

### Step 3: 実装

```typescript
// src/engine/feasibility.ts

const SQM_TO_TSUBO = 1 / 3.30579;

export type UseType = 'マンション' | 'オフィス' | '商業' | 'ホテル' | '混合';

export interface FeasibilityInput {
  /** 延床面積（㎡） — VolumeResult.maxFloorArea から */
  totalFloorArea: number;
  /** 想定用途 */
  useType: UseType;
  /** 建設単価（万円/坪） */
  constructionCostPerTsubo: number;
  /** 土地取得費（万円） */
  landCost: number;
  /** 想定賃料（円/坪・月）— 賃貸の場合 */
  rentalIncomePerTsubo?: number;
  /** 想定販売単価（万円/坪）— 分譲の場合 */
  salePricePerTsubo?: number;
}

export interface FeasibilityResult {
  /** 延床面積（坪） */
  totalFloorAreaTsubo: number;
  /** 概算建設費（万円） */
  constructionCost: number;
  /** 総事業費（万円）= 土地 + 建設 */
  totalProjectCost: number;
  /** 年間賃料収入（万円）— 賃貸の場合 */
  annualRentalIncome: number | null;
  /** 表面利回り（%）— 賃貸の場合 */
  grossYield: number | null;
  /** 販売総額（万円）— 分譲の場合 */
  totalSaleRevenue: number | null;
  /** 事業収支（万円）= 販売総額 - 総事業費 */
  profitLoss: number | null;
  /** 利益率（%）= 収支 / 総事業費 × 100 */
  profitMargin: number | null;
}

/** 用途別デフォルト値 */
export const USE_TYPE_DEFAULTS: Record<UseType, {
  constructionCostPerTsubo: number;
  rentalIncomePerTsubo: number;
  salePricePerTsubo: number;
  label: string;
}> = {
  'マンション': { constructionCostPerTsubo: 130, rentalIncomePerTsubo: 15000, salePricePerTsubo: 350, label: 'マンション' },
  'オフィス': { constructionCostPerTsubo: 170, rentalIncomePerTsubo: 20000, salePricePerTsubo: 0, label: 'オフィス' },
  '商業': { constructionCostPerTsubo: 150, rentalIncomePerTsubo: 25000, salePricePerTsubo: 0, label: '商業施設' },
  'ホテル': { constructionCostPerTsubo: 250, rentalIncomePerTsubo: 0, salePricePerTsubo: 0, label: 'ホテル' },
  '混合': { constructionCostPerTsubo: 160, rentalIncomePerTsubo: 18000, salePricePerTsubo: 300, label: '複合施設' },
};

export function calculateFeasibility(input: FeasibilityInput): FeasibilityResult {
  const tsubo = input.totalFloorArea * SQM_TO_TSUBO;
  const constructionCost = tsubo * input.constructionCostPerTsubo;
  const totalProjectCost = input.landCost + constructionCost;

  let annualRentalIncome: number | null = null;
  let grossYield: number | null = null;

  if (input.rentalIncomePerTsubo && input.rentalIncomePerTsubo > 0) {
    // 円 → 万円: / 10000
    annualRentalIncome = (tsubo * input.rentalIncomePerTsubo * 12) / 10000;
    grossYield = totalProjectCost > 0
      ? (annualRentalIncome / totalProjectCost) * 100
      : null;
  }

  let totalSaleRevenue: number | null = null;
  let profitLoss: number | null = null;
  let profitMargin: number | null = null;

  if (input.salePricePerTsubo && input.salePricePerTsubo > 0) {
    totalSaleRevenue = tsubo * input.salePricePerTsubo;
    profitLoss = totalSaleRevenue - totalProjectCost;
    profitMargin = totalProjectCost > 0
      ? (profitLoss / totalProjectCost) * 100
      : null;
  }

  return {
    totalFloorAreaTsubo: tsubo,
    constructionCost,
    totalProjectCost,
    annualRentalIncome,
    grossYield,
    totalSaleRevenue,
    profitLoss,
    profitMargin,
  };
}
```

### Step 4: テスト実行

```bash
pnpm test -- --testPathPattern="feasibility" --verbose
```
Expected: PASS

### Step 5: コミット

```bash
git add src/engine/feasibility.ts src/engine/__tests__/feasibility.test.ts
git commit -m "feat: add feasibility calculation engine with TDD"
```

---

## Task 2: FeasibilitySection コンポーネント

**Files:**
- Create: `src/components/results/FeasibilitySection.tsx`
- Modify: `src/components/sidebar/ResultsSection.tsx` (統合)

### Step 1: 実装

用途選択はボタン（原則1: 選択肢 > 自由入力）。
デフォルト値は最適化済み（原則10）。
カスタム入力は折りたたみ。

```tsx
// src/components/results/FeasibilitySection.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  calculateFeasibility,
  USE_TYPE_DEFAULTS,
  type UseType,
  type FeasibilityResult,
} from '@/engine/feasibility';
import { Input } from '@/components/ui/shadcn/input';

interface FeasibilitySectionProps {
  totalFloorArea: number; // ㎡ — VolumeResult から
}

const USE_TYPES: UseType[] = ['マンション', 'オフィス', '商業', 'ホテル', '混合'];

export function FeasibilitySection({ totalFloorArea }: FeasibilitySectionProps) {
  const [useType, setUseType] = useState<UseType>('マンション');
  const [landCostStr, setLandCostStr] = useState('');
  const [customCost, setCustomCost] = useState('');
  const [customRental, setCustomRental] = useState('');
  const [customSale, setCustomSale] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const defaults = USE_TYPE_DEFAULTS[useType];

  const result: FeasibilityResult | null = useMemo(() => {
    const landCost = parseFloat(landCostStr) * 10000 || 0; // 億円 → 万円
    const costPerTsubo = parseFloat(customCost) || defaults.constructionCostPerTsubo;
    const rental = parseFloat(customRental) || defaults.rentalIncomePerTsubo;
    const sale = parseFloat(customSale) || defaults.salePricePerTsubo;

    if (totalFloorArea <= 0) return null;

    return calculateFeasibility({
      totalFloorArea,
      useType,
      constructionCostPerTsubo: costPerTsubo,
      landCost,
      rentalIncomePerTsubo: rental > 0 ? rental : undefined,
      salePricePerTsubo: sale > 0 ? sale : undefined,
    });
  }, [totalFloorArea, useType, landCostStr, customCost, customRental, customSale, defaults]);

  const fmt = (v: number | null) => v !== null ? v.toLocaleString('ja-JP', { maximumFractionDigits: 0 }) : '-';
  const fmtPct = (v: number | null) => v !== null ? v.toFixed(1) + '%' : '-';

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">事業性概算</p>

      {/* 用途選択（ボタン） */}
      <div className="flex flex-wrap gap-1">
        {USE_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setUseType(t)}
            className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
              useType === t
                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {USE_TYPE_DEFAULTS[t].label}
          </button>
        ))}
      </div>

      {/* 土地取得費 */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-muted-foreground w-16 shrink-0">土地取得費</label>
        <Input
          value={landCostStr}
          onChange={e => setLandCostStr(e.target.value)}
          placeholder="5"
          className="h-7 text-xs w-20"
          type="number"
          step="0.1"
        />
        <span className="text-[10px] text-muted-foreground">億円</span>
      </div>

      {/* カスタム入力トグル */}
      <button
        onClick={() => setShowCustom(!showCustom)}
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showCustom ? '▾ 単価をカスタマイズ' : '▸ 単価をカスタマイズ'}
      </button>

      {showCustom && (
        <div className="space-y-1.5 pl-2 border-l border-border/50">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground w-16 shrink-0">建設単価</label>
            <Input
              value={customCost}
              onChange={e => setCustomCost(e.target.value)}
              placeholder={String(defaults.constructionCostPerTsubo)}
              className="h-6 text-[11px] w-20"
              type="number"
            />
            <span className="text-[10px] text-muted-foreground">万円/坪</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground w-16 shrink-0">想定賃料</label>
            <Input
              value={customRental}
              onChange={e => setCustomRental(e.target.value)}
              placeholder={String(defaults.rentalIncomePerTsubo)}
              className="h-6 text-[11px] w-20"
              type="number"
            />
            <span className="text-[10px] text-muted-foreground">円/坪月</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground w-16 shrink-0">販売単価</label>
            <Input
              value={customSale}
              onChange={e => setCustomSale(e.target.value)}
              placeholder={String(defaults.salePricePerTsubo)}
              className="h-6 text-[11px] w-20"
              type="number"
            />
            <span className="text-[10px] text-muted-foreground">万円/坪</span>
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="text-[10px] text-muted-foreground">延床（坪）</div>
            <div className="text-[11px] text-right">{fmt(result.totalFloorAreaTsubo)} 坪</div>

            <div className="text-[10px] text-muted-foreground">概算建設費</div>
            <div className="text-[11px] text-right">{fmt(result.constructionCost)} 万円</div>

            <div className="text-[10px] text-muted-foreground">総事業費</div>
            <div className="text-[11px] text-right font-medium">{fmt(result.totalProjectCost)} 万円</div>
          </div>

          {result.annualRentalIncome !== null && (
            <>
              <div className="border-t border-border/50" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-[10px] text-muted-foreground">年間賃料収入</div>
                <div className="text-[11px] text-right">{fmt(result.annualRentalIncome)} 万円</div>
                <div className="text-[10px] text-muted-foreground">表面利回り</div>
                <div className="text-[11px] text-right font-medium text-emerald-400">{fmtPct(result.grossYield)}</div>
              </div>
            </>
          )}

          {result.totalSaleRevenue !== null && (
            <>
              <div className="border-t border-border/50" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-[10px] text-muted-foreground">販売総額</div>
                <div className="text-[11px] text-right">{fmt(result.totalSaleRevenue)} 万円</div>
                <div className="text-[10px] text-muted-foreground">事業収支</div>
                <div className={`text-[11px] text-right font-medium ${
                  (result.profitLoss ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {fmt(result.profitLoss)} 万円
                </div>
                <div className="text-[10px] text-muted-foreground">利益率</div>
                <div className="text-[11px] text-right">{fmtPct(result.profitMargin)}</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 2: ResultsSection に統合

`src/components/sidebar/ResultsSection.tsx` に FeasibilitySection をインポートして、
計算結果の下に表示:

```tsx
import { FeasibilitySection } from '@/components/results/FeasibilitySection';

// VolumeResult がある場合
{volumeResult && (
  <FeasibilitySection totalFloorArea={volumeResult.maxFloorArea} />
)}
```

### Step 3: ビルド確認

```bash
pnpm build
```

### Step 4: コミット

```bash
git add src/components/results/FeasibilitySection.tsx src/components/sidebar/ResultsSection.tsx
git commit -m "feat: add feasibility calculation UI with use-type presets"
```

---

## Task 3: PDF帳票の全面リビルド

**Files:**
- Modify: `src/components/ui/PrintReport.tsx`
- Modify: `src/lib/pdf-export.ts`

### Step 1: PrintReport に全セクションを追加

現行は4セクション → 7セクションに拡張:

1. **物件概要** — 住所, 地番, 敷地面積, 用途地域, 防火地域
2. **法規制サマリー** — 建ぺい率, 容積率, 絶対高さ, 高度地区, 日影規制, 地区計画警告
3. **最大ボリューム** — 延床面積, 建築面積, 最高高さ, 最大階数
4. **各階床面積表** — 既存
5. **斜線制限詳細** — 道路/隣地/北側の各パラメータ（NEW）
6. **事業性概算** — 用途, 建設費, 収益, 利回り（NEW）
7. **免責事項** — 既存

### Step 2: pdf-export.ts に事業性セクション追加

```typescript
// pdf-export.ts の generateReportHtml に feasibility セクションを追加

function feasibilitySection(result: FeasibilityResult, useType: string): string {
  return `
    <div class="section">
      <h3>事業性概算</h3>
      <table>
        <tr><td>想定用途</td><td>${useType}</td></tr>
        <tr><td>延床面積</td><td>${result.totalFloorAreaTsubo.toFixed(1)} 坪</td></tr>
        <tr><td>概算建設費</td><td>${(result.constructionCost / 10000).toFixed(2)} 億円</td></tr>
        <tr><td>総事業費</td><td>${(result.totalProjectCost / 10000).toFixed(2)} 億円</td></tr>
        ${result.annualRentalIncome !== null ? `
          <tr><td>年間賃料収入</td><td>${(result.annualRentalIncome / 10000).toFixed(2)} 億円</td></tr>
          <tr><td>表面利回り</td><td>${result.grossYield?.toFixed(1)}%</td></tr>
        ` : ''}
        ${result.totalSaleRevenue !== null ? `
          <tr><td>販売総額</td><td>${(result.totalSaleRevenue / 10000).toFixed(2)} 億円</td></tr>
          <tr><td>事業収支</td><td>${(result.profitLoss! / 10000).toFixed(2)} 億円</td></tr>
        ` : ''}
      </table>
    </div>
  `;
}
```

### Step 3: ビルド確認

```bash
pnpm build
```

### Step 4: コミット

```bash
git add src/components/ui/PrintReport.tsx src/lib/pdf-export.ts
git commit -m "feat: rebuild PDF report with feasibility section and all calculation data"
```

---

## 完了条件

- [ ] `pnpm build` 成功
- [ ] `pnpm test` 全PASS（feasibility テスト含む）
- [ ] 用途選択 → 建設費・利回りが即座に表示される
- [ ] 土地取得費を入力すると利回り・収支が計算される
- [ ] デフォルト値で操作なしでも概算が見える（原則10）
- [ ] PDF帳票に事業性セクションが含まれる
- [ ] 既存の PrintReport 機能が壊れていない
