# CODEX_DESIGN_REFACTOR.md — VolumeCheck デザインルール準拠リファクタリング

## 背景

VolumeCheckのUIデザインレビューで以下の違反・改善点が見つかった。
本指示書に従い、デザインルール準拠 + catnose99 UI原則への整合を行う。

## CLAUDE.md参照

- UI設計原則12項目（全プロダクト共通）に従うこと
- 特に原則1（選択肢 > 自由入力）と原則5（チャットUIを安易に採用しない）を厳守

## 禁止事項（MEMORY design-rules.md）

1. AIグラデーション（青→紫）禁止 → **現状OK**
2. Interフォント禁止 → **現状OK**
3. Lucideアイコンのみの使用禁止 → **❌ 違反中**
4. shadcnデフォルトそのまま禁止 → **現状OK**

---

## Task 1: AiChat デザイントークン統一（最重大）

**ファイル**: `src/components/chat/AiChat.tsx`

### 問題

AiChatコンポーネントがアプリのデザイントークンを一切使わず、
ハードコードされたTailwind色（gray-*, blue-*）を使用。
アプリ全体は teal (#5de4c7) + dark navy (#0b0d10) で統一されているのに、
AiChatだけ青ベースで完全に浮いている。

### 変更内容

以下のクラス名を置換する:

| 現在 | 変更後 | 理由 |
|------|--------|------|
| `bg-gray-900` | `bg-card/95 backdrop-blur-sm` | アプリのsurface色に統一 |
| `bg-gray-800` | `bg-secondary` | shadcn token使用 |
| `border-gray-700` | `border-border` | アプリのborder token |
| `text-gray-400` | `text-muted-foreground` | アプリのmuted token |
| `text-gray-500` | `text-muted-foreground` | 同上 |
| `text-gray-300` | `text-foreground` | 同上 |
| `text-gray-200` | `text-foreground` | 同上 |
| `text-gray-100` | `text-foreground` | 同上 |
| `bg-blue-600` | `bg-primary` | ユーザーメッセージ → teal |
| `hover:bg-blue-700` | `hover:bg-primary/90` | 同上 |
| `hover:border-blue-500` | `hover:border-primary/60` | Quick Actionボタン |
| `hover:text-blue-400` | `hover:text-primary` | Quick Actionボタン |
| `focus:ring-blue-500` | `focus:ring-ring` | フォーカスリング |
| `focus:border-blue-500` | `focus:border-primary` | フォーカスボーダー |
| `placeholder-gray-500` | `placeholder:text-muted-foreground` | Tailwind v4構文 |

### ユーザーメッセージバブルの色

現在 `bg-blue-600 text-white` → `bg-primary/20 text-primary` に変更。
理由: ダーク背景に対してtealの半透明バブルの方がアプリの統一感が出る。
送信ボタンも `bg-blue-600` → `bg-primary text-primary-foreground` に。

### チャット履歴パネル

```
現在: bg-gray-900 border border-b-0 border-gray-700 rounded-t-lg
変更: bg-card/95 backdrop-blur-sm border border-b-0 border-border rounded-t-lg
```

### inputバー

現在のinput:
```
px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 text-gray-100 rounded-lg
focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500
```

変更後（shadcn Inputコンポーネントに置換推奨）:
```tsx
import { Input } from '@/components/ui/shadcn/input';
// ...
<Input
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
  placeholder="この敷地で3階建ては可能？"
  disabled={isLoading}
  className="flex-1 h-8 text-sm"
/>
```

### 送信ボタンもshadcn Buttonに置換

```tsx
import { Button } from '@/components/ui/shadcn/button';
// ...
<Button
  onClick={handleSubmit}
  disabled={isLoading || !input.trim()}
  size="sm"
  className="shrink-0"
>
  送信
</Button>
```

---

## Task 2: AiChat をチャットUIからインライン回答カードに変更

**ファイル**: `src/components/chat/AiChat.tsx`

### 問題

catnose99のUI原則5:「チャットUIを安易に採用しない」に違反。
VolumeCheckのAI機能は計算結果の補足説明が主で、対話の必要性が低い。
Quick Actionsボタン（「何階建て可能？」「斜線制限は？」「結果まとめ」）が
既にあるのに、フルチャットUIは過剰。

### 変更方針

チャットUIを廃止し、**Quick Action + インライン回答カード**に変更する。

#### 新しいUI構造

```
┌─────────────────────────────────┐
│  Quick Actions (横並びボタン)     │
│  [何階建て可能？] [斜線制限は？]  │
│  [結果まとめ]                    │
├─────────────────────────────────┤
│  回答カード（1件のみ表示）        │
│  ┌───────────────────────────┐  │
│  │ 回答テキスト               │  │
│  │ ...                       │  │
│  │ [コピー] [閉じる]          │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  自由質問入力（折りたたみ）       │
│  [入力欄] [送信]                │
└─────────────────────────────────┘
```

#### 実装詳細

1. `messages`配列は廃止。`currentAnswer: string | null`のみ管理
2. Quick Actionボタンをクリック → 即座に回答カードを表示
3. 回答カードは1件のみ（前の回答を上書き）
4. 自由質問入力は `<details>` or アコーディオンで折りたたみ
5. AIラベル「AI」は回答カード内に移動

#### Quick Actionボタンのスタイル

```tsx
<button
  onClick={() => handleQuickAction(action)}
  className="rounded-full border border-border px-2.5 py-1 text-[10px]
             text-muted-foreground hover:border-primary/60 hover:text-primary
             transition-colors whitespace-nowrap"
>
  {action}
</button>
```

#### 回答カードのスタイル

```tsx
{currentAnswer && (
  <div className="rounded-lg bg-card border border-border px-3 py-2.5 space-y-2">
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold text-primary">AI</span>
      <span className="text-[10px] text-muted-foreground">回答</span>
    </div>
    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
      {currentAnswer}
    </p>
    <div className="flex gap-1">
      <button
        onClick={() => navigator.clipboard.writeText(currentAnswer)}
        className="text-[10px] text-muted-foreground hover:text-foreground
                   px-2 py-0.5 rounded border border-border transition-colors"
      >
        コピー
      </button>
      <button
        onClick={() => setCurrentAnswer(null)}
        className="text-[10px] text-muted-foreground hover:text-foreground
                   px-2 py-0.5 rounded border border-border transition-colors"
      >
        閉じる
      </button>
    </div>
  </div>
)}
```

#### 自由質問の折りたたみ

```tsx
<details className="group">
  <summary className="text-[10px] text-muted-foreground cursor-pointer
                      hover:text-foreground transition-colors py-1">
    自由に質問する
  </summary>
  <div className="flex items-center gap-1.5 mt-1.5">
    <Input ... />
    <Button ... />
  </div>
</details>
```

### 既存の`tryLocalAnswer`関数は維持

ローカル回答ロジックはそのまま使う。APIフォールバックも維持。

---

## Task 3: アイコンライブラリ追加（ルール3対応）

### 問題

lucide-react のみ使用中。デザインルール「Lucideアイコンのみの使用禁止」に違反。

### 変更方針

**@phosphor-icons/react** を追加する。

理由:
- 軽量（tree-shakable）
- ダーク系UIと相性が良いDuotoneバリアント
- 日本のプロジェクトでも採用実績多数
- Lucideと共存しやすいサイズ感

### インストール

```bash
pnpm add @phosphor-icons/react
```

### 置換対象（全置換不要、混在させる）

以下のアイコンをPhosphorに置換する（アプリの個性を出すための選定）:

| 現在（Lucide） | 変更後（Phosphor） | コンポーネント | 理由 |
|---------------|-------------------|--------------|------|
| `Upload` | `UploadSimple` | FileUpload.tsx | ドロップゾーンの目立つアイコン |
| `FileDown` | `FilePdf` | ActionToolbar.tsx | PDF出力であることが明確 |
| `Save` | `FloppyDisk` | ActionToolbar.tsx | より特徴的 |
| `Box` | `Cube` | LayerPresetBar.tsx | 3Dボリュームを表すアイコン |
| `Sun` | `SunDim` | LayerPresetBar.tsx | 日影を表す（暗めのSun） |
| `BarChart3` | `ChartBar` | SidebarStepper.tsx | ステップ3（結果）のアイコン |

### 置換しない（Lucide維持）

- `Loader2`（スピナー: Lucideのアニメーションが優秀）
- `CheckCircle2`, `AlertTriangle`, `XCircle`（ステータスアイコン: 統一感維持）
- `PanelLeftClose`, `PanelLeft`（サイドバー操作: Lucide固有）
- `MapPin`, `Scale`（ステッパー: 汎用性重視）
- `Plus`, `Trash2`, `X`（CRUD操作: 慣習的）
- `ChevronDown`, `ChevronUp`, `Check`（shadcn内部: 変更不要）

### インポート例

```tsx
// Phosphor (weight指定でバリアント変更可能)
import { UploadSimple } from '@phosphor-icons/react';

// 使用時 — Lucideと同じようにh-/w-で制御
<UploadSimple className="h-5 w-5 text-muted-foreground" weight="duotone" />
```

**weight**: `"thin" | "light" | "regular" | "bold" | "fill" | "duotone"`
→ このアプリでは **`"regular"`** をベースに、強調時は **`"duotone"`** を使う。

---

## Task 4: `alert('保存しました')` の置換（軽微）

**ファイル**: `src/components/results/ActionToolbar.tsx` L40

### 問題

`alert()` はネイティブダイアログで、ダークテーマのUIと不一致。
catnose99原則7「派手より楽」に反する（モーダルでブロッキング）。

### 変更方針

保存成功時にトースト的な一時表示に変更。
新規ライブラリ追加は避け、useState + setTimeout で実装。

```tsx
const [saved, setSaved] = useState(false);

const handleSave = useCallback(() => {
  if (!site || !zoning || !roads) return;
  saveProject({ site, roads, zoning, latitude, floorHeights, savedAt: '' });
  setSaved(true);
  setTimeout(() => setSaved(false), 2000);
}, [site, roads, zoning, latitude, floorHeights]);

// ボタン部分
<Button
  onClick={handleSave}
  disabled={!site || !zoning || saved}
  variant="secondary"
  size="sm"
  className="flex-1"
>
  {saved ? (
    <>
      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
      保存済み
    </>
  ) : (
    <>
      <FloppyDisk className="h-3.5 w-3.5 mr-1" weight="regular" />
      保存
    </>
  )}
</Button>
```

---

## 完了条件

1. `pnpm build` が成功すること
2. `pnpm test` が全テスト PASS すること（既存テストが壊れないこと）
3. AiChat.tsx 内に `gray-`, `blue-` のTailwindクラスが**ゼロ**であること
4. `@phosphor-icons/react` が `package.json` に追加されていること
5. `lucide-react` と `@phosphor-icons/react` の両方が import されているファイルが最低1つ存在すること
6. AiChat.tsx にチャット履歴（messages配列の`.map`によるメッセージリスト描画）が存在しないこと
7. `alert(` がソースコード内に存在しないこと（テストファイル除く）

## 作業順序

1. Task 3（Phosphorインストール + アイコン置換）→ ビルド確認
2. Task 1（AiChat デザイントークン統一）→ ビルド確認
3. Task 2（AiChat チャットUI→インラインカード変換）→ ビルド確認
4. Task 4（alert置換）→ 最終ビルド + テスト

## 注意事項

- `cn()` ユーティリティ（`src/lib/cn.ts`）を活用してクラス結合すること
- shadcnコンポーネント（`src/components/ui/shadcn/`）を積極的に使うこと
- Tailwind CSS v4 を使用中。`@apply` は非推奨、直接クラスを書くこと
- フォント変更は不要（Space Grotesk + Noto Sans JP + JetBrains Mono で確定）
- 既存のデザイントークン（globals.css の `--app-*` 変数）を尊重すること
