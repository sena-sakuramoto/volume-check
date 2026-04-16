# VolumeCheck LP 仕様書

## 概要

VolumeCheck（建築用地ボリューム計算ツール）のランディングページ。
URL: `/lp`
ファイル: `src/app/lp/page.tsx`

---

## 技術スタック

- **Framework**: Next.js 15 App Router、`'use client'` 必須
- **Styling**: Tailwind CSS v4（ユーティリティクラスのみ、カスタムCSSは `<style jsx global>` で最小限）
- **Animation**: `motion/react`（Framer Motion v11）
- **WebGL**: `ogl`（Aurora・Particles コンポーネント）
- **Fonts**: Google Fonts `Space Grotesk` + `Noto Sans JP`（`<style jsx global>` 内で `@import`）

### 使用カスタムコンポーネント

| コンポーネント | パス | 説明 |
|---|---|---|
| `Aurora` | `@/components/ui/Aurora` | WebGL オーロラ背景。props: `colorStops`, `amplitude`, `blend`, `speed` |
| `BlurText` | `@/components/ui/BlurText` | Framer Motion ブラー表示アニメーション。props: `text`, `animateBy`, `direction`, `delay`, `stepDuration`, `className` |
| `Particles` | `@/components/ui/Particles` | WebGL パーティクル球体。props: `particleCount`, `particleSpread`, `speed`, `particleColors`, `alphaParticles`, `particleBaseSize`, `sizeRandomness`, `cameraDistance`, `moveParticlesOnHover`, `particleHoverFactor` |

---

## デザイントークン

```
背景:         #060810
背景サブ:      #0a0d16
アクセントTeal: #5de4c7
アクセントIndigo: #818cf8
Teal dim:    #9bf2df
テキスト:     white
ミュート:     rgba(255,255,255,0.62)
ボーダー:     rgba(255,255,255,0.10)
カードBG:     rgba(255,255,255,0.03)
フォント:     "Space Grotesk", "Noto Sans JP", sans-serif
```

### Tailwind カスタム値（頻出）
- `bg-[#060810]`, `bg-[#0a101d]`
- `text-[#5de4c7]`, `text-[#9bf2df]`, `text-[#818cf8]`
- `border-white/10`, `bg-white/[0.03]`, `bg-black/20`
- 角丸: `rounded-[28px]`, `rounded-[32px]`, `rounded-full`
- shadow: `shadow-[0_30px_120px_rgba(2,8,23,0.65)]`

---

## ページ構造

```
<main bg="#060810">
  <style jsx global>   ← Google Fonts + @keyframes morphPoly
  <header>             ← Fixed nav
  <section#hero>       ← フルビューポート、Aurora背景
  <div.stats-bar>      ← 4カラムスタッツ
  <section#features>   ← Bentoグリッド
  <section#steps>      ← 3ステップ
  <section#target>     ← 対象ユーザー
  <section.final-cta>  ← 最終CTA
  <footer>
</main>
```

---

## セクション詳細

### 1. グローバルスタイル（`<style jsx global>`）

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700;900&display=swap');

