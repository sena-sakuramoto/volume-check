# MOJ-MAP パイプライン運用ドキュメント

本書は VOLANS が利用する法務省 登記所備付地図 (MOJ) データの
取得・変換・公開パイプラインの運用マニュアル。

- 実装: `scripts/mojmap/`（Node 20 + TypeScript、mojxml-rs + tippecanoe）
- 指示書の正典: `CODEX_VOLANS_MOJMAP.md`
- ランタイム側利用箇所: `src/app/api/parcel-lookup/route.ts`、
  `src/stores/useVolansStore.ts`、`src/components/volans/SiteSourceBadge.tsx`

## 1. 全体像

```
+-------------+   +----------+   +-----------+   +--------+   +----------+   +-------+
|  G空間 CKAN | → | mojxml-rs | → | tippecanoe | → | GCS    | → |  volans  | → |  UI   |
|  (XML ZIP)  |   |  (GeoJSON)|   |  (PMTiles) |   |  bucket|   |   /api   |   | badge |
+-------------+   +----------+   +-----------+   +--------+   +----------+   +-------+
       │               │               │              │              │            │
       └── daily diff (metadata_modified) + sha256 照合 ──┘              │            │
                                                                       │            │
                                                         current.txt 経由の原子切替    │
                                                                                    │
                                                              'moj' siteSource → 📜   ┘
```

## 2. パイプライン実行モード

| モード | コマンド | 用途 | 頻度 |
|---|---|---|---|
| daily | `pnpm --prefix scripts/mojmap run daily` | CKAN 差分のみ取り込み | 毎日 JST 03:00 |
| full | `pnpm --prefix scripts/mojmap run full` | 全件再取得・再構築 | 月1 JST 02:00 |
| verify-crs | `pnpm --prefix scripts/mojmap run verify-crs` | Phase 1 対象コードの CRS 解決チェック | 設定変更時 |

`daily` は `metadata_modified` が進んだ dataset のみ DL → パース →
GeoJSON.gz 差し替え → PMTiles 全体再生成 → `current.txt` 更新 → manifest 更新。

`full` は manifest を空から出発し、Phase 1 全件を取り込み直す保険 Job。

## 3. 原子切替の仕組み

- PMTiles は `moj/mojmap-YYYYMMDD-HHMMSS.pmtiles`（世代キー）に put
- `moj/current.txt` が「現行オブジェクトキー」を 1 行で保持（数十バイト、単一PUT原子）
- ランタイム API は `current.txt` を 10 分 TTL キャッシュ → ランタイム再起動なしに新版へ切り替わる
- 旧版は `MOJMAP_PMTILES_RETENTION`（既定 2）世代まで GCS に残し、
  それ以前を publish 完了後に GC

PMTiles アップロード中に API 側が古い世代を引き続ける窓は 10 分。
部分読み込みリスクは世代キー分離により原理的に発生しない（PMTiles
ライブラリは range GET で読むが、同じオブジェクトキー内は常に一貫）。

## 4. Cloud Run Job 登録

Artifact Registry に Dockerfile をビルド・プッシュ:

```bash
# 事前に一度だけ: Cloud Storage バケット作成
gsutil mb -l asia-northeast1 gs://volans-web-parcel-data
gsutil iam ch allUsers:objectViewer gs://volans-web-parcel-data   # Public GET

# 事前に一度だけ: サービスアカウント + IAM
gcloud iam service-accounts create volans-mojmap \
  --display-name "VOLANS MOJMAP builder"
gcloud projects add-iam-policy-binding volans-web \
  --member="serviceAccount:volans-mojmap@volans-web.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# ビルド & プッシュ
gcloud builds submit scripts/mojmap \
  --tag="asia-northeast1-docker.pkg.dev/volans-web/volans/mojmap-builder:latest" \
  --project=volans-web

# Cloud Run Jobs 登録
gcloud run jobs create volans-mojmap-daily \
  --image="asia-northeast1-docker.pkg.dev/volans-web/volans/mojmap-builder:latest" \
  --region=asia-northeast1 --task-timeout=3600 --memory=8Gi --cpu=4 \
  --service-account="volans-mojmap@volans-web.iam.gserviceaccount.com" \
  --set-env-vars=MOJMAP_BUCKET=volans-web-parcel-data

gcloud run jobs create volans-mojmap-full \
  --image="asia-northeast1-docker.pkg.dev/volans-web/volans/mojmap-builder:latest" \
  --region=asia-northeast1 --task-timeout=14400 --memory=8Gi --cpu=4 \
  --service-account="volans-mojmap@volans-web.iam.gserviceaccount.com" \
  --command="pnpm" --args="run,full" \
  --set-env-vars=MOJMAP_BUCKET=volans-web-parcel-data
```

