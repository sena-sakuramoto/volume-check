# CODEX_VOLANS_MOJMAP — 法務省登記所備付地図 (MOJ-MAP) 統合 Phase 1

**優先度**: 高 / **担当**: Codex / **作業ディレクトリ**: `D:\senaa_dev\volume-check`
**対象**: Phase 1（東京23区 + 主要政令市、約100市区町村）

---

## 0. 背景（なぜこれをやるか）

`/m/input` 住所検索の敷地取得パイプラインは現状：

```
住所 → /api/geocode → /api/zoning-lookup → /api/parcel-lookup (AMX) → [fallback] /api/nearby-buildings (OSM) → /api/road-lookup
```

弱点: **都心ビル街で AMX PMTiles (農研機構・農地主体) がスカスカ**。OSM 建物外形 fallback は法的根拠なしで「建物外形 ≠ 敷地」。
ユーザーからの指摘: **「住所からで切るほかにないの」**。

**解**: 法務省の登記所備付地図 XML（G空間情報センター配布、JIS X 7307、無料・商用可、**法的根拠あり**）を PMTiles 化して AMX より先に引く。
2026-04-15 時点で G空間 CKAN に 6,094 件（市区町村×大字単位）あり継続更新中。

本指示書は **Phase 1 = 東京23区 + 主要政令市（約100市区町村）** に限定した実装。Phase 2 全国は別指示書で後続対応。

---

## 1. 成果物

1. **前処理パイプライン一式** (`scripts/mojmap/`)
   - Phase 1 対象市区町村リスト
   - CKAN API で最新 ZIP URL を取得
   - ZIP → XML → GeoJSON → tippecanoe → PMTiles
   - GCS (`gs://volans-web-parcel-data/moj/mojmap.pmtiles`) に upload
2. **ランタイム統合**
   - `src/app/api/parcel-lookup/route.ts` に MOJ PMTiles を AMX の前にチェックするロジック
   - 結果 feature に `properties.source = 'moj' | 'amx'` を付与
3. **フロントエンド**
   - `src/stores/useVolansStore.ts` の `siteSource` union に `'moj'` 追加
   - `SiteSourceBadge.tsx` に MOJ メタ追加（緑・最高信頼度・📜 アイコン・「登記所備付地図（法務省）— 法的根拠あり」）
   - `fetchFromAddress` で parcel 結果の source を見て `siteSource` を `'moj'` or `'parcel'` に分岐
4. **月次更新運用**
   - Cloud Run Job (`volans-mojmap-refresh`) + Cloud Scheduler (`0 3 1 * *` JST)
5. **ドキュメント**
   - `docs/mojmap-pipeline.md`（手順・リカバリ・Phase 2 への拡張メモ）

---

## 2. 正典（絶対参照）

| 項目 | パス / URL |
|---|---|
| G空間 CKAN | https://www.geospatial.jp/ckan/api/3/action/package_search?q=登記所備付地図 |
| JIS X 7307 仕様 | https://www.jisc.go.jp/app/jis/general/GnrJISNumberNameSearchList?toGnrJISStandardDetailList （「X 7307」で検索） |
| 既存パーサ (Python OSS) | https://github.com/amx-project/jismap2geojson 等から動くものを選定 |
| tippecanoe | https://github.com/felt/tippecanoe |
| GCS バケット | `gs://volans-web-parcel-data`（MOJ Phase 1 向けに新設、Public GET） |

**重要**: JIS X 7307 パーサは OSS を必ず検証してから採用。自作する場合は `scripts/mojmap/parser/` にユニットテスト付きで実装。座標系は公共測量座標系（JGD2011 平面直角 1〜19 系）→ WGS84 (EPSG:4326) への変換必須。`proj4` で実装。

---

## 3. Phase 1 対象市区町村（約100）

`scripts/mojmap/phase1_municipalities.json` に確定リストを置く。最低限以下を含む（実装時にコードで一覧生成してもよい）：