@keyframes morphPoly {
  0%,100% { clip-path: polygon(50% 0%,90% 15%,100% 55%,80% 95%,35% 100%,5% 75%,0% 35%,20% 5%); }
  14%  { clip-path: polygon(30% 0%,75% 0%,100% 35%,100% 70%,65% 100%,20% 100%,0% 65%,0% 25%); }
  28%  { clip-path: polygon(50% 2%,95% 20%,90% 70%,60% 100%,15% 92%,0% 50%,18% 10%,45% 0%); }
  42%  { clip-path: polygon(20% 0%,80% 5%,100% 40%,85% 90%,45% 100%,8% 80%,0% 40%,10% 8%); }
  57%  { clip-path: polygon(40% 0%,85% 10%,100% 55%,75% 98%,30% 100%,0% 70%,5% 28%,22% 2%); }
  71%  { clip-path: polygon(55% 0%,100% 30%,95% 75%,55% 100%,10% 88%,0% 45%,20% 8%,45% 0%); }
  85%  { clip-path: polygon(25% 3%,72% 0%,100% 42%,88% 88%,48% 100%,6% 82%,0% 42%,12% 6%); }
}
.morph-poly { animation: morphPoly 16s cubic-bezier(0.45,0.05,0.55,0.95) infinite; }
```

---

### 2. ナビゲーション（Fixed）

```
高さ: auto（pill型）
位置: fixed inset-x-0 top-0 z-50
形状: rounded-full border border-white/10 bg-[#0a101d]/78 backdrop-blur-2xl
内側: max-w-7xl、flex justify-between items-center

左: ロゴ「VC」アイコン（rounded-full, teal→indigo gradient, 36px） + "VolumeCheck" テキスト
中央: nav links（機能 / 使い方 / 対象）→ md以上で表示
右: 「無料で試す」ボタン（rounded-full, bg-[#5de4c7], text-[#051019]）
     href="/project"
```

---

### 3. ヒーローセクション

**コンテナ**: `min-h-screen flex items-center pt-28 relative`

#### 3-1. 背景レイヤー（重ね順）
1. `Aurora` コンポーネント（`absolute inset-0`）
   - `colorStops: ['#5de4c7', '#0a101d', '#818cf8']`
   - `amplitude: 1.15`, `blend: 0.65`, `speed: 0.75`
2. パーティクル球体（`absolute inset-0`）
   - グローハロー3層（280px / 380px / 500px radial-gradient, blur）
   - `Particles` コンポーネント
     - `particleCount: 700`, `particleSpread: 4.2`, `speed: 0.055`
     - `particleColors: ['#5de4c7','#9bf2df','#b4f7eb','#818cf8','#ffffff']`
     - `alphaParticles: false`, `particleBaseSize: 130`, `sizeRandomness: 1.4`
     - `cameraDistance: 14`, `moveParticlesOnHover: true`, `particleHoverFactor: 0.35`
3. ドットグリッドオーバーレイ（radial-gradient dots 22px間隔、opacity 0.25）
4. 下部フェードオーバーレイ（linear-gradient 下方向）

#### 3-2. メインコンテンツ（relative z-10）

```
配置: mx-auto max-w-7xl flex flex-col gap-12

[Badge]
"PLATEAU × AMX PMTiles 連携"
motion.div: fadeUp 0.7s
スタイル: rounded-full border border-[#5de4c7]/25 bg-[#5de4c7]/10 px-4 py-2
         text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9bf2df]
         内側に h-2 w-2 rounded-full bg-[#5de4c7] shadow-[0_0_18px_#5de4c7] の pulse ドット

[HeadLine]
<BlurText
  text="用地検討を、住所ひとつで。"
  animateBy="characters"
  direction="top"
  delay={85}
  stepDuration={0.28}
  className="justify-center text-center text-[clamp(3rem,9vw,6.4rem)] font-bold leading-[0.94] tracking-[-0.06em] text-white"
/>

[Subtext]
motion.div: fadeUp 0.75s delay 0.2s
"法規制の自動取得から3D最大ボリューム表示・事業性概算まで、デベロッパーの初期検討を数分で完結させるWebツール。"
text-base leading-8 text-white/72

[CTA Buttons]
motion.div: fadeUp 0.8s delay 0.28s
「デモを見る」 → /project?demo=1
  bg-[#5de4c7] text-[#051019] rounded-full px-7 py-3.5 font-semibold
  shadow-[0_20px_40px_rgba(93,228,199,0.22)]
「無料で試す」 → /project
  border border-white/14 bg-white/5 rounded-full px-7 py-3.5 text-white
```

#### 3-3. アプリモックアップ（motion.div: fadeUp 0.9s delay 0.34s）

macOS風ウィンドウフレーム:
```
外側: overflow-hidden rounded-[30px] border border-white/12 bg-[#0b101a]/86
      shadow-[0_30px_120px_rgba(2,8,23,0.65)] backdrop-blur-xl

タイトルバー:
  左: macOS dots (赤#ff5f57, 黄#febc2e, 緑#28c840) 各12px
  中央: "VolumeCheck — localhost:3000/project" (pill型, text-xs text-white/62)
  右: 2つのダミーアイコンボタン

本体: grid lg:grid-cols-[280px_minmax(0,1fr)] min-h-[620px]
```

**サイドバー（左 280px）**:
```
bg: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))
border-r border-white/8 p-5

[Address]
  ラベル: "ADDRESS" (text-[11px] uppercase tracking-[0.22em] text-white/45)
  値: 「渋谷区代々木2丁目」(rounded-2xl border border-white/10 bg-white/5)

[法規制サマリー]
  ヘッダー: "法規制サマリー" + "AUTO" バッジ (teal色)
  
  用途地域: 「第二種住居地域」 (full width card)
  建ぺい率: 「60%」 / 容積率: 「200%」 (2カラム)
  防火地域: 「準防火地域」 (full width)

[計算結果]
  最大延床面積: 840㎡
  最大高さ:    15.9m
  最大階数:    5F
  各行: flex justify-between border border-white/8 bg-white/[0.03] rounded-2xl px-4 py-3
```

**3Dビューアー（右側）**:
```
bg: radial-gradient(indigo hint) + linear-gradient(dark)

[上部バー]
  左: 「基本」(active, bg-white text-[#060810]) / 「日影」ボタン (pill型 border)
  右: 「3D Viewer」ラベル

[LIVE INSIGHT バッジ]
  absolute left-6 top-24
  "LIVE INSIGHT" + "高さ斜線を反映した最大形状を表示中"
  rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl

[右下アクションボタン]
  absolute bottom-8 right-6 space-y-3
  「売上想定をすぐ概算」
  「PDF帳票へ出力可能」
  各: rounded-2xl border border-white/10 bg-black/30 text-sm text-white/70

[3D変形ポリゴンボリューム - 中央]
  ※ 詳細は下記「3Dポリゴン仕様」参照
```

---

### 3-4. 3D変形ポリゴンボリューム 詳細仕様

**目的**: 建築ボリューム（最大建築可能形状）を表す3Dアニメーション

**配置**: `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`

**perspective設定**:
```
perspective: 560px
perspectiveOrigin: 50% 42%
```

**アンビエントグロー**:
```
280px×280px 中央配置 rounded-full
bg: radial-gradient(circle, rgba(93,228,199,0.28) 0%, rgba(129,140,248,0.12) 48%, transparent 68%)
blur-2xl
```

**3Dコンテナ（Framer Motion motion.div）**:
```
width: 200px, height: 200px
transformStyle: preserve-3d
animate:
  rotateX: [38, 42, 36, 40, 38]  → 9秒 easeInOut repeat
  rotateY: [0, 360]               → 22秒 linear repeat
  rotateZ: [0, 8, -5, 6, 0]      → 9秒 easeInOut repeat
```

**押し出しレイヤー（6層、全て `.morph-poly` クラスで同期変形）**:

| Layer | Z位置 | 背景 | Opacity |
|-------|-------|------|---------|
| 1（底面） | -28px | `rgba(8,40,50,0.95)` | 0.50 |
| 2 | -16px | `linear-gradient(135deg, rgba(18,80,90,0.92), rgba(35,45,110,0.88))` | 0.60 |
| 3 | -4px  | `linear-gradient(135deg, rgba(35,145,135,0.90), rgba(60,72,165,0.87))` | 0.70 |
| 4 | +8px  | `linear-gradient(135deg, rgba(65,200,182,0.93), rgba(95,110,210,0.90))` | 0.80 |
| 5 | +20px | `linear-gradient(135deg, #5de4c7, #818cf8)` | 0.90 |
| 6（天面） | +30px | `conic-gradient(from 100deg, #5de4c7, #9bf2df, #c8ccff, #818cf8, #5de4c7)` | 1.00 |

**天面ハイライト**（`translateZ(31px)`）:
```
bg: radial-gradient(circle at 33% 28%, rgba(255,255,255,0.42), transparent 58%)
.morph-poly クラス適用
```

**リムグロー**（`translateZ(25px)`, `inset: -2px`）:
```
filter: blur(3px)
boxShadow: 0 0 20px 5px rgba(93,228,199,0.55), 0 0 45px 10px rgba(93,228,199,0.2)
.morph-poly クラス適用
```

**ポリゴン変形アニメーション**（`.morph-poly`）:
- 8頂点ポリゴン、7形状ループ
- 16秒周期、`cubic-bezier(0.45, 0.05, 0.55, 0.95)`

---

### 4. Statsバー

**4カラムグリッド**, gap-4, 各カード: rounded-[22px] border border-white/8 bg-black/18

| 数値 | 単位 | 説明 |
|------|------|------|
| 3 | 秒 | 住所入力→法規制取得 |
| 5 | 種 | 斜線制限を同時計算 |
| 23 | 区 | PLATEAU東京全域対応 |
| 0 | 円 | 完全無料・登録不要 |

数値は `CountUp` コンポーネント（requestAnimationFrame ベース、easeOut cubic）でカウントアップ。

---

### 5. Features セクション（`#features`）

**見出し**: "初期検討に必要な判断材料を、一画面に圧縮。"
**アイウロウ**: "Features"（text-[#5de4c7]）

**Bentoグリッド** `lg:grid-cols-12`:

| タイル | col span | タイトル | タグ | 説明 |
|--------|----------|---------|------|------|
| 1 | col-span-7 | 筆界ポリゴン自動取得 | AMX PMTiles | 法務省登記所備付地図（AMX PMTiles）活用。地図クリックで敷地形状を自動設定。 |
| 2 | col-span-5 | 法規制を一括自動取得 | PLATEAU urf | PLATEAU都市計画MVTタイル連携。用途地域・高度地区・地区計画・防火地域を自動取得。 |
| 3 | col-span-4 | 3D最大ボリューム | 法規制完全対応 | 道路・隣地・北側斜線+絶対高さ制限を考慮した最大形状をリアルタイム3D表示。 |
| 4 | col-span-4 | 事業性概算 | デベ向け | 用途を選ぶだけで建設費・利回り・収支を自動計算。 |
| 5 | col-span-4 | PDF帳票即出力 | 帳票出力 | 事業検討レポートをPDFで出力。上司・クライアントにそのまま提出。 |
| 6 | col-span-12 | AIクイックアクション | AI連携 | 「何階建て可能？」「斜線制限は？」のワンクリックでGemini AIが解説。 |

各カード: `rounded-[22px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl`
hover: `border-white/18 bg-white/[0.05]`
アニメーション: `whileInView` fadeUp、`once: true`

---

### 6. Steps セクション（`#steps`）

**レイアウト**: `lg:grid-cols-[0.9fr_minmax(0,1.1fr)]`

左側説明カード:
- アイウロウ: "How It Works"（text-[#818cf8]）
- 見出し: "入力から判断まで、3ステップ。"

右側 3ステップカード（各: `STEP N` ラベル + タイトル + 説明、左側teal→indigoグラデーションライン）:

| STEP | タイトル | 説明 |
|------|--------|------|
| 01 | 住所を入力する | 調べたい土地の住所を入力。AMX PMTilesが筆界ポリゴンを自動取得し、敷地形状を即時設定します。 |
| 02 | 法規制を確認する | PLATEAUが用途地域・斜線制限・防火地域・地区計画を自動取得。手動調査ゼロで法規制を把握。 |
| 03 | ボリュームと収益性を確認する | 全ての斜線制限を考慮した最大建築ボリュームを3Dで表示。事業性概算もワンクリックで計算。 |

---

### 7. Target セクション（`#target`）

**ヘッダーカード**（横幅フル、teal+indigo gradient bg）:
- 見出し: "検討速度が競争力になるチームのために。"
- 「デモを見る」ボタン（右側）

**3カラムユースケースカード**:

| タイトル | 説明 |
|--------|------|
| 不動産デベロッパー | 仕入れ検討を週次から日次へ。初期スクリーニングの件数を増やしながら、精度の高い判断ラインを維持します。 |
| 建築設計事務所 | 初回提案に必要な規模感を即日把握。クライアントとの最初の打ち合わせから、根拠のある数字を持ち込めます。 |
| 用地仕入れ担当者 | 現地確認前にデスクで概要を掴む。移動前にGO/NOGOの仮判断ができ、優先順位をつけた動き方ができます。 |

---

### 8. Final CTA セクション

**カード**: rounded-[36px]、teal+indigoのradial-gradient装飾
- アイウロウ: "Final CTA"
- 見出し: "次の用地検討は、住所入力から始める。"
- サブ: "登録不要・完全無料。VolumeCheck を開けば、最初の確認に必要な情報が数分で揃います。"
- ボタン2つ: 「無料で試す」（teal）/ 「デモを見る」（ghost）

---

### 9. Footer

`border-t border-white/8 py-8`
左: "VolumeCheck beta"（text-white/62）
右: "© 2026 VolumeCheck beta"（text-white/46）

---

## アニメーション方針

| 種類 | 実装 | 詳細 |
|------|------|------|
| 初回フェードアップ | `motion.div initial/animate` | `opacity: 0→1, y: 18→0`, duration 0.7s, ease [0.22,1,0.36,1] |
| スクロール連動 | `motion.div whileInView` | `once: true`, amount 0.2〜0.3 |
| ヒーロー要素 | 段階的 delay | Badge: 0s, Text: 0s, Sub: 0.2s, CTA: 0.28s, Mockup: 0.34s |
| Features カード | stagger | `delay: index * 0.06` |
| 3Dポリゴン | CSS keyframes + Framer Motion | rotateX/Y/Z は FM、clip-path は CSS |

---

## インラインコンポーネント

### `CountUp`
```tsx
function CountUp({ from = 0, to, duration = 1.8, className }) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    let frameId = 0;
    const totalMs = duration * 1000;
    const tick = (startTime) => (now) => {
      const progress = Math.min((now - startTime) / totalMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease out
      setValue(Math.round(from + (to - from) * eased));
      if (progress < 1) frameId = requestAnimationFrame(tick(startTime));
    };
    frameId = requestAnimationFrame((st) => { frameId = requestAnimationFrame(tick(st)); });
    return () => cancelAnimationFrame(frameId);
  }, [duration, from, to]);
  return <span className={className}>{new Intl.NumberFormat('ja-JP').format(value)}</span>;
}
```

### `MacDot`
```tsx
function MacDot({ color }) {
  return <div className={`h-3 w-3 rounded-full ${color}`} />;
}
```

### `FeatureCard`
```tsx
function FeatureCard({ title, tag, description, colSpan, index }) {
  return (
    <motion.div
      className={`${colSpan} rounded-[22px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-colors hover:border-white/18 hover:bg-white/[0.05]`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="rounded-full border border-[#5de4c7]/20 bg-[#5de4c7]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9bf2df]">
        {tag}
      </span>
      <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-white/66">{description}</p>
    </motion.div>
  );
}
```

---

## データ定数

```ts
const stats = [
  { value: 3,  suffix: '秒', label: '住所入力→法規制取得' },
  { value: 5,  suffix: '種', label: '斜線制限を同時計算' },
  { value: 23, suffix: '区', label: 'PLATEAU東京全域対応' },
  { value: 0,  suffix: '円', label: '完全無料・登録不要' },
];

const features = [
  { title: '筆界ポリゴン\n自動取得', tag: 'AMX PMTiles', description: '法務省登記所備付地図（AMX PMTiles）活用。地図をクリックするだけで敷地形状を自動設定。手動入力不要。', colSpan: 'lg:col-span-7' },
  { title: '法規制を一括\n自動取得', tag: 'PLATEAU urf', description: 'PLATEAU都市計画MVTタイル連携で用途地域・高度地区・地区計画・防火地域を自動取得。上乗せ規制まで見落としゼロ。', colSpan: 'lg:col-span-5' },
  { title: '3D最大\nボリューム', tag: '法規制完全対応', description: '道路・隣地・北側斜線＋絶対高さ制限を考慮した最大形状をリアルタイム3D表示。', colSpan: 'lg:col-span-4' },
  { title: '事業性\n概算', tag: 'デベ向け', description: '用途を選ぶだけで建設費・利回り・収支を自動計算。', colSpan: 'lg:col-span-4' },
  { title: 'PDF帳票\n即出力', tag: '帳票出力', description: '事業検討レポートをPDFで出力。上司・クライアントにそのまま提出。', colSpan: 'lg:col-span-4' },
  { title: 'AIクイックアクション', tag: 'AI連携', description: '「何階建て可能？」「斜線制限は？」のワンクリックでGemini AIが計算結果を解説。複雑な法規制をわかりやすく。', colSpan: 'lg:col-span-12' },
];

const steps = [
  { step: '01', title: '住所を入力する', description: '調べたい土地の住所を入力。AMX PMTilesが筆界ポリゴンを自動取得し、敷地形状を即時設定します。' },
  { step: '02', title: '法規制を確認する', description: 'PLATEAUが用途地域・斜線制限・防火地域・地区計画を自動取得。手動調査ゼロで法規制を把握。' },
  { step: '03', title: 'ボリュームと収益性を確認する', description: '全ての斜線制限を考慮した最大建築ボリュームを3Dで表示。事業性概算もワンクリックで計算。' },
];

const audiences = [
  { title: '不動産デベロッパー', description: '仕入れ検討を週次から日次へ。初期スクリーニングの件数を増やしながら、精度の高い判断ラインを維持します。' },
  { title: '建築設計事務所', description: '初回提案に必要な規模感を即日把握。クライアントとの最初の打ち合わせから、根拠のある数字を持ち込めます。' },
  { title: '用地仕入れ担当者', description: '現地確認前にデスクで概要を掴む。移動前にGO/NOGOの仮判断ができ、優先順位をつけた動き方ができます。' },
];
```

---

## ビルド確認

```bash
pnpm build
# ✓ /lp が Static でビルドされること
```
