# `scripts/mojmap` — 法務省 登記所備付地図 PMTiles パイプライン (Phase 1)

## 何をするか

G空間情報センター CKAN から 登記所備付地図 XML (JIS X 7307) を取得し、
`mojxml-rs` で GeoJSON NDJSON に変換、`tippecanoe` で PMTiles にまとめて
Cloud Storage にアトミックに公開する差分ビルド・パイプライン。

`volans-web` の `/api/parcel-lookup` は GCS 上の `current.txt` を 10 分
キャッシュで引き、そこに書かれた PMTiles オブジェクトキーを読んで
クライアントを初期化する。

## 一発実行

前提:
- Node 20 + pnpm 10
- `mojxml-rs` と `tippecanoe` が PATH 上にある
  （Dockerfile 経由で Cloud Run Job 実行するなら自動で入る）
- `gcloud auth application-default login` で GCS 認証済

```bash
cd scripts/mojmap
pnpm install

# 差分ビルド（CKAN の metadata_modified が新しいデータだけ取り込む）
pnpm run daily

# フル再構築（manifest を無視して全件再取得）
pnpm run full

# 事前チェック — Phase 1 対象コード全部が CRS zone にマッピングできるか
pnpm run verify-crs
```

## 主要環境変数

| Name | Default | Purpose |
|---|---|---|
| `MOJMAP_BUCKET` | `volans-web-parcel-data` | GCS バケット名 |
| `MOJMAP_KEY_PREFIX` | `moj` | バケット内プレフィックス |
| `MOJMAP_WORKDIR` | `./out` | ローカル一時ディレクトリ |
| `MOJMAP_CKAN_BASE` | `https://www.geospatial.jp/ckan/api/3` | CKAN API |
| `MOJMAP_DOWNLOAD_CONCURRENCY` | `16` | 並列DL数 |
| `MOJMAP_HTTP_TIMEOUT_MS` | `60000` | HTTPタイムアウト |
| `MOJMAP_MOJXML_BIN` | `mojxml-rs` | パーサ実体 |
| `MOJMAP_TIPPECANOE_BIN` | `tippecanoe` | tippecanoe 実体 |
| `MOJMAP_DRY_RUN` | `false` | `true` にすると GCS 書き込みをスキップ |
| `MOJMAP_PMTILES_RETENTION` | `2` | 保持する旧版 PMTiles 数 |
| `MOJMAP_TIPPECANOE_MIN_ZOOM` | `13` | |
| `MOJMAP_TIPPECANOE_MAX_ZOOM` | `18` | |
| `MOJMAP_LOG_LEVEL` | `info` | `debug`/`info`/`warn`/`error` |

## GCS レイアウト

```
gs://volans-web-parcel-data/
└── moj/
    ├── current.txt                    # "moj/mojmap-YYYYMMDD-HHMMSS.pmtiles"
    ├── mojmap.pmtiles                 # 最新の alias（運用観察用）
    ├── mojmap-20260421-030512.pmtiles # 本体（世代付き）
    ├── mojmap-20260420-030045.pmtiles # 1世代前
    ├── geojson/
    │   └── {datasetId}.ndjson.gz      # CKAN dataset 単位のキャッシュ
    └── _state/
        └── manifest.json              # 取り込み状態（sha256 + ckanModified）
```

`current.txt` はランタイム API の信頼源。アトミックに書き換わるので、
PMTiles アップロード中に API が古いバージョンを引き続けることもない。

## Cloud Run Job + Scheduler

`docs/mojmap-pipeline.md` を参照。日次 (`0 3 * * *` JST) で `daily` が走り、
月1 (`0 2 1 * *` JST) で `full` が走る想定。

## トラブルシューティング

- **CKAN `package_search` が空**: G空間 側のインデックスが遅延している可能性。
  数時間後にリトライするか、`MOJMAP_CKAN_BASE` を直接確認
- **`mojxml-rs` が未対応バージョンの XML で落ちる**: 該当 dataset は
  `manifest.datasets.*.failureStreak` に積まれる。ログから失敗 dataset を
  特定し、mojxml-rs 側に issue を上げるか、手動で一時除外する
- **proj4 / CRS 関連の不整合**: `pnpm run verify-crs` で Phase 1 全コードの
  zone を一覧。北海道や沖縄は複数 zone にまたがるので `crs_map.json` の
  `byMunicipality` で上書き
- **tippecanoe の容量爆発**: Phase 1 で 5GB 超えるのは正常でない。
  `MOJMAP_TIPPECANOE_MIN_ZOOM` を引き上げるか、`--drop-densest-as-needed`
  の採用数を再検討

## Phase 2（全国）への拡張

`phase1_municipalities.json` を `all_municipalities.json` に差し替えるだけ
ではなく、`crs_map.json.byMunicipality` を網羅必須。PMTiles 容量が 5GB を
超えたら地方ブロックに分割する必要があり、API 側の `current.txt` を
BBox→オブジェクト対応表に差し替える拡張が必要になる。別指示書
`CODEX_VOLANS_MOJMAP_PHASE2.md` で扱う。
