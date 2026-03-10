# VolumeCheck 引き継ぎメモ（LATEST）

更新日時: 2026-03-06T11:51:23+09:00  
ブランチ: `master`  
HEAD: `a115d78`

## 1. 現在の稼働状態
- サーバー起動中: `next-server` on `*:3000`
- 接続URL（Windowsブラウザ）: `http://172.28.252.145:3000/project`
- WSL内ループバックで確認する場合: `http://127.0.0.1:3000/project`

## 2. 今セッションで確定したこと
- UIテーマを実務向けにライト基調へ変更（黒背景依存を解消）。
  - `src/app/globals.css`
  - `src/components/three/Viewer.tsx`
  - `src/app/project/page.tsx`
  - `src/components/site/AddressSearch.tsx`
- 500エラー（`/_next/static/chunks/*.css|*.js`）の根本原因を特定。
  - 原因: 古い `next-server` が古いHTML/chunk参照を返していた。
  - 対応: 旧プロセス停止→`3000`再起動で解消。
- `/project` は `cache-control: no-store` で配信中（middleware側）。

## 2.5 UI/UX原則（今後の判断基準）
- **手に馴染むソフトウェアは「雑に使える」ことを優先する。**
- 操作中に「これでいいよな……？」と不安にさせる UI は避ける。
- ミスしてもすぐ戻せる、やり直せる、壊しにくい導線を優先する。
- 多少てきとうに触っても、目的に辿りつける設計を優先する。

実装時の具体基準:
- 1回の操作で取り返しがつかない状態を作らない。
- 状態確定の前にプレビュー・候補・確認ステップを挟む。
- 自動推定は「候補」として出し、手修正しやすくする。
- 入力は厳格さより復元しやすさを優先し、後から直せるようにする。
- 迷うUIより、雑に触っても前進するUIを優先する。

## 3. 既知の重要事項（実務運用）
- **WSL環境では `localhost:3000` がWindowsブラウザで不達になることがある。**
  - その場合は `http://172.28.252.145:3000/project` を使用。
- **chunk 500 が再発したら、古いnext-server混在が最優先疑い。**
- フォントの preload warning（`...woff2 was preloaded but not used...`）は非致命。

## 4. 再発時の即復旧コマンド
```bash
cd /mnt/d/senaa_dev/volume-check
ss -lptn | rg ':3000|:3100' -n -S
pkill -f "next-server" || true
npm run build
npm run start -- -p 3000
```

起動後の確認:
```bash
curl -I http://127.0.0.1:3000/project
curl -I http://127.0.0.1:3000/_next/static/chunks/0fcbb62f9bbe620c.css
```

## 5. 次回開始チェックリスト
1. `docs/handover/VOLUMECHECK_MASTER_HANDOVER.md` を最初に読む。
2. `3000` でサーバーが1プロセスのみか確認。
3. Windows側は `172.28.252.145:3000` で開く。
4. 表示崩れがあればハードリロード（`Ctrl+Shift+R`）。
5. 住所検索→候補敷地選択→道路・用途・斜線表示まで実操作で確認。

## 6. テスト/ビルド状況（最新）
- `npm run build`: 成功
- `npm run lint`: 失敗（既存由来）
  - 主: `@typescript-eslint/no-explicit-any`（API test群）
  - 主: `react-hooks/set-state-in-effect`（`src/app/project/page.tsx`）
  - ※今回テーマ変更とは無関係の既存課題

## 7. Gitワークツリー現状（スナップショット）
```text
 M .claude/settings.local.json
 M CODEX_FEASIBILITY.md
 M CODEX_PARCEL_AUTO.md
 M CODEX_PLATEAU_URF.md
 M docs/plans/2026-03-02-production-readiness-design.md
 M src/app/api/analyze-site/route.ts
 M src/app/api/geocode/route.ts
 M src/app/api/parcel-lookup/route.ts
 M src/app/api/plateau-urf-lookup/route.ts
 M src/app/api/site-shape-lookup/route.ts
 M src/app/api/zoning-lookup/route.ts
 M src/app/globals.css
 M src/app/project/page.tsx
 M src/components/results/FeasibilitySection.tsx
 M src/components/sidebar/SiteSection.tsx
 M src/components/site/AddressSearch.tsx
 M src/components/site/FileUpload.tsx
 M src/components/site/RoadEditor.tsx
 M src/components/site/__tests__/site-helpers.test.ts
 M src/components/site/site-helpers.ts
 M src/components/site/site-types.ts
 M src/components/three/EnvelopeMesh.tsx
 M src/components/three/SetbackLayer.tsx
 M src/components/three/Viewer.tsx
 M src/engine/__tests__/building-pattern.test.ts
 M src/engine/__tests__/envelope.test.ts
 M src/engine/__tests__/feasibility.test.ts
 M src/engine/building-pattern.ts
 M src/engine/envelope.ts
 M src/engine/feasibility.ts
 M src/lib/mvt-utils.ts
 M src/stores/useViewerStore.ts
?? src/app/api/analyze-site/__tests__/
?? src/app/api/geocode/__tests__/
?? src/app/api/parcel-lookup/__tests__/
?? src/app/api/road-lookup/
?? src/app/api/site-shape-lookup/__tests__/
?? src/app/api/zoning-lookup/__tests__/
?? src/components/site/__tests__/address-search-helpers.test.ts
?? src/components/site/__tests__/file-upload-helpers.test.ts
?? src/components/site/address-search-helpers.ts
?? src/components/site/file-upload-helpers.ts
?? src/lib/__tests__/coordinate-parser.test.ts
?? src/lib/__tests__/road-inference.test.ts
?? src/lib/__tests__/zoning-aggregation.test.ts
?? src/lib/coordinate-parser.ts
?? src/lib/road-inference.ts
?? src/lib/zoning-aggregation.ts
?? src/middleware.ts
?? src/stores/__tests__/
?? "スクリーンショット 2026-03-05 000317.png"
?? "スクリーンショット 2026-03-05 000348.png"
```

## 8. 引き継ぎSkill
- Skill名: `session-handover`
- 配置: `/home/senaa/.codex/skills/session-handover/SKILL.md`
- 使用コマンド:
```bash
~/.codex/superpowers/.codex/superpowers-codex use-skill session-handover
```

## 9. ショートカット
- コマンド: `/home/senaa/.local/bin/vc`（PATHに入っているため `vc` で実行可）
- 主要サブコマンド:
```bash
vc p1        # masterでParcel用Codex起動
vc p2        # feat/plateau-urf worktreeで起動（未作成なら自動作成）
vc p3        # feat/feasibility worktreeで起動（未作成なら自動作成）
vc handover  # session-handover skillを読み込み
vc snapshot  # 引き継ぎ用スナップショット採取
vc url       # 現在のWSLアクセスURLを表示
vc memo      # canonical handover memoのパスを表示
```
