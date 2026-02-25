# 国土交通省API・MCPサーバー統合調査レポート
## VolumeCheck建物ボリューム計算アプリへの統合に向けて

**調査日**: 2026年2月25日
**対象アプリ**: VolumeCheck（Next.js 16 + React 19 + Three.js）

---

## 目次

1. [調査概要](#1-調査概要)
2. [利用可能なAPI・データソース一覧](#2-利用可能なapiデータソース一覧)
3. [各APIの詳細仕様](#3-各apiの詳細仕様)
4. [データカバレッジ（対応地域）](#4-データカバレッジ対応地域)
5. [VolumeCheckとの統合アーキテクチャ](#5-volumecheckとの統合アーキテクチャ)
6. [MCPサーバー設計](#6-mcpサーバー設計)
7. [実装ロードマップ](#7-実装ロードマップ)

---

## 1. 調査概要

### 1.1 目的

VolumeCheckアプリにおいて、以下のデータを住所入力または地図クリックから**自動取得**する仕組みを構築する:

| # | データ項目 | VolumeCheck上の用途 |
|---|-----------|-------------------|
| 1 | 敷地データ（筆界） | `SiteBoundary.vertices` |
| 2 | 道路データ（幅員・位置） | `Road[]` |
| 3 | 河川データ（位置・離隔距離） | セットバック計算 |
| 4 | 用途地域 | `ZoningData.district` |
| 5 | 高度地区 | `ZoningData.heightDistrict` |
| 6 | 建ぺい率・容積率 | `ZoningData.coverageRatio / floorAreaRatio` |
| 7 | 防火地域 | `ZoningData.fireDistrict` |

### 1.2 現在のVolumeCheckの状況

現在のVolumeCheckアプリは以下のAPIを既に利用している:

- **国土地理院 ジオコーディングAPI**: 住所→座標変換（`/api/geocode`）
- **Geolonia CloudFront経由 不動産情報ライブラリ PBFタイル**: 用途地域・建ぺい率・容積率の自動取得（`/api/zoning-lookup`）
- **Gemini Vision API**: 測量図OCRによる敷地形状抽出（`/api/analyze-site`）

### 1.3 調査対象API・データソース

| データソース | 運営 | 種別 |
|------------|------|------|
| 不動産情報ライブラリ（Reinfolib） | 国土交通省 | REST API |
| PLATEAU（3D都市モデル） | 国土交通省 都市局 | データカタログAPI + 配信サービス |
| 国土交通データプラットフォーム | 国土交通省 | GraphQL API |
| 国土数値情報 | 国土交通省 | ダウンロード（GML/Shape） |
| 国土地理院API | 国土地理院 | REST API |
| 登記所備付地図 | 法務省 | XML（G空間情報センター経由ダウンロード） |

---

## 2. 利用可能なAPI・データソース一覧

### 2.1 不動産情報ライブラリ（Reinfolib）API **[最重要]**

- **URL**: https://www.reinfolib.mlit.go.jp/
- **APIマニュアル**: https://www.reinfolib.mlit.go.jp/help/apiManual/
- **認証**: APIキー必要（申請後約5営業日で発行）
- **形式**: GeoJSON / PBF（バイナリベクトルタイル）/ JSON
- **利用者数**: 3,096者（2025年6月時点）

#### VolumeCheckに関連するエンドポイント一覧

| API ID | エンドポイント | データ内容 | 形式 | VolumeCheck関連度 |
|--------|--------------|-----------|------|-----------------|
| XKT001 | `/ex-api/external/XKT001/{z}/{x}/{y}` | 都市計画区域・区域区分 | GeoJSON/PBF | ★★☆ |
| XKT002 | `/ex-api/external/XKT002/{z}/{x}/{y}` | **用途地域**（建ぺい率・容積率含む） | GeoJSON/PBF | ★★★ |
| XKT003 | `/ex-api/external/XKT003/{z}/{x}/{y}` | 立地適正化計画 | GeoJSON/PBF | ★☆☆ |
| XKT004 | `/ex-api/external/XKT004/{z}/{x}/{y}` | 小学校区 | GeoJSON/PBF | ☆☆☆ |
| XKT005 | `/ex-api/external/XKT005/{z}/{x}/{y}` | 中学校区 | GeoJSON/PBF | ☆☆☆ |
| XKT006 | `/ex-api/external/XKT006/{z}/{x}/{y}` | 学校 | GeoJSON/PBF | ☆☆☆ |
| XKT014 | `/ex-api/external/XKT014/{z}/{x}/{y}` | **防火地域・準防火地域** | GeoJSON/PBF | ★★★ |
| XKT031 | `/ex-api/external/XKT031/{z}/{x}/{y}` | 人口集中地区 | GeoJSON/PBF | ☆☆☆ |

#### XYZタイル座標パラメータ

```
z: ズームレベル（14〜15推奨）
x: タイルX座標
y: タイルY座標
response_format: "geojson" または "pbf"
```

#### XKT002（用途地域）レスポンス内の主要プロパティ

```json
{
  "用途地域": "第一種中高層住居専用地域",
  "建ぺい率": 60,
  "容積率": 200,
  "建蔽率": 60
}
```

> **注**: VolumeCheckでは既にGeolonia CloudFrontプロキシ経由でXKT002のPBFデータを取得済み。
> 今後は直接Reinfolib APIキーを使用し、XKT014（防火地域）も追加取得するべき。

#### APIキー取得方法

1. https://www.reinfolib.mlit.go.jp/ にアクセス
2. API利用申請フォームから申請
3. 約5営業日でAPIキー発行
4. リクエストヘッダーに `Ocp-Apim-Subscription-Key: {APIキー}` を設定

### 2.2 Project PLATEAU（3D都市モデル）

- **公式サイト**: https://www.mlit.go.jp/plateau/
- **GitHub**: https://github.com/Project-PLATEAU
- **PLATEAU VIEW 4.0**: https://plateauview.mlit.go.jp/
- **認証**: 不要（オープンデータ）
- **形式**: CityGML 2.0 / 3D Tiles 1.0 / MVT（Mapbox Vector Tiles）

#### データカタログAPI

```
ベースURL: https://api.plateauview.mlit.go.jp
ドキュメント: https://api.plateauview.mlit.go.jp/docs/
```

| エンドポイント | 説明 |
|--------------|------|
| `/datacatalog/plateau-datasets` | PLATEAUデータセット一覧取得 |
| `/datacatalog/citygml/s:{zoom}/{tileZ}/{tileX}/{tileY}` | Spatial IDによるCityGMLファイル検索 |
| `/citygml/features?sid={SpatialID}` | CityGML属性情報検索 |

#### CityGMLに含まれる建築規制関連データ

PLATEAUのCityGMLデータには、都市によって以下の属性が含まれる:

- **urf:DistrictsAndZones** - 用途地域ポリゴン
- **bldg:Building** - 建物LOD0〜4
  - 建物用途（`bldg:usage`）
  - 建築年（`bldg:yearOfConstruction`）
  - 階数（`bldg:storeysAboveGround`）
  - 高さ（`bldg:measuredHeight`）
- **luse:LandUse** - 土地利用
- **tran:Road** - 道路（3Dジオメトリ）

#### 3D Tiles配信サービス

```
ベースURL: https://assets.cms.plateau.reearth.io/
タイルセット: tileset.json
形式: 3D Tiles 1.0
```

VolumeCheckでの活用:
- 周辺建物の3D表示（参考情報として）
- 道路の位置・幅員の参考データ
- 地形（Terrain）データ

### 2.3 国土交通データプラットフォーム（国土交通DPF）

- **URL**: https://data-platform.mlit.go.jp/
- **API文書**: https://www.mlit-data.jp/api_docs/
- **認証**: APIキー必要
- **形式**: JSON（GraphQL）

#### 主要機能

- **キーワード検索**: データカタログ横断検索
- **地理座標検索**: 緯度経度ベースのデータ検索
- **属性検索**: メタデータによるフィルタリング
- **データセット情報取得**: カタログ・データセット詳細

#### MCPサーバー（公式）

2025年11月に国土交通省がMCPサーバーを公式リリース:

```
GitHub: https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp
言語: Python
プロトコル: MCP (Model Context Protocol)
```

対話形式でのデータ検索・取得が可能。例: 「新宿駅近くの避難所を5件」

### 2.4 国土数値情報ダウンロードサービス

- **URL**: https://nlftp.mlit.go.jp/ksj/
- **認証**: 不要
- **形式**: JPGIS2.1（GML）/ Shape
- **提供方式**: ファイルダウンロード（APIなし）

#### VolumeCheckに関連するデータセット

| データID | データ名 | 説明 | 更新頻度 |
|---------|---------|------|---------|
| A29 | 用途地域 | 用途地域分類・建ぺい率・容積率 | 不定期（2019年度版最新） |
| A55 | 都市計画決定情報 | 高度地区、地区計画等を含む | 2022年度版 |
| N01 | 道路（高速自動車道・一般国道） | 道路中心線 | 不定期 |
| W05 | 河川 | 河川中心線・流域 | 令和6年度版 |
| N10 | 緊急輸送道路 | 緊急輸送道路ネットワーク | 不定期 |

> **注**: 国土数値情報はAPI提供がなく、ファイルダウンロード方式のみ。
> VolumeCheckへの統合には、ダウンロードしたデータをPostGISなどに格納し、
> 独自APIを構築する必要がある。

### 2.5 国土地理院API

- **URL**: https://maps.gsi.go.jp/
- **認証**: 不要（会員登録不要）
- **形式**: JSON / GeoJSON

#### エンドポイント一覧

| API | エンドポイント | 説明 |
|-----|--------------|------|
| ジオコーディング | `https://msearch.gsi.go.jp/address-search/AddressSearch?q={住所}` | 住所→緯度経度 |
| 逆ジオコーディング | `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat={lat}&lon={lon}` | 緯度経度→住所 |
| 標高API | `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon={lon}&lat={lat}&outtype=JSON` | 標高取得 |
| 地理院タイル | `https://cyberjapandata.gsi.go.jp/xyz/{t}/{z}/{x}/{y}.png` | ベースマップタイル |

> **注**: VolumeCheckでは既にジオコーディングAPIを利用済み（`/api/geocode/route.ts`）。
> 逆ジオコーディングと標高APIを追加活用すべき。

### 2.6 登記所備付地図データ

- **提供元**: 法務省（G空間情報センター経由）
- **URL**: https://front.geospatial.jp/moj-chizu-xml-readme/
- **認証**: 不要（ダウンロード）
- **形式**: XML（地図XMLフォーマット）
- **更新**: 令和7年（2025年）4月15日に更新版公開（令和7年2月時点データ）

#### データ内容

- 筆界（敷地境界線）のポリゴンデータ
- 地番情報
- 座標値（任意座標系 → 公共座標系変換が必要な場合あり）

#### 制約事項

- API提供なし（ファイルダウンロードのみ）
- 全国データサイズが巨大
- 座標系の統一が必要（座標系が混在）
- 全ての筆界が含まれるわけではない（地域による整備率の差）

#### ビューアーサービス

| サービス | URL | 特徴 |
|---------|-----|------|
| MAPPLE法務局地図ビューア | https://labs.mapple.com/mapplexml.html | 地番検索可能 |
| 公図ビューア | https://kouzuviewer.com/ | 可視化ツール |
| BizXaaS MaP ビューア | https://chiban-regi.rmp.glbs.jp/ | NTTデータ提供 |

---

## 3. 各APIの詳細仕様

### 3.1 不動産情報ライブラリAPI 詳細

#### リクエスト仕様

```http
GET https://www.reinfolib.mlit.go.jp/ex-api/external/XKT002/{z}/{x}/{y}.{format}
Headers:
  Ocp-Apim-Subscription-Key: {APIキー}
```

| パラメータ | 型 | 説明 |
|----------|---|------|
| z | integer | ズームレベル（14-15推奨） |
| x | integer | タイルX座標 |
| y | integer | タイルY座標 |
| format | string | `geojson` または `pbf` |

#### 緯度経度 → タイル座標変換（VolumeCheck既存実装）

```typescript
function latLngToTile(lat: number, lng: number, z: number) {
  const n = Math.pow(2, z);
  const tileX = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const tileY = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { tileX, tileY };
}
```

#### レート制限

- 公式な制限値は未公開
- 常識的な範囲での利用を推奨（1秒あたり数リクエスト程度）
- 大量バッチ処理は避ける

### 3.2 PLATEAU データカタログAPI 詳細

#### データセット一覧取得

```http
GET https://api.plateauview.mlit.go.jp/datacatalog/plateau-datasets
```

#### Spatial IDによるCityGML検索

```http
GET https://api.plateauview.mlit.go.jp/datacatalog/citygml/s:{zoom}/{tileZ}/{tileX}/{tileY}
```

レスポンス: CityGMLファイルURLのJSONリスト

#### CityGML属性検索

```http
GET https://api.plateauview.mlit.go.jp/citygml/features?sid={SpatialID1},{SpatialID2}
```

レスポンス: フィーチャーIDと属性情報

#### パフォーマンス

- 空間クエリの中央応答時間: 約1秒
- CityGMLファイルサイズ: 都市により数MB〜数百MB

### 3.3 国土地理院API 詳細

#### ジオコーディングAPI

```http
GET https://msearch.gsi.go.jp/address-search/AddressSearch?q={住所文字列}
```

レスポンス例:
```json
[
  {
    "geometry": {
      "coordinates": [139.6917, 35.6895],
      "type": "Point"
    },
    "type": "Feature",
    "properties": {
      "addressCode": "",
      "title": "東京都新宿区西新宿二丁目"
    }
  }
]
```

#### 逆ジオコーディングAPI

```http
GET https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=35.6895&lon=139.6917
```

レスポンス例:
```json
{
  "results": {
    "mupicode": "13104",
    "lv01nm": "西新宿二丁目"
  }
}
```

---

## 4. データカバレッジ（対応地域）

### 4.1 不動産情報ライブラリ

- **用途地域（XKT002）**: 都市計画区域を定めている全国の市区町村（カバー率高い）
- **防火地域（XKT014）**: 防火地域・準防火地域が指定されている市区町村
- **データ更新**: 令和6年度の都市計画決定GISデータを原典として継続更新

### 4.2 PLATEAU

| 年度 | 整備都市数 | 備考 |
|------|----------|------|
| 2020-2023 | 約250都市 | 初期整備 |
| 2025年度 | 約300都市 | 52事業・約80都市追加 |
| 2027年度目標 | 約500都市 | 全国主要都市カバー |

**主要対応都市（一部）**:
東京23区、横浜市、大阪市、名古屋市、札幌市、福岡市、広島市、仙台市、さいたま市、千葉市、神戸市 等

> **制約**: 全国の自治体を完全カバーしているわけではない。
> 地方の小規模自治体はデータが未整備の場合がある。

### 4.3 国土数値情報

- **用途地域（A29）**: 全国カバー（但し最新は2019年度版）
- **道路データ**: 高速道路・一般国道が中心。市町村道は含まれない場合あり
- **河川データ**: 全国の一級・二級河川をカバー

### 4.4 登記所備付地図

- 全国の登記所が保有する地図データ
- 整備率は地域差が大きい（都市部は比較的整備済み、地方は不十分な場合あり）

---

## 5. VolumeCheckとの統合アーキテクチャ

### 5.1 現在のアーキテクチャ

```
ユーザー入力
    │
    ├── 住所入力 ──→ /api/geocode ──→ 国土地理院API ──→ 緯度経度
    │                                                      │
    ├── 座標取得後 ──→ /api/zoning-lookup ──→ Geolonia CDN (XKT002 PBF)
    │                                          │
    │                                          └──→ 用途地域・建ぺい率・容積率
    │
    ├── 測量図アップロード ──→ /api/analyze-site ──→ Gemini Vision
    │                                                  │
    │                                                  └──→ 敷地形状・道路情報
    │
    └── 手動入力 ──→ ZoningSelector / SiteInputPanel / PolygonSiteInput
```

### 5.2 提案する拡張アーキテクチャ

```
ユーザー入力（住所 or 座標 or 地図クリック）
    │
    ├─[Phase 1]──→ /api/geocode ──→ 国土地理院API ──→ 緯度経度
    │                                                      │
    │              ┌──────────────────────────────────────────┘
    │              │
    │   ┌──────────┼──────────────────────────────────────┐
    │   │          │        並列API呼び出し                  │
    │   │          │                                        │
    │   │  ┌───────┴───────┐  ┌──────────────────┐         │
    │   │  │ Reinfolib API  │  │ PLATEAU API       │         │
    │   │  │                │  │                   │         │
    │   │  │ XKT002: 用途地域│  │ CityGML属性検索    │         │
    │   │  │ XKT014: 防火地域│  │ → 周辺建物データ   │         │
    │   │  │ XKT001: 区域区分│  │ → 道路3Dデータ    │         │
    │   │  └───────┬───────┘  └────────┬─────────┘         │
    │   │          │                   │                    │
    │   │  ┌───────┴───────┐  ┌────────┴─────────┐         │
    │   │  │ 独自GISサーバー │  │ 国土地理院         │         │
    │   │  │ (PostGIS)      │  │                   │         │
    │   │  │                │  │ 標高API            │         │
    │   │  │ 高度地区         │  │ 逆ジオコーディング   │         │
    │   │  │ 河川データ       │  │                   │         │
    │   │  │ 敷地境界(筆界)   │  │                   │         │
    │   │  └───────┬───────┘  └────────┬─────────┘         │
    │   │          │                   │                    │
    │   └──────────┼───────────────────┼────────────────────┘
    │              │                   │
    │              └───────┬───────────┘
    │                      │
    │              ┌───────┴───────┐
    │              │  データ統合     │
    │              │  エンリッチメント │
    │              └───────┬───────┘
    │                      │
    │              ┌───────┴───────────────┐
    │              │ VolumeInput           │
    │              │  site: SiteBoundary   │
    │              │  zoning: ZoningData   │
    │              │  roads: Road[]        │
    │              │  latitude: number     │
    │              └───────────────────────┘
    │
    ├─[Phase 2]──→ MCPサーバー ──→ AI対話によるデータ検索・補完
    │
    └─[Phase 3]──→ PLATEAU 3D表示 ──→ 周辺建物の3Dビジュアライゼーション
```

### 5.3 新規API Route設計

#### `/api/site-data/route.ts` - 統合データ取得API

```typescript
// POST body: { lat: number, lng: number }
// Response: {
//   zoning: {
//     district: string,
//     coverageRatio: number,
//     floorAreaRatio: number,
//     fireDistrict: string,
//     heightDistrict: { type: string, ... } | null,
//   },
//   roads: Road[],          // 周辺道路データ
//   elevation: number,      // 標高
//   address: string,        // 住所
//   plateauAvailable: boolean, // PLATEAU対応地域かどうか
// }
```

#### `/api/fire-district/route.ts` - 防火地域取得API

```typescript
// POST body: { lat: number, lng: number }
// Response: { fireDistrict: "防火地域" | "準防火地域" | "指定なし" }
// 使用API: Reinfolib XKT014
```

#### `/api/plateau/buildings/route.ts` - 周辺建物データ取得API

```typescript
// POST body: { lat: number, lng: number, radius: number }
// Response: {
//   buildings: Array<{
//     id: string,
//     height: number,
//     floors: number,
//     usage: string,
//     geometry: GeoJSON.Polygon
//   }>
// }
```

---

## 6. MCPサーバー設計

### 6.1 既存MCPサーバー（参考実装）

#### A) PLATEAU MCPサーバー（Re:Earth開発）

- **リポジトリ**: https://github.com/Project-PLATEAU/plateau-streaming-tutorial/blob/main/mcp/plateau-mcp.md
- **種別**: リモートMCPサーバー（HTTP）
- **提供ツール**:
  - PLATEAUデータセット検索（都市・データ種別・年度でフィルタ）
  - CityGMLファイル検索（メッシュコード・Spatial ID・バウンディングボックス）
  - 属性情報取得
  - 仕様書・手順書の参照

#### B) 国土交通データプラットフォームMCPサーバー（公式）

- **リポジトリ**: https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp
- **言語**: Python（aiohttp）
- **提供ツール**:
  - キーワード＋地理座標によるデータ検索
  - 属性情報による検索
  - カタログ・データセット情報取得

#### C) 不動産情報ライブラリMCPサーバー（コミュニティ）

- **リポジトリ**: https://github.com/fukunaman/reinfolib-mcp-server
- **言語**: TypeScript（Node.js / pnpm）
- **提供ツール**:
  - 不動産取引価格情報検索
  - 地価公示データ取得
  - 駅コード検索

### 6.2 VolumeCheck専用MCPサーバー設計案

#### サーバー名: `volumecheck-mlit-mcp`

#### ツール一覧

```typescript
// Tool 1: 住所ジオコーディング
interface GeocodeTool {
  name: "geocode";
  description: "日本の住所から緯度経度を取得する";
  input: { address: string };
  output: { lat: number; lng: number; address: string };
}

// Tool 2: 用途地域検索
interface ZoningLookupTool {
  name: "zoning_lookup";
  description: "緯度経度から用途地域・建ぺい率・容積率を取得する";
  input: { lat: number; lng: number };
  output: {
    district: ZoningDistrict;
    coverageRatio: number;
    floorAreaRatio: number;
  };
}

// Tool 3: 防火地域検索
interface FireDistrictLookupTool {
  name: "fire_district_lookup";
  description: "緯度経度から防火地域区分を取得する";
  input: { lat: number; lng: number };
  output: { fireDistrict: FireDistrict };
}

// Tool 4: 高度地区検索
interface HeightDistrictLookupTool {
  name: "height_district_lookup";
  description: "緯度経度から高度地区情報を取得する";
  input: { lat: number; lng: number };
  output: {
    type: string;
    maxHeightAtBoundary: number | null;
    slopeRatio: number | null;
    absoluteMax: number | null;
  };
}

// Tool 5: 周辺道路検索
interface NearbyRoadsLookupTool {
  name: "nearby_roads_lookup";
  description: "緯度経度周辺の道路データを取得する";
  input: { lat: number; lng: number; radius: number };
  output: {
    roads: Array<{
      name: string;
      width: number;
      classification: string;
      centerline: [number, number][];
    }>;
  };
}

// Tool 6: PLATEAU建物検索
interface PlateauBuildingsLookupTool {
  name: "plateau_buildings_lookup";
  description: "PLATEAU 3D都市モデルから周辺建物情報を取得する";
  input: { lat: number; lng: number; radius: number };
  output: {
    available: boolean;
    buildings: Array<{
      id: string;
      height: number;
      floors: number;
      usage: string;
    }>;
  };
}

// Tool 7: 標高取得
interface ElevationLookupTool {
  name: "elevation_lookup";
  description: "緯度経度から標高を取得する";
  input: { lat: number; lng: number };
  output: { elevation: number; source: string };
}

// Tool 8: 統合サイトデータ取得
interface SiteDataLookupTool {
  name: "site_data_lookup";
  description: "住所または座標からVolumeCheckに必要な全データを一括取得する";
  input: { address?: string; lat?: number; lng?: number };
  output: {
    coordinates: { lat: number; lng: number };
    address: string;
    zoning: ZoningData;
    elevation: number;
    plateauAvailable: boolean;
    nearbyRoads: Road[];
  };
}
```

#### MCPサーバー実装構成

```
volumecheck-mlit-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # MCPサーバーエントリポイント
│   ├── tools/
│   │   ├── geocode.ts         # 国土地理院ジオコーディング
│   │   ├── zoning.ts          # Reinfolib XKT002
│   │   ├── fire-district.ts   # Reinfolib XKT014
│   │   ├── height-district.ts # PostGIS or 国土数値情報A55
│   │   ├── roads.ts           # PLATEAU + 国土数値情報
│   │   ├── buildings.ts       # PLATEAU CityGML
│   │   ├── elevation.ts       # 国土地理院標高API
│   │   └── site-data.ts       # 統合取得（上記全てを呼び出し）
│   ├── lib/
│   │   ├── reinfolib-client.ts  # Reinfolib APIクライアント
│   │   ├── plateau-client.ts    # PLATEAU APIクライアント
│   │   ├── gsi-client.ts        # 国土地理院APIクライアント
│   │   └── tile-utils.ts        # タイル座標計算ユーティリティ
│   └── resources/
│       ├── zoning-districts.md  # 用途地域の解説
│       └── building-regs.md     # 建築基準法の規制概要
```

#### MCP設定（Claude Desktop `claude_desktop_config.json`）

```json
{
  "mcpServers": {
    "volumecheck-mlit": {
      "command": "npx",
      "args": ["tsx", "path/to/volumecheck-mlit-mcp/src/index.ts"],
      "env": {
        "REINFOLIB_API_KEY": "your-api-key-here"
      }
    },
    "plateau": {
      "url": "https://plateau-mcp.reearth.io/mcp"
    },
    "mlit-dpf": {
      "command": "python",
      "args": ["path/to/mlit-dpf-mcp/server.py"],
      "env": {
        "MLIT_DPF_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

---

## 7. 実装ロードマップ

### Phase 1: 既存機能の強化（1-2週間）

**優先度: 最高**

1. **防火地域の自動取得**
   - Reinfolib XKT014 の PBF タイル取得を `/api/zoning-lookup` に追加
   - または新規 `/api/fire-district` APIを作成
   - `ZoningData.fireDistrict` に自動セット

2. **Reinfolib APIキーの直接利用**
   - 現在のGeolonia CloudFrontプロキシから直接Reinfolib APIへの切り替え
   - APIキー取得・設定

3. **標高データの統合**
   - 国土地理院標高APIを呼び出し
   - 敷地の傾斜計算に活用

### Phase 2: 高度地区・都市計画決定情報の統合（2-4週間）

**優先度: 高**

1. **高度地区データの取得**
   - 国土数値情報A55（都市計画決定情報）のデータ取得
   - PostGISまたはSQLiteベースの空間データベース構築
   - `/api/height-district` API作成
   - `ZoningData.heightDistrict` に自動セット

2. **都市計画区域・区域区分の取得**
   - Reinfolib XKT001 の活用
   - 「市街化区域」「市街化調整区域」の判定

### Phase 3: 道路・河川データの統合（3-6週間）

**優先度: 中**

1. **PLATEAU道路データの活用**
   - PLATEAU対応都市では3D道路データから幅員・位置を取得
   - `Road[]` の自動生成

2. **国土数値情報 河川データの統合**
   - 河川データ（W05）のPostGIS格納
   - 河川からのセットバック距離自動計算

3. **道路幅員データベースの構築**
   - 市町村道を含む詳細な道路幅員データ
   - PLATEAU + 国土数値情報 + OpenStreetMapの組み合わせ

### Phase 4: MCPサーバーの構築（2-4週間）

**優先度: 中**

1. **volumecheck-mlit-mcp の基本実装**
   - TypeScript MCPサーバーの骨格
   - 既存の PLATEAU MCP / 国土交通DPF MCPとの連携

2. **AI対話によるデータ補完**
   - Claude Desktop / Cursor からの利用
   - 「渋谷区神宮前1-1の敷地条件を調べて」→ 自動データ収集

### Phase 5: 敷地境界の自動取得（4-8週間）

**優先度: 低（技術的難易度高）**

1. **登記所備付地図データの統合**
   - G空間情報センターからXMLデータダウンロード
   - PostGIS格納・インデックス構築
   - 地番検索 → 筆界ポリゴン取得API

2. **PLATEAU建物フットプリントからの敷地推定**
   - 建物LOD0ポリゴンから敷地範囲を推定
   - 衛星画像AIとの組み合わせ

---

## 付録

### A. VolumeCheckの既存型定義との対応

| VolumeCheck型 | データソース | 取得方法 |
|--------------|-----------|---------|
| `SiteBoundary.vertices` | 測量図OCR / 登記所備付地図 / 手動入力 | Gemini Vision / PostGIS / UI |
| `SiteBoundary.area` | 上記から計算 | engine/geometry.ts |
| `Road.width` | PLATEAU / 手動入力 | PLATEAU API / UI |
| `Road.bearing` | PLATEAU / 手動入力 | PLATEAU API / UI |
| `ZoningData.district` | **Reinfolib XKT002** | `/api/zoning-lookup` (実装済み) |
| `ZoningData.coverageRatio` | **Reinfolib XKT002** | `/api/zoning-lookup` (実装済み) |
| `ZoningData.floorAreaRatio` | **Reinfolib XKT002** | `/api/zoning-lookup` (実装済み) |
| `ZoningData.fireDistrict` | **Reinfolib XKT014** | Phase 1で実装 |
| `ZoningData.heightDistrict` | 国土数値情報A55 / PostGIS | Phase 2で実装 |
| `ZoningData.absoluteHeightLimit` | 用途地域から自動判定 | engine/zoning.ts (実装済み) |
| `ZoningData.wallSetback` | 用途地域から自動判定 | engine/zoning.ts (実装済み) |
| `ZoningData.shadowRegulation` | 用途地域+高度地区から判定 | Phase 2で実装 |
| `VolumeInput.latitude` | **国土地理院API** | `/api/geocode` (実装済み) |

### B. API利用料金

| API | 料金 |
|-----|------|
| 不動産情報ライブラリ | **無料** |
| PLATEAU | **無料**（オープンデータ） |
| 国土交通データプラットフォーム | **無料** |
| 国土数値情報 | **無料** |
| 国土地理院API | **無料** |
| 登記所備付地図 | **無料** |

> 全て政府提供のオープンデータ・APIであり、利用料金は発生しない。

### C. 参考リンク

#### 公式

- [不動産情報ライブラリ](https://www.reinfolib.mlit.go.jp/)
- [不動産情報ライブラリ APIマニュアル](https://www.reinfolib.mlit.go.jp/help/apiManual/)
- [Project PLATEAU](https://www.mlit.go.jp/plateau/)
- [PLATEAU VIEW 4.0](https://plateauview.mlit.go.jp/)
- [PLATEAU GitHub](https://github.com/Project-PLATEAU)
- [PLATEAU API ドキュメント](https://api.plateauview.mlit.go.jp/docs/)
- [国土交通データプラットフォーム](https://data-platform.mlit.go.jp/)
- [国土交通DPF API](https://www.mlit-data.jp/api_docs/)
- [国土数値情報ダウンロードサイト](https://nlftp.mlit.go.jp/)
- [国土地理院 測量計算API](https://vldb.gsi.go.jp/sokuchi/surveycalc/api_help.html)
- [G空間情報センター（登記所備付地図）](https://front.geospatial.jp/moj-chizu-xml-readme/)

#### MCPサーバー

- [MLIT DATA PLATFORM MCPサーバー（公式）](https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp)
- [PLATEAU MCPサーバー（Re:Earth）](https://reearth.engineering/posts/plateau-mcp-ja/)
- [不動産情報ライブラリ MCPサーバー（コミュニティ）](https://github.com/fukunaman/reinfolib-mcp-server)
- [PLATEAU配信サービス チュートリアル](https://github.com/Project-PLATEAU/plateau-streaming-tutorial)

#### 技術記事

- [不動産情報ライブラリAPIの活用事例](https://www.homes.co.jp/cont/press/opinion/opinion_00417/)
- [国土地理院APIを使ったジオコーディング](https://analyzegear.co.jp/blog/2872)
- [PLATEAU MCPサーバーリリース記事（Re:Earth）](https://reearth.engineering/posts/plateau-mcp-en/)
- [国交省MCPサーバーで建設DXが変わる転換点](https://axconstdx.com/2025/11/15/%E5%9B%BD%E4%BA%A4%E7%9C%81mcp%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%81%A7api%E4%B8%8D%E8%A6%81%E3%81%AB%E2%80%95%E5%BB%BA%E8%A8%ADdx%E3%81%8C%E5%A4%89%E3%82%8F%E3%82%8B%E8%BB%A2%E6%8F%9B%E7%82%B9/)
- [不動産情報ライブラリの公開APIを利用する](https://fudosan-cloud.com/database/reinfolib)

---

*本レポートは2026年2月25日時点の調査結果に基づいています。APIの仕様・エンドポイントは今後変更される可能性があります。*
