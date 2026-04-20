# VOLANS — 最大ボリュームを、一瞬で。

VOLANS（ヴォランス、とびうお座）は **斜線制限** と **天空率緩和（建基法56条7項）** を自動で並置比較し、敷地から実際に建てられる **最大延床 / 階数** を一瞬で提示する建築ボリューム AI ツールです。

> 旧称 VolumeCheck。2026-04-17 に VOLANS へリブランド。

## 主な機能

- 住所入力による **用途地域 / 建ぺい率 / 容積率 / 前面道路幅員** の自動取得（PLATEAU URF / Mapbox 連携）
- 道路斜線 / 隣地斜線 / 北側斜線 / 絶対高さ / 日影 / 高度地区の自動判定
- **斜線限界と天空率緩和の並置比較**（最大延床・階数・充足率）
- **天空率チェック（代表点）**：半円ゲージ、測定点送り、告示1350号ベースの ray-trace 実装
- DXF / OCR から敷地境界取込
- 3D ビュア + OSM 周辺ビル + PLATEAU 3D タイル + 太陽マーク
- プロジェクトのローカル保存 / Firebase クラウド同期（任意）
- 共有リンク（URL ハッシュ経由で敷地設定を別タブに転送）
- PDF レポート出力 / PWA モバイル 6 シーン (`/m` 以下)

## ページ

| ルート | 対象 | 内容 |
|---|---|---|
| `/` | ランディング | サービス紹介 + CTA |
| `/sky` | **デスクトップ (≥1024px)** | 3D + 解析結果サマリー + 右パネル。狭い画面は自動で `/m` にリダイレクト。 |
| `/m` | モバイル | ダッシュボード（サマリー / 天空率 / 3D プレビュー / クイックアクション） |
| `/m/3d` | モバイル | 3D フル表示 + ボリューム比較 |
| `/m/input` | モバイル | 敷地・法規・条件入力（DXF/OCR 境界取込含む） |
| `/m/compare` | モバイル | 斜線案 / 天空率案 / 比較パターンのカード一覧 + グラフ |
| `/m/ai` | モバイル | AI アシスタント（Gemini 連携） |
| `/m/report` | モバイル | PDF レポートプレビュー + 共有 |
| `/api/health` | サーバ | liveness 用 JSON |

## セットアップ

```bash
pnpm install      # 依存インストール
pnpm dev          # 開発サーバ（Turbopack）
pnpm build        # 本番ビルド
pnpm test         # Jest 402 本
pnpm lint         # ESLint (0 errors / 0 warnings)
pnpm exec playwright test   # e2e（要: 事前に `pnpm start` でサーバ起動）
```

## 環境変数

`.env.example` を `.env.local` にコピー。VOLANS 用 Firebase プロジェクトは `volans-web`（`.env.production` に commit 済み）。

| 変数名 | 必須 | 説明 |
|---|---|---|
| `GEMINI_API_KEY` | 推奨 | Gemini API キー（AI アシスタントと図面 AI に必要。`/api/ai/chat` 経由） |
| `NEXT_PUBLIC_FIREBASE_*` × 4 | 任意 | 未設定でも動作（ローカル保存のみ）。設定すると ヘッダに サインイン UI + Firestore 同期が有効化 |
| `PARCEL_SHAPE_API_URL` / `_KEY` | 任意 | 敷地ポリゴン取得 API（未設定時は PMTiles 農研機構 フォールバック） |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | 任意 | Mapbox 地図タイル |

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind 4
- **アイコン**: Lucide + Phosphor Icons 併用（Lucide 単独は禁止 per `docs/ui-principles.md`）
- **フォント**: Noto Sans JP + JetBrains Mono
- **3D**: Three.js / @react-three/fiber / @react-three/drei + three-bvh-csg
- **天空率エンジン**: 自前 ray-trace（`src/engine/sky-factor/`）+ Web Worker
- **状態管理**: Zustand（persist middleware でプロジェクト永続化）
- **AI**: Google Gemini API (`@google/genai`)
- **地図**: MapLibre GL / PMTiles / PLATEAU URF
- **テスト**: Jest + Playwright (chromium + Pixel 7)

## デプロイ

- **本番**: Cloud Run（`asia-northeast1`）— `./scripts/deploy-volans.sh volans-web`
- **プレビュー**: GitHub Pages（静的、`build:pages` 経由）
- 手順詳細 → `docs/DEPLOY.md`

## ディレクトリ

```
src/
├── app/                # Next.js App Router ページ / API ルート
│   ├── api/            # /api/geocode, /api/ai/chat, /api/health …
│   ├── m/              # モバイル 6 シーン
│   └── sky/            # デスクトップ解析画面
├── components/
│   ├── volans/         # VOLANS UI（HeaderBar / SummaryCards / HalfGauge …）
│   ├── three/          # 3D レイヤー（Viewer, OsmBuildings, PlateauTiles …）
│   └── site/           # 敷地関連（ParcelMap）
├── engine/
│   ├── sky-factor/     # 天空率 ray-trace + optimize + worker
│   └── ...             # 斜線制限・容積・日影等のコアエンジン
├── hooks/              # useAuth / useCloudProjects / useSkyAnalysis 等
├── lib/                # share-link / firestore / dxf-parse / volans-demo …
└── stores/             # Zustand (useVolansStore / useProjectsStore / useHistoryStore)
```

## 免責事項

本アプリケーションは建築ボリュームの概算ツールであり、法的な確認書類を生成するものではありません。**実際の建築計画には、所管の行政機関への確認および建築士による法適合確認が必要です。** 計算結果は入力データの精度に依存し、特定建築物や地区計画等の個別規制は考慮されていない場合があります。天空率計算は平成14年 国交省告示 第1350号に基づく方法で算定していますが、実案件での最終判定は専門家による検証を必須とします。

## Links

- 仕様書（正典）: `docs/ui-spec-volans.md`
- 実装ブリーフ: `CODEX_VOLANS_UI.md`
- デプロイ手順: `docs/DEPLOY.md`