Scheduler:

```bash
# 別途 Scheduler 用サービスアカウント
gcloud iam service-accounts create volans-scheduler \
  --display-name "VOLANS Scheduler"
gcloud projects add-iam-policy-binding volans-web \
  --member="serviceAccount:volans-scheduler@volans-web.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

gcloud scheduler jobs create http volans-mojmap-daily \
  --location=asia-northeast1 \
  --schedule="0 3 * * *" --time-zone="Asia/Tokyo" \
  --http-method=POST \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/volans-web/jobs/volans-mojmap-daily:run" \
  --oauth-service-account-email="volans-scheduler@volans-web.iam.gserviceaccount.com"

gcloud scheduler jobs create http volans-mojmap-monthly-full \
  --location=asia-northeast1 \
  --schedule="0 2 1 * *" --time-zone="Asia/Tokyo" \
  --http-method=POST \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/volans-web/jobs/volans-mojmap-full:run" \
  --oauth-service-account-email="volans-scheduler@volans-web.iam.gserviceaccount.com"
```

## 5. 失敗時リカバリ

| 症状 | 対処 |
|---|---|
| 特定 dataset が連続失敗 | `manifest.json.datasets.*.failureStreak` と `lastError` を確認。mojxml-rs が落ちているなら該当 XML を手元で再現し、必要なら mojxml-rs に issue |
| `current.txt` が消えた/壊れた | `gsutil cat gs://volans-web-parcel-data/moj/current.txt` で確認し、必要なら直近 PMTiles オブジェクトキーを書き戻す: `echo 'moj/mojmap-YYYYMMDD-HHMMSS.pmtiles' \| gsutil cp - gs://volans-web-parcel-data/moj/current.txt` |
| PMTiles が空/壊れている | `full` Job を手動実行: `gcloud run jobs execute volans-mojmap-full --region=asia-northeast1 --wait` |
| ランタイム API が AMX に落ちっぱなし | `current.txt` を fetch してオブジェクトキーが正しく `moj/` プレフィックスか確認。間違っていれば `getMojPmtiles()` が null を返して AMX にフォールバックする挙動なのでログに注目 |
| CRS 不一致で敷地が海上に描画 | `scripts/mojmap/crs_map.json` の `byMunicipality` にオーバーライドを追加。`verify-crs` で sanity check |

## 6. 局所検証（エンドツーエンドを待たない）

dry-run モードで GCS 書き込みを全部スキップしながらパイプラインのロジックだけ検証:

```bash
MOJMAP_DRY_RUN=true MOJMAP_DOWNLOAD_CONCURRENCY=2 pnpm --prefix scripts/mojmap run daily
```

個別ステップ:

- `pnpm --prefix scripts/mojmap run verify-crs`
- `pnpm --prefix scripts/mojmap run typecheck`
- `pnpm test --runTestsByPath __tests__/mojmap/*.test.ts`（ユニットテスト）

## 7. Phase 2 への拡張ポイント

1. `phase1_municipalities.json` → `all_municipalities.json` に差し替え
2. `crs_map.json.byMunicipality` を全市区町村分に拡張（特に北海道 11/12/13 系、沖縄 15-19 系）
3. PMTiles を地方ブロック分割し、`current.txt` を BBox→オブジェクト対応表
   （例: `index.json`）に差し替える
4. Cloud Run Job のメモリを 16Gi、タイムアウトを 6h に増強
5. ランタイム API `/api/parcel-lookup` の PMTiles 初期化部を BBox 判定付きに拡張

上記の拡張は別指示書 `CODEX_VOLANS_MOJMAP_PHASE2.md` で扱う。
Phase 1 が安定稼働するまで着手しない。