- 東京都: 23区 + 武蔵野市 + 三鷹市 + 調布市 + 府中市 + 町田市 + 立川市 (計30)
- 政令市: 札幌 / 仙台 / さいたま / 千葉 / 横浜 / 川崎 / 相模原 / 新潟 / 静岡 / 浜松 / 名古屋 / 京都 / 大阪 / 堺 / 神戸 / 岡山 / 広島 / 北九州 / 福岡 / 熊本 (計20政令市の行政区合計で約70市区)

合計で **90-110** 市区町村を目安。CKAN には同一市区町村内で複数大字ZIP が分割されているので、実際のZIP数は 500-2000 件規模になる見込み。

---

## 4. 実装ステップ

### Step 1: 前処理パイプライン (`scripts/mojmap/`)

**設計方針**: 差分ビルド前提。GeoJSON キャッシュと `manifest.json` で「どの dataset を最後にいつ取り込んだか」を状態管理し、CKAN の `metadata_modified` が新しいものだけ再取得する。PMTiles は変更があれば全件マージで再生成（tippecanoe は incremental に作れないため）。

ディレクトリ構成:
```
scripts/mojmap/
  phase1_municipalities.json   # 対象市区町村コード（JIS X 0401/0402 5桁コード）リスト
  src/
    1_fetch_ckan.ts            # CKAN API → 対象 dataset 一覧 + metadata_modified を out/ckan_index.json
    2_diff_plan.ts             # ckan_index.json と GCS 上の manifest.json を突合、更新対象のみ out/to_update.json
    3_download.ts              # to_update.json の ZIP を parallel DL (同時16、指数バックオフ、Content-Length 検証、SHA256)
    4_xml_to_geojson.ts        # JIS X 7307 → NDJSON (proj4 で JGD2011平面直角→WGS84、系番号は市区町村コードから解決)
    5_upload_geojson.ts        # 生成 NDJSON.gz を gs://.../moj/geojson/{datasetId}.ndjson.gz に put
    6_build_pmtiles.ts         # GCS 上の全 NDJSON.gz を DL → tippecanoe → out/mojmap.pmtiles
    7_publish.ts               # pmtiles を gs://.../moj/mojmap-YYYYMMDD.pmtiles に put → current.txt を更新 → mojmap.pmtiles にも alias コピー
    8_update_manifest.ts       # 処理済 dataset の ckan_modified と sha256 を manifest.json に書き戻し
  parser/                      # JIS X 7307 パーサ（OSS が使えない場合の自作、ユニットテスト必須）
  Dockerfile                   # Cloud Run Job 用（tippecanoe, proj, node 入り）
  package.json                 # pnpm run mojmap:daily / mojmap:full
  README.md                    # 実行手順・リカバリ・座標系マップ
```

**状態保存 (manifest.json)**:
```
gs://volans-web-parcel-data/moj/_state/manifest.json
{
  "schema": 1,
  "phase": 1,
  "last_full_rebuild_at": "2026-04-21T03:04:12Z",
  "last_pmtiles_object": "moj/mojmap-20260421.pmtiles",
  "datasets": {
    "tokyo-shinjuku-nishi-shinjuku": {
      "ckan_id": "...",
      "ckan_modified": "2026-04-15T00:00:00Z",
      "zip_sha256": "ab12...",
      "feature_count": 13421,
      "ingested_at": "2026-04-21T03:02:08Z"
    }
  }
}
```

**冪等性**:
- 同じ `manifest.json` 状態で `mojmap:daily` を再実行 → 差分ゼロなら PMTiles 再生成をスキップし即終了（`to_update.json` が空）
- ZIP DL 失敗や XML パース失敗は dataset 単位で握り潰し、`failed_datasets` 配列に積んでログ出力。**他 dataset を巻き込まない**
- 変更が1件でもあれば PMTiles は全件再生成（部分更新禁止）。差分の定義は CKAN `metadata_modified` の単調増加
- `6_build_pmtiles` は GCS 上の NDJSON.gz をソースにする（ローカルキャッシュは信用しない）。CI/Cloud Run Job の実行ごとに状態が揃う

