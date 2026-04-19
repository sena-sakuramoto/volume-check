export const VOLANS_BRAND = {
  name: 'VOLANS',
  tagline: '最大ボリュームを、一瞬で。',
} as const;

export const VOLANS_DEMO = {
  projectName: '新宿区西新宿3丁目計画',
  updatedAt: '2026/04/17 14:30',
  site: {
    address: '東京都新宿区西新宿3丁目',
    area: 1024.35,
    shape: '多角形 (4点)',
    zoningName: '商業地域',
    coverageRatio: 80,
    floorAreaRatio: 600,
    road: { side: '北側', kind: '公道', width: 16.0 },
    heightDistrict: '第2種高度地区',
    fireDistrict: '防火地域',
  },
  summary: {
    slant: { floorArea: 5420.18, floors: 8, coverage: 31.2, farRatio: 91.2 },
    sky: { floorArea: 6712.45, floors: 10, coverage: 37.5, farRatio: 100.0 },
    diff: { floorArea: 1292.27, floors: 2, pct: 23.8 },
  },
  skyCheck: {
    type: '道路斜線(反対側境界)',
    index: 3,
    total: 12,
    value: 0.612,
    baseline: 0.586,
    margin: 0.026,
    marginPct: 2.6,
  },
  checks: [
    { label: '建ぺい率', ok: true },
    { label: '容積率', ok: true },
    { label: '道路斜線', ok: true, note: '(天空率)' },
    { label: '隣地斜線', ok: true, note: '(天空率)' },
    { label: '北側斜線', ok: true, note: '(天空率)' },
    { label: '日影規制', ok: true },
    { label: '絶対高さ', ok: true },
  ] as Array<{ label: string; ok: boolean; note?: string }>,
  quickActions: [
    {
      id: 'ai-plan',
      title: 'AIに計画提案を依頼',
      sub: '用途・容積等から建物案を提案',
    },
    {
      id: 'pattern-add',
      title: 'パターンを追加検討',
      sub: '現在案を編集して比較案に追加',
    },
    {
      id: 'doc-gen',
      title: '計算書・説明文を生成',
      sub: '判定結果の説明文案をAIで生成',
    },
  ],
  patterns: [
    {
      id: 'slant',
      name: '斜線案 (現行)',
      floorArea: 5420.18,
      floors: 8,
      farRatio: 91.2,
      tone: 'slant' as const,
    },
    {
      id: 'sky',
      name: '天空率案 (推奨)',
      floorArea: 6712.45,
      floors: 10,
      farRatio: 100.0,
      tone: 'sky' as const,
      recommended: true,
    },
    {
      id: 'pattern-c',
      name: 'パターン C (比較案)',
      floorArea: 6102.30,
      floors: 9,
      farRatio: 95.1,
      tone: 'neutral' as const,
    },
  ],
  footerNote:
    '天空率計算は平成14年 国交省告示 第1350号に基づく方法で算定しています。',
  feedbackLink: '精度向上のためのフィードバックを送る',
};

export const STEP_LABELS = [
  { id: 1, label: '敷地入力' },
  { id: 2, label: '法規・条件' },
  { id: 3, label: '解析・結果' },
];
