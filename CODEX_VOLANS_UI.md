# CODEX_VOLANS_UI — VOLANS UI 忠実再現

**優先度**: 最高 / **担当**: Codex / **作業ディレクトリ**: `D:\senaa_dev\volume-check`

---

## 0. 背景（なぜこれをやるか）

volume-check を **VOLANS（ヴォランス）** としてリブランドする。サブタイトルは **「最大ボリュームを、一瞬で。」**。
由来はとびうお座（Volans）= 海（斜線制限）から空（最大ボリューム）へ跳躍する星座。三重意味で ①とびうお座 / ②**Vol**ume / ③**ans**wer = "ボリュームの答え"。

現状 `/sky` は SKY FACTOR 風の一般的シェルで、正典画像と一致していない。
ユーザーから「正典画像を忠実再現、絶対守れ」との明言あり。勝手に改変禁止。

---

## 1. 正典（絶対参照）

| 項目 | パス |
|---|---|
| UI 仕様書 | `docs/ui-spec-volans.md`（完全版・文言・数値・色すべてここに） |
| PC 版画像 | `C:\Users\senaa\Downloads\ChatGPT Image 2026年4月17日 15_54_58.png` |
| スマホ6シーン画像 | `C:\Users\senaa\Downloads\ChatGPT Image 2026年4月17日 15_57_10.png` |
| メモリ参照 | `C:\Users\senaa\.claude\projects\D--senaa-dev\memory\ref_volans-ui-canonical.md` |
| UI 原則 | `D:\senaa_dev\docs\ui-principles.md` |

**実装で迷ったら画像に戻る**。文言・数値・色はすべて `docs/ui-spec-volans.md` を**完全コピー**。

---

## 2. スコープ

### 2.1 PC 版 `/sky`（完全書き換え）

現状の `src/app/sky/page.tsx` を、正典 PC 画像に完全一致する形で書き直す。

構成（画面全体）:
- ヘッダー（56px）: **VOLANS ロゴ（V字跳躍+星1つ）**左 / プロジェクト名「新宿区西新宿3丁目計画」 + 編集アイコン / 最終更新「2026/04/17 14:30」 / 3ステップピル `01 敷地入力` / `02 法規・条件` / `03 解析・結果`（03がアクティブ） / `レポート出力(PDF)` / `プロジェクトを保存` / アバター
- 左サイドバー（220px デフォルト / 56px 折畳み可）: ダッシュボードがアクティブ。セクション: プロジェクト / 解析 / AIアシスタント / データ。下部: チュートリアル / 設定・ヘルプ / `<` 折畳ボタン
- 中央上: 3Dビュア（既存 `<Viewer>` 流用、枠を白カード化、ツールバー追加）
  - 上左: 視点 ▼
  - 上中右: 日照時間(冬至) ▼ / レイヤー ▼ / 太陽アイコン
  - 右縦: 3D / 2D / ○ / ⛶ / 測
  - 左下: ミニマップ（敷地の上空視点、白角丸カード）
  - 左下凡例: ○斜線制限(青) / ○天空率緩和後(緑)
- 中央下: 解析結果サマリー 3カード横並び
  - カード1 青: 斜線制限のみ（現行）/ 5,420.18㎡ / 8階 / 建ぺい率 31.2% / 容積充足率 91.2%
  - カード2 緑: 天空率緩和を活用 / 6,712.45㎡ / 10階 / 建ぺい率 37.5% / 容積充足率 100.0%
  - カード3 橙: 増加分（天空率の効果）/ +1,292.27㎡ / +2階 / +23.8%
- 中央下下: 主要チェック結果 7項目横並び（建ぺい率/容積率/道路斜線/隣地斜線/北側斜線/日影規制/絶対高さ、全て緑「適合」、3種は「(天空率)」注釈付き） + `詳細一覧 →`
- 右パネル（320px）: タブ(`解析条件`/`解析レポート`) + 敷地情報カード + 天空率チェック(半円ゲージ 0.612/0.586、適合緑バッジ、参考 +0.026 (+2.6%)) + クイックアクション3件
- フッター（32px）: 「天空率計算は平成14年 国交省告示 第1350号に基づく方法で算定しています。」 + `精度向上のためのフィードバックを送る`

数値・文言は `docs/ui-spec-volans.md` 2.2〜2.6 節から**完全コピー**。

### 2.2 モバイル版 6 シーン（新規）