**原子性 / race 対策**:
- PMTiles は `moj/mojmap-YYYYMMDD-HHMMSS.pmtiles` に日時付きで put → 成功後に `moj/current.txt` に最新オブジェクト名を書き込む（`current.txt` は数バイトなので書き込み原子性あり）
- ランタイム側（route.ts）は起動時に `current.txt` を GET し、指し先の PMTiles オブジェクトを参照する。古いオブジェクトは最低 2世代保持、それ以前は `7_publish` の最後で削除
- `mojmap.pmtiles` という固定名も alias として最新へ上書きしておく（運用観察・手動検証用）。API は固定名ではなく `current.txt` 経由で参照するのが正

**座標系マップ（Step 4 の重要データ）**:
市区町村コード → JGD2011 平面直角座標系番号の対応表を `scripts/mojmap/src/crs_map.json` に持つ。例:
```json
{
  "13": 9,   "11": 9,   "12": 9,   "14": 9,   // 関東 → 9系
  "27": 6,   "28": 6,                         // 大阪・兵庫 → 6系
  "01": 12,                                   // 北海道（支庁で10-13系に分かれるが phase1 は札幌 = 12系）
  "40": 2                                     // 福岡 → 2系
  // 全 Phase1 市区町村を網羅すること
}
```
proj4 定義文字列は `+proj=tmerc +lat_0=... +lon_0=... +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs` 形式。`proj4` npm パッケージの `EPSG:6669`〜`EPSG:6687` が JGD2011 平面直角 1〜19 系に対応するのでそれを使う。

**properties 仕様（PMTiles 内の各 feature）**:
```json
{
  "chiban": "3-42-1",        // 地番（AMX と同キー名で統一）
  "地番": "3-42-1",           // 互換のため両方持たせる
  "oaza": "西新宿",
  "chome": "3",
  "koaza": "",
  "source": "moj",
  "updated_at": "2026-04-15"
}
```

tippecanoe コマンド例:
```bash
tippecanoe -o mojmap.pmtiles \
  --layer=fude \
  --minimum-zoom=13 --maximum-zoom=18 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --read-parallel \
  out/geojson/*.ndjson
```

**layer 名は `fude` で統一** — `parcel-lookup/route.ts` が既に `tile.layers.fude` を参照しているため、AMX と同じレイヤ名にしておけば既存コードがそのまま流用できる。

### Step 2: ランタイム統合（`src/app/api/parcel-lookup/route.ts`）

現状 AMX のみ参照 → MOJ を先に試し、ヒットしなければ AMX へフォールバックする構造に。

```ts
const MOJ_CURRENT_URL = process.env.MOJ_CURRENT_URL
  ?? 'https://storage.googleapis.com/volans-web-parcel-data/moj/current.txt';
const AMX_PMTILES_URL = 'https://habs.rad.naro.go.jp/spatial_data/amx/a.pmtiles';

let mojPmtiles: PMTiles | null = null;
let mojObjectKey: string | null = null;
let mojResolvedAt = 0;
const MOJ_RESOLVE_TTL_MS = 10 * 60 * 1000; // current.txt を 10分キャッシュ

let amxPmtiles: PMTiles | null = null;

async function getMojPmtiles(): Promise<PMTiles | null> {
  const now = Date.now();
  if (mojPmtiles && now - mojResolvedAt < MOJ_RESOLVE_TTL_MS) return mojPmtiles;
  try {
    const resp = await fetch(MOJ_CURRENT_URL, { cache: 'no-store' });
    if (!resp.ok) return null;
    const key = (await resp.text()).trim(); // 例: "moj/mojmap-20260421.pmtiles"
    if (!key || !key.startsWith('moj/')) return null;
    if (key === mojObjectKey && mojPmtiles) {
      mojResolvedAt = now;
      return mojPmtiles;
    }
    mojObjectKey = key;
    mojPmtiles = new PMTiles(`https://storage.googleapis.com/volans-web-parcel-data/${key}`);
    mojResolvedAt = now;
    return mojPmtiles;
  } catch (err) {
    console.warn('[parcel-lookup] MOJ current.txt resolve failed:', err);
    return null;
  }
}

