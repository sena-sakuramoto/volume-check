# VolumeCheck - 建築ボリュームチェック

住所入力だけで法規制を自動取得し、最大建築可能ボリュームを3Dで表示するWebアプリケーションです。

## 機能一覧

- 住所入力による用途地域・法規制の自動取得
- 道路斜線・隣地斜線・北側斜線・絶対高さ制限の自動計算
- 最大建築可能ボリュームの3D表示
- 建ぺい率・容積率・最大延べ面積・最大階数の算出
- 階高エディタによるフロアごとの高さ調整
- レイヤー表示切替（道路斜線/隣地斜線/北側斜線/絶対高さ）
- プロジェクトの保存・読み込み（JSON形式）
- PDF出力（ブラウザ印刷機能）
- AI Quick Action（計算結果の解説・法規要約、Gemini API / ローカル回答）
- デスクトップ・モバイル対応レスポンシブUI

## セットアップ

```bash
# 依存パッケージのインストール
pnpm install

# 開発サーバーの起動
pnpm dev

# ビルド
pnpm build

# テスト
pnpm test

# Lint
pnpm lint
```

## 環境変数

`.env.example` を `.env.local` にコピーして設定してください。

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `GEMINI_API_KEY` | 任意 | Google Gemini APIキー（図面AI解析に必要。未設定でもボリュームチェック機能は利用可能） |
| `PARCEL_SHAPE_API_URL` | 任意 | 住所/座標から敷地ポリゴンを返す外部APIエンドポイント（未設定時は敷地形状自動取得をスキップ） |
| `PARCEL_SHAPE_API_KEY` | 任意 | 敷地形状APIの認証キー（`X-API-Key` ヘッダーで送信） |

## 技術スタック

- **フレームワーク:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4, shadcn/ui (Radix UI)
- **アイコン:** Lucide + Phosphor Icons（混在使用）
- **フォント:** Space Grotesk (Display) + Noto Sans JP (Body) + JetBrains Mono (Mono)
- **3D描画:** Three.js, @react-three/fiber, @react-three/drei
- **CSG演算:** three-bvh-csg, three-mesh-bvh
- **AI:** Google Gemini API (@google/genai)
- **テスト:** Jest, ts-jest
- **言語:** TypeScript 5

## プロジェクト構成

```
src/
├── app/          # Next.js App Router ページ・APIルート
├── components/   # UIコンポーネント・3Dシーン・チャット
├── engine/       # 建築計算エンジン（斜線制限・容積率等）
└── lib/          # ユーティリティ（Gemini連携・デモデータ等）
```

## 免責事項

本アプリケーションは建築ボリュームの概算ツールであり、法的な確認書類を生成するものではありません。実際の建築計画には、所管の行政機関への確認および建築士による法適合確認が必要です。計算結果は入力データの精度に依存し、特定建築物や地区計画等の個別規制は考慮されていない場合があります。