レイアウト: `src/app/m/layout.tsx` にボトムナビ（ダッシュボード/プロジェクト/+/解析/メニュー）を配置。

画面とルート:
| シーン | ルート | 主要要素 |
|---|---|---|
| A ダッシュボード | `/m` | VOLANSヘッダ / ステッパー / サマリーカード(タブ) / 天空率チェック(半円) / 3Dプレビュー / クイックアクション |
| B 3Dビュア | `/m/3d` | 戻る / 3Dフル表示 / 測定点ゲージ / ボリューム比較2列 / 増加分橙カード / シェア・PDF |
| C 敷地入力 | `/m/input` | 戻る / 所在地 / 敷地面積 / 形状 / 法規自動取得リスト / 検討条件 / 解析実行 CTA |
| D パターン比較 | `/m/compare` | 戻る / タブ(一覧/グラフ) / 3パターンカード(斜線/天空率/比較) / + 追加 |
| E AIアシスタント | `/m/ai` | 戻る / チャットUI / 提案チップ / AI返信 / 反映ボタン / 入力欄 |
| F レポート出力 | `/m/report` | 戻る / PDFプレビュー / DLボタン / 共有ボタン |

詳細要素・文言・数値は `docs/ui-spec-volans.md` 3.1〜3.6 節。

---

## 3. 実装ルール

### 3.1 技術
- Next.js App Router、`"use client"` で OK（複雑な状態なし）
- Tailwind CSS
- アイコン: Lucide + Phosphor 併用（Lucide のみは禁止 / `ui-principles.md` 参照）
- フォント: Noto Sans JP（既に globals.css で定義済み）
- 数値: tabular-nums

### 3.2 カラートークン
`docs/ui-spec-volans.md` 1 節のトークンを `src/app/globals.css` に **VOLANS 用スコープ** で追加（既存の `--app-*` を壊さない）。
例:
```css
@layer base {
  :root {
    --volans-bg: #f6f7fb;
    --volans-surface: #ffffff;
    --volans-border: #e5e9f0;
    --volans-text: #1c2230;
    --volans-muted: #6b7280;
    --volans-primary: #3b6de1;
    --volans-primary-soft: #e4ecff;
    --volans-success: #22a06b;
    --volans-success-soft: #e7f5ee;
    --volans-warning: #f19342;
    --volans-warning-soft: #fff0e0;
    --volans-danger: #ef4444;
    --volans-sky-slant: #5d86d9;
    --volans-sky-relax: #3eb883;
  }
}
```

### 3.3 コンポーネント分割
`src/components/volans/` 配下に以下を作成:
- `VolansShell.tsx` — ヘッダー + 左サイドバー + メインスロット のレイアウト
- `VolansLogo.tsx` — V字跳躍ライン + 星1つの SVG ロゴ
- `HeaderBar.tsx` — ヘッダー（ロゴ/プロジェクト名/ステッパー/アクション）
- `LeftNav.tsx` — 左サイドバー（折畳み対応）
- `StepIndicator.tsx` — 3ステップピル
- `SummaryCards.tsx` — 3カード（斜線/天空率/増加分）
- `ChecklistRow.tsx` — 主要チェック結果7項目
- `HalfGauge.tsx` — 半円(180°) SVG ゲージ（適合緑/以下赤）
- `SiteInfoCard.tsx` / `QuickActions.tsx` / `FooterNote.tsx`
- `MobileBottomNav.tsx` — モバイルボトムナビ
- `MobileHeader.tsx` — 戻る付きモバイルヘッダ

型は `src/components/volans/types.ts` に集約。