async function lookupFromPmtiles(
  pm: PMTiles,
  source: 'moj' | 'amx',
  lat: number, lng: number,
): Promise<ParcelCandidate[]> {
  // 既存の POST ハンドラ内 PMTiles ルックアップ処理をここに抽出
  // 返り値の各 candidate.properties に `source` を埋める
  // PMTiles が空レスポンスを返す場合は [] を返し、throw しない
}

export async function POST(req: NextRequest) {
  // ... parseRequestLatLng ...
  let candidates: ParcelCandidate[] = [];
  const moj = await getMojPmtiles();
  if (moj) {
    try {
      candidates = await lookupFromPmtiles(moj, 'moj', lat, lng);
    } catch (err) {
      console.warn('[parcel-lookup] MOJ lookup threw, falling back to AMX:', err);
    }
  }
  if (candidates.length === 0) {
    try {
      const amx = amxPmtiles ?? (amxPmtiles = new PMTiles(AMX_PMTILES_URL));
      candidates = await lookupFromPmtiles(amx, 'amx', lat, lng);
    } catch (err) {
      console.warn('[parcel-lookup] AMX lookup threw:', err);
    }
  }
  // ... 以降既存ロジック（candidates の重複排除・距離フィルタ・JSON 整形） ...
}
```

**注意**:
- `current.txt` が未配置（Phase 1 ビルド完了前）の場合 `getMojPmtiles()` が null を返し、AMX にフォールバック。例外は投げない
- PMTiles 側が `getZxy` で null/空バイナリを返すケース（対象タイルが範囲外）は既存コード同様 `{ features: [], extent: null }` 扱いにし、例外ではなく「該当なし」として扱う
- 毎分走る API 呼び出しで GCS に `current.txt` を叩かないよう 10分 TTL でメモリキャッシュ。月次/日次パイプで `current.txt` が更新されても最大 10分で反映されれば十分
- 環境変数 `MOJ_CURRENT_URL` で差し替え可能（ローカル開発で別バケット / ファイル URL を指したい場合）
- Cloud Run のインスタンス再起動時は `mojPmtiles` がリセットされるが問題ない（初回リクエストで `current.txt` を読み直す）

### Step 3: フロントエンド

**3a. `src/stores/useVolansStore.ts:52`**:
```ts
siteSource: 'demo' | 'parcel' | 'moj' | 'building' | 'manual' | 'dxf' | 'ocr';
```

`fetchFromAddress` 内の parcel ピック処理 (`useVolansStore.ts` の L236-L270 付近) を修正する。

**2a. レスポンス型注釈を拡張**: 現在 `{ chiban?, coordinates?, containsPoint?, distanceMeters? }` のみ拾っているので、`properties?: Record<string, unknown>` を追加:
```ts
const pr = (await parcelResp.json()) as {
  parcels?: Array<{
    chiban?: string;
    coordinates?: [number, number][][] | [number, number][];
    containsPoint?: boolean;
    distanceMeters?: number | null;
    properties?: Record<string, unknown>;   // ← 追加
  }>;
};
```

**2b. ローカル `ParcelCandidate` 型に source を追加**: `useVolansStore.ts` 先頭付近で定義されている `ParcelCandidate` 型に `source?: 'moj' | 'amx'` を足し、ループ内で埋める:
```ts
for (const p of pr.parcels) {
  const ring = flattenOuterRing(p.coordinates);
  if (ring.length >= 3) {
    const rawSource = String(p.properties?.source ?? '');
    const source: 'moj' | 'amx' | undefined =
      rawSource === 'moj' ? 'moj' : rawSource === 'amx' ? 'amx' : undefined;
    parcelCandidates.push({
      chiban: p.chiban ?? '—',
      ring,
      distanceMeters: p.distanceMeters ?? null,
      containsPoint: Boolean(p.containsPoint),
      source,
    });
  }
}
```

**2c. `siteSource` への反映**:
```ts
const pick = parcelCandidates[0];
if (pick) {
  const site = buildSiteFromGeoRing(pick.ring);
  if (site) {
    nextSite = site;
    nextSiteSource = pick.source === 'moj' ? 'moj' : 'parcel'; // amx or undefined は従来通り 'parcel'
    chosenRing = pick.ring;
  }
}
```

**2d. ランタイムの route.ts 側は既に `properties: candidate.properties` を返している**（`src/app/api/parcel-lookup/route.ts:215`）ので、PMTiles の properties に `source` が入っていれば自動で伝播する。MOJ PMTiles ビルド時に各 feature の `properties.source = 'moj'` を埋めること（Step 1 の properties 仕様参照）。AMX 側の properties には `source` キーが存在しないが、Step 2 のランタイム統合で lookup ごとに `candidate.properties.source = source` を上書き代入するので両方とも埋まる状態になる。

**3b. `src/components/volans/SiteSourceBadge.tsx`**:

`meta` オブジェクトに `moj` エントリを追加（`parcel` より前、最高信頼度として扱う）:
```ts
moj: {
  label: '登記所備付地図',
  detail: '法務省 登記所備付地図 XML 由来（正式地番、法的根拠あり）',
  color: 'var(--volans-success)',
  bg: 'var(--volans-success-soft)',
  icon: '📜',
},
```

**3c. 候補一覧 UI**: `ParcelCandidates` コンポーネント等で parcel.properties?.source に応じて `📜` or `✅` アイコンを出し分け。実装場所は `src/components/volans/` 配下を grep で特定（`parcelCandidates` を使っている箇所）。

### Step 4: Cloud Run Job + Scheduler（日次差分更新）

2 つのエントリポイント:
- `pnpm run mojmap:full` — 全市区町村フル再構築（初回 + 月次の念のため実行）
- `pnpm run mojmap:daily` — CKAN 差分チェック → 変更分のみ DL・パース → PMTiles 再生成

```bash
# Job 定義（コンテナは scripts/mojmap/Dockerfile、node + proj + tippecanoe 入り）
gcloud run jobs create volans-mojmap-daily \
  --image=asia-northeast1-docker.pkg.dev/volans-web/volans/mojmap-builder:latest \
  --region=asia-northeast1 \
  --task-timeout=3600 --memory=8Gi --cpu=4 \
  --command=pnpm --args=run,mojmap:daily \
  --service-account=volans-mojmap@volans-web.iam.gserviceaccount.com

