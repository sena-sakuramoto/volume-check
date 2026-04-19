# SKY FACTOR UI 統合計画

## ゴール

`/project` で提供している volume-check の全機能を、`/sky` の SKY FACTOR 風 UI に統合する。
`/sky` が唯一のアプリ画面となり、`/project` は撤去（またはリダイレクト）する。

## 現状

| レイヤ | 既存 `/project` | 新 `/sky` |
|---|---|---|
| ヘッダー | ロゴ + デモボタン + β バッジ | プロジェクト名 / 計算種別 / バージョン / レポート出力 / 計算実行 / メニュー |
| ナビ | 3ステップ Stepper (1敷地 2法規 3結果) | 3セクション × 計10項目 |
| 中央 | Viewer + LayerPresetBar + HeroMetrics overlay | タブ (3D/平面/断面X/断面Y) + ツールバー + Viewer |
| 右 | なし (サイドバーに全部詰め込み) | サマリーカード4 / ヒートマップ / 集計表 |
| 下 | なし | 斜線条件表 |
| モバイル | 専用レイアウト + ボトムシート | 未対応 |

## コンポーネント対応表

| 新 `/sky` ナビ項目 | 既存コンポーネント | 備考 |
|---|---|---|
| 基本情報 | （新規） | プロジェクト名・住所・担当・備考。自動保存で管理 |
| 敷地・建物設定 | `AddressSearch` / `FileUpload` / `SiteEditor` / `RoadEditor` / `ParcelMap` | 既存の Step1 をそのまま使える |
| 斜線条件 | `ZoningEditor` | 既存 Step2 を再利用 |
| 計算条件 | （新規） | 階高一覧・壁面後退・日影条件トグルなど。現状は ResultsSection の `FloorTable` に散在 |
| 天空率計算 | （新規） | まだエンジン未実装。現状はモック値表示 |
| 結果確認 | `ResultsSection` + `HeroMetrics` + `FeasibilitySection` | 既存のまま移植 |
| ボリューム確認 | `Viewer` + `LayerPresetBar` | 中央の3Dタブと直結 |
| 比較検討 | `PatternComparison` | 既存のまま移植 |
| 計算書作成 | `PrintReport` | 印刷ルート `?print=1` で流用 |
| 図面出力 | （新規） | 平面図・断面図 SVG 書き出し |

## フェーズ設計

### Phase 1 ─ 状態の集約（1日）

- `/sky/page.tsx` から page-level state を抜き出して `useSkyState` フックへ
- `useVolumeCalculation` / `useShadow` / `useAutoSave` を組み込む
- 今のハードコード値（サマリー・集計表・斜線条件表）を `volumeResult` / `zoning` / `roads` から導出
- モデル情報ストリップ（敷地面積・建築面積・延床・階数）は実データに差し替え

**完了条件**: デモデータで `/sky` が `/project` と同じ VolumeResult を計算表示している。

### Phase 2 ─ ナビゲーションの実装（1日）

左ナビ選択で右ペイン / 下ペインの中身が切り替わるようにする。

- `activeNav` で `renderMainPanel()` / `renderRightPanel()` / `renderBottomPanel()` を分岐
- 初期タブ（基本情報・敷地・建物設定・斜線条件・計算条件）を実装:
  - 基本情報: 新規フォーム
  - 敷地・建物設定: 既存 `SiteSection` の中身を右 or 中央のドロワー化
  - 斜線条件: 既存 `ZoningSection` + 斜線条件表（現在下部に出ているもの）
  - 計算条件: `FloorTable` + 壁面後退 + 日影トグル

**完了条件**: 全ナビ項目で該当 UI が出て、入力→3Dビューが追従する。

### Phase 3 ─ 計算実行フロー（0.5日）

ヘッダーの「計算実行」ボタンを主導に。

- 現在は `useVolumeCalculation` が入力変更で自動再計算 → これを保つ
- 「計算実行」は明示的な再計算 + 成功トースト + サマリー右パネルへスクロール

**完了条件**: ボタン押下でサマリーが更新されて判定OK/NGが出る。

### Phase 4 ─ 結果ビュー統合（1日）

右ペインと「結果確認 / ボリューム確認 / 比較検討」ナビ。