### 3.4 デモデータ
`src/lib/volans-demo.ts` に集約:
```ts
export const VOLANS_DEMO = {
  brand: { name: 'VOLANS', tagline: '最大ボリュームを、一瞬で。' },
  projectName: '新宿区西新宿3丁目計画',
  updatedAt: '2026/04/17 14:30',
  site: {
    address: '東京都新宿区西新宿3丁目',
    area: 1024.35,
    zoningName: '商業地域',
    coverageRatio: 80,
    floorAreaRatio: 600,
    road: { side: '北側', kind: '公道', width: 16.0 },
    heightDistrict: '第2種高度地区',
    fireDistrict: '防火地域',
  },
  summary: {
    slant: { floorArea: 5420.18, floors: 8, coverage: 31.2, farRatio: 91.2 },
    sky:   { floorArea: 6712.45, floors: 10, coverage: 37.5, farRatio: 100.0 },
    diff:  { floorArea: 1292.27, floors: 2, pct: 23.8 },
  },
  skyCheck: {
    type: '道路斜線(反対側境界)',
    index: 3, total: 12,
    value: 0.612, baseline: 0.586,
    margin: 0.026, marginPct: 2.6,
  },
  checks: [
    { label: '建ぺい率', ok: true },
    { label: '容積率', ok: true },
    { label: '道路斜線', ok: true, note: '(天空率)' },
    { label: '隣地斜線', ok: true, note: '(天空率)' },
    { label: '北側斜線', ok: true, note: '(天空率)' },
    { label: '日影規制', ok: true },
    { label: '絶対高さ', ok: true },
  ],
  patterns: [
    { id: 'slant', name: '斜線案（現行）', floorArea: 5420.18, floors: 8, farRatio: 91.2 },
    { id: 'sky',   name: '天空率案（推奨）', floorArea: 6712.45, floors: 10, farRatio: 100.0, recommended: true },
    { id: 'c',     name: 'パターンC（比較案）', floorArea: 6102.30, floors: 9, farRatio: 95.1 },
  ],
};
```
**数値・文言は正典からそのまま。改変禁止**。

### 3.5 3D 表示
PC `/sky` は既存 `<Viewer>` を流用。envelope の赤/緑点線は今回は3Dメッシュ側に細工せずカード内のオーバーレイ凡例のみでも OK（優先度低）。モバイル `/m/3d` も `<Viewer>` 流用。

### 3.6 ブランド置換ポリシー
- 「NANI AI Translator」「NANI」「天空率統合版」は**すべて** `VOLANS` + サブタイトル「最大ボリュームを、一瞬で。」に置換
- CSS 変数 `--nani-*` は `--volans-*` に統一
- ファイル名 `*nani*` は `*volans*` にリネーム
- ディレクトリ `volume-check` 自体は触らない（プロセスロックのため別タイミングでリネーム）

---

## 4. 禁止事項

- 正典の文言・数値・配色を勝手に変えない（`docs/ui-spec-volans.md` 8節）
- Lucide 単独禁止 / Inter 禁止 / 青→紫グラデ禁止（`ui-principles.md`）
- CSSギミック（無駄なアニメ・装飾）禁止
- 確認ダイアログ等で作業を止めない（Auto mode）

---

## 5. 完了条件

- [ ] `src/app/sky/page.tsx` が正典 PC 画像に視覚的に一致
- [ ] `/m` `/m/3d` `/m/input` `/m/compare` `/m/ai` `/m/report` の 6 ルートが存在
- [ ] 各モバイル画面が正典スマホ画像の各シーンに視覚的に一致
- [ ] ブランド表示: `VOLANS` と `最大ボリュームを、一瞬で。` が PC ヘッダとモバイルヘッダに存在
- [ ] `npm run build` 成功（`volume-check` ディレクトリで）
- [ ] `npm run lint` で新規ファイル由来のエラーなし（既存由来は許容）
- [ ] `npm run start -- -p 3000` で各ルート 200 OK
- [ ] フォント: Noto Sans JP で描画されている
- [ ] 数値「5,420.18 / 6,712.45 / +1,292.27 / 0.612 / 0.586」が画面に表示
- [ ] フッター注記「天空率計算は平成14年 国交省告示 第1350号に基づく方法で算定しています。」が PC 版最下部にある

---

## 6. 作業フロー推奨

1. `docs/ui-spec-volans.md` を熟読
2. 正典画像 2 枚を確認
3. `src/components/volans/` を作成し共通コンポーネントから実装（`VolansLogo` を先に）
4. `src/lib/volans-demo.ts` を作成
5. `src/app/sky/page.tsx` を書き換え
6. `src/app/m/layout.tsx` + 6 ページ
7. `npm run build` で確認
8. `npm run start` で目視確認（PC/モバイル両方）

---

## 7. 参考既存資産

- `src/components/three/Viewer.tsx` — 3D ビュア（流用）
- `src/components/mobile/BottomSheet.tsx` / `MobileStepper.tsx` — モバイル用既存
- `src/hooks/useVolumeCalculation.ts` — ボリューム計算フック
- `src/lib/demo-data.ts` — 既存デモデータ
- 既存 `/sky/page.tsx` — 今回の書き換え対象（参考として色味だけ拾える）

以上。`docs/ui-spec-volans.md` が憲法。画像と仕様書に忠実に。VOLANS で跳べ。