gcloud run jobs create volans-mojmap-full \
  --image=asia-northeast1-docker.pkg.dev/volans-web/volans/mojmap-builder:latest \
  --region=asia-northeast1 \
  --task-timeout=14400 --memory=8Gi --cpu=4 \
  --command=pnpm --args=run,mojmap:full \
  --service-account=volans-mojmap@volans-web.iam.gserviceaccount.com

# Scheduler: 毎日 JST 03:00 差分、毎月1日 JST 02:00 フル再構築
gcloud scheduler jobs create http volans-mojmap-daily \
  --location=asia-northeast1 \
  --schedule="0 3 * * *" --time-zone="Asia/Tokyo" \
  --http-method=POST \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/volans-web/jobs/volans-mojmap-daily:run" \
  --oauth-service-account-email=volans-scheduler@volans-web.iam.gserviceaccount.com

gcloud scheduler jobs create http volans-mojmap-monthly-full \
  --location=asia-northeast1 \
  --schedule="0 2 1 * *" --time-zone="Asia/Tokyo" \
  --http-method=POST \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/volans-web/jobs/volans-mojmap-full:run" \
  --oauth-service-account-email=volans-scheduler@volans-web.iam.gserviceaccount.com
```

**初回実行**: ローカル `pnpm run mojmap:full` で一気通貫（3-8GB DL + tippecanoe で 1-2h）。この結果が `manifest.json` + `current.txt` + 初版 PMTiles として GCS に乗った時点で Phase 1 完了。

**日次 Job の挙動**:
- CKAN 差分ゼロ → `to_update.json` 空 → `6_build_pmtiles` 以降スキップして即終了（課金最小）
- 差分 1 件以上 → 変更分だけ DL・パース・NDJSON.gz 更新 → 全件マージで PMTiles 再生成 → `current.txt` 更新
- 1 dataset の失敗は握り潰し、`manifest.json.failed_datasets` に積んで翌日リトライ対象に残す（`metadata_modified` を書き戻さないことで自動リトライ）
- 連続 7日失敗した dataset は Slack/メール通知（実装は後続、まずはログのみで可）

**月次フル Job の挙動**:
- `manifest.json` を無視して全 dataset 再取得 → NDJSON.gz 再生成 → PMTiles 再構築 → `manifest.json` を初期化
- データソース側の sha256 不一致や座標系マップの更新を反映する保険
- 実行後は日次 Job と同じ状態に収束

### Step 5: ドキュメント

`docs/mojmap-pipeline.md` に以下を記載:
- 手動実行手順（`pnpm run mojmap:all`）
- CKAN からどう対象ZIPを絞るか（市区町村コード一致）
- 失敗時リカバリ（特定市区町村のZIP不整合を無視して進行するフラグ）
- Phase 2 全国化時の変更点（対象リスト差し替え + tippecanoe の並列度調整）

---

## 5. 完了条件

- [ ] `scripts/mojmap/` で `pnpm run mojmap:full` がローカルで Phase 1 相当を処理完走し、`mojmap-YYYYMMDD.pmtiles` が生成される
- [ ] `gs://volans-web-parcel-data/moj/` に以下が揃っている:
  - `mojmap-YYYYMMDD-HHMMSS.pmtiles`（最新版 + 直前1世代 = 最低2世代保持）
  - `mojmap.pmtiles`（最新版の alias、運用観察用）
  - `current.txt`（最新オブジェクトキーのみ、改行1つ）
  - `_state/manifest.json`
  - `geojson/{datasetId}.ndjson.gz` 群
  - いずれも Public GET 可、`current.txt` と `manifest.json` は `Cache-Control: no-store`