- サマリーカード4 → 現状はモック。`VolumeResult` の `maxHeight` / `maxFloors` / `maxFloorArea` / `maxCoverageArea` などに差し替え
- ヒートマップ SVG → `shadowProjection` または簡易グリッド（将来 `reverseShadow` と連動）
- 集計表 → `ResultsSection` のテーブルに置き換え
- 比較検討 → `PatternComparison` を右ペインまたはモーダルに

**注**: 「天空率」は volume-check が今持っていない計算。まずは **体積率 / 日影率 / 斜線余裕** など既存指標で代替し、天空率は別タスクで新規エンジンを作る。

**完了条件**: サマリーの数値が VolumeResult から計算された本物になっている。

### Phase 5 ─ 出力（0.5日）

- 「レポート出力」ボタン → `PrintReport` を呼び出して PDF 化 (既存の print route 流用)
- 「図面出力」 → まずは 3DViewer のスクリーンショット PNG 保存
- 「計算書作成」→ `PrintReport` 拡張

**完了条件**: 1クリックで PDF/PNG がダウンロードされる。

### Phase 6 ─ 旧画面の撤去（0.5日）

- `/` のリダイレクト先を `/project` → `/sky` に変更（`src/proxy.ts` の `NextResponse.redirect`）
- `/project` のレイアウトと重複コンポーネントを削除、`/sky` を唯一のアプリ画面に
- `docs/` / `README.md` 更新

**完了条件**: 新入場者が迷わず `/sky` を触れる。Pages ビルドが pass。

### Phase 7 ─ モバイル対応（1日、後回し可）

- `/sky` の 3 カラム構造を、画面幅 < 900px でボトムシート + 単一カラムに
- 既存 `MobileStepper` 相当の簡易ナビを下に設置

## 技術判断

1. **状態管理**: 当面は page-level useState 集合でOK（既存の `/project` と同じスタイル）。規模が増えたら Zustand へ。
2. **天空率計算**: 画像のタイトルは "SKY FACTOR 天空率計算" だが、現 volume-check エンジンは天空率未実装。
   - 短期: UI上は「天空率」のラベルを残しつつ中身は `envelopeUtilization`（体積率）などのプロキシ指標
   - 中期: `src/engine/sky-factor.ts` を新規作成 → 令135条の22 に基づく算定
3. **ヒートマップデータソース**: Phase 4 までは `ShadowProjection` や `reverseShadow` のダミー。Phase 4 完了後に天空率グリッドに置換。
4. **ナビの非同期ローディング**: 敷地設定/斜線条件パネルは既存の大型コンポーネントなので、`next/dynamic` で遅延ロード。
5. **旧 `/project` の扱い**: 一時的に `/project` と `/sky` を並行稼働 → Phase 6 で削除。

## リスク

| リスク | 対策 |
|---|---|
| 既存 `SiteSection` が Step フローに最適化されている | まず props を組み直さず、新シェル内に埋め込むだけ。ツリー構造は触らない |
| 天空率エンジン未実装なのに UI で「OK/NG」出している | ダミーであることが見えるラベル（「参考値」）を追加しつつ進める |
| GitHub Pages は静的。`/project` の API 依存は build時に外す | 既に `scripts/build-pages.mjs` で対応済み |
| Mapbox / Gemini が静的版で動かない | Pages 版では AddressSearch を簡易版（都道府県→市区→町名）にフォールバック |

## 作業順（推奨）

1. **今セッション**: Phase 1（状態集約）を Codex に投げる指示書を作成
2. **次セッション**: Phase 2-3 を Codex に投げる
3. **その次**: Phase 4（結果統合）
4. **最終**: Phase 5-6

## CODEX 指示書の粒度

- `CODEX_SKY_PHASE1.md`: 状態集約 + サマリー/斜線条件表の実データ化
- `CODEX_SKY_PHASE2.md`: ナビゲーション分岐 + 敷地/斜線パネル組込
- `CODEX_SKY_PHASE3.md`: 計算実行ボタン
- `CODEX_SKY_PHASE4.md`: 結果ビュー + 比較検討
- `CODEX_SKY_PHASE5.md`: 出力系
- `CODEX_SKY_PHASE6.md`: 旧画面撤去
- `CODEX_SKY_SKY_FACTOR_ENGINE.md`: 天空率エンジン新規（別トラック）

各指示書には完了条件（テスト PASS、ビルド成功、`/sky` で該当フローが動く）を明記する。