- [ ] `pnpm run mojmap:daily` を差分ゼロ状態で再実行すると PMTiles 再生成をスキップして 1分以内に終了
- [ ] `pnpm run mojmap:daily` を `manifest.json` の一部 dataset の `ckan_modified` を過去日に書き換えた状態で実行すると、その dataset だけ再取得され PMTiles が差し替わる
- [ ] 故意に壊した ZIP を 1 件仕込んでも他 dataset の処理は完走し、`failed_datasets` にその dataset が記録される
- [ ] `pnpm -C volume-check build` が型エラー・ESLint エラーなしで通る
- [ ] `pnpm -C volume-check test` が通る（パーサ・crs_map・`current.txt` キャッシュ TTL にユニットテストを追加）
- [ ] `POST /api/parcel-lookup` で東京都新宿区西新宿3丁目の座標 (35.6912, 139.6917) を投げると `parcels[].properties.source === 'moj'` が返る
- [ ] `current.txt` を空文字列に差し替えた状態で同じ API を叩くと AMX にフォールバックし、`properties.source === 'amx'` が返る（エラーにはならない）
- [ ] `/m/input` で同じ住所を検索すると `SiteSourceBadge` が「📜 登記所備付地図」緑で表示される
- [ ] MOJ が未ヒットの田舎住所（例: 北海道占冠村 任意の座標）では AMX または OSM にフォールバックし、エラーにならない
- [ ] Cloud Run Job `volans-mojmap-daily` と `volans-mojmap-full` が手動実行で成功（`gcloud run jobs execute ...`）
- [ ] Cloud Scheduler `volans-mojmap-daily` と `volans-mojmap-monthly-full` が `ENABLED` 状態で登録されている
- [ ] `docs/mojmap-pipeline.md` に以下を記載: 手順・リカバリ・差分ロジックの説明・座標系マップ・Phase 2 移行メモ

---

## 6. 禁止事項

- **地番フォーマットの改変禁止** — `"3-42-1"` のまま保持。ハイフン置換や丁目抽出を途中で挟まない
- **座標系変換を省略しない** — JGD2011 平面直角 → WGS84 は `proj4` で厳密に。市区町村ごとに座標系番号が違う（東京=9系、大阪=6系 等）ので municipality ごとの系指定が必要
- **AMX の既存ロジックを壊さない** — MOJ 追加は非破壊、MOJ が落ちても AMX にフォールバックするだけ
- **UI デザイン原則違反禁止** — `docs/ui-principles.md` と VOLANS デザイン禁止事項（AIグラデ / Interフォント / Lucide単独 / shadcnデフォルト）を厳守
- **`docs/ui-spec-volans.md` の色・数値・文言を勝手に改変しない**

---

## 7. 参考ファイル

- 既存 AMX 実装: `src/app/api/parcel-lookup/route.ts`
- 敷地ストア: `src/stores/useVolansStore.ts`（特に `fetchFromAddress` at L167）
- 出典バッジ: `src/components/volans/SiteSourceBadge.tsx`
- OSM fallback: `src/app/api/nearby-buildings/route.ts`
- MVT ユーティリティ: `src/lib/mvt-utils.ts`
- 座標パーサ: `src/lib/coordinate-parser.ts`
- デプロイヘルパ: `scripts/deploy-volans.sh`, `cloudbuild.yaml`

---

## 8. Phase 2（全国化）への布石

Phase 1 完了後、以下だけ変えれば Phase 2 に拡張できるようにしておく：

- `phase1_municipalities.json` → `all_municipalities.json` に差し替え
- `crs_map.json` を全市区町村コード分に拡張（JGD2011 平面直角 1〜19 系すべてカバー）
- tippecanoe の zoom を 12-18 に広げる（容量爆発するので `--drop-densest-as-needed` 必須）
- PMTiles 容量が 5GB を超えそうなら地方ブロック分割（`mojmap-kanto.pmtiles` / `mojmap-kansai.pmtiles` 等）→ ランタイム側で `current.txt` の代わりに BBox → オブジェクト名マップを返すインデックスファイルを読む
- Cloud Run Job のメモリを 16Gi、タイムアウトを 6h に増強
- 日次差分パイプは Phase 1 で既に動いているので Phase 2 では対象リストとメモリだけ増やせば流用可能

Phase 2 化は別指示書 `CODEX_VOLANS_MOJMAP_PHASE2.md` で扱う。本指示書のスコープ外。

---

## 9. よくある落とし穴（必読）

Codex が勝手に近道しないよう明示：

1. **座標系変換を省略しない**。JIS X 7307 の座標は**メートル**単位の平面直角座標（経緯度ではない）。proj4 で EPSG:6669〜6687 を指定して WGS84 に変換すること。これを間違えると地球上どこでもない場所に敷地が現れる。
2. **ZIP を untar/unzip した中身は XML だけとは限らない**。PDF・README・XSD が同梱される。拡張子 `.xml` のみ処理対象。
3. **同一 dataset に複数 XML が入っていることがある**（大字を更に分割）。全部処理してマージ。
4. **文字コードは UTF-8 とは限らない**。Shift_JIS / UTF-8 の両方が観測される。BOM 検出 + encoding 自動判定（`chardet` 相当）を入れる。
5. **地番に全角数字・ハイフンが混在する**。全角→半角正規化を挟むが、**丁目や枝番構造は崩さない**（`"３－４２－１"` → `"3-42-1"` はOK、`"3丁目42番1号"` のような再構成は禁止）。
6. **CKAN `metadata_modified` は ZIP 差し替え時刻ではなく CKAN レコードの更新時刻**。誤って CKAN のタイトル修正だけで modified が進むことがあるので、ZIP の SHA256 も照合する（同じなら処理スキップ）。
7. **`tippecanoe` が feature を drop したときのログは必ず確認**。`--drop-densest-as-needed` は黙って間引くので、Phase 1 規模で drop が発生したら zoom 範囲か `--maximum-tile-bytes` を再調整する。
8. **PMTiles URL を API ハンドラに直書きしない**。Step 2 の通り `current.txt` 経由 + 環境変数差し替え可で書く。本番と dev で別の PMTiles を指せることが重要。
9. **`siteSource` の値を 5箇所以上で分岐しない**。`SiteSourceBadge` と `useVolansStore` の 2箇所で一元管理。grep で `siteSource ===` を全部洗い出し、MOJ 追加漏れを確認すること。
10. **デモ/モック/spinner の中身を勝手に「MOJ 対応済」と書かない**。ユーザーは正確性を重視。実装前に画面上で「登記所備付地図」表記を出すのは**禁止**（PR #1 レビューで指摘された方針）。
