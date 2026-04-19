import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  Upload,
  MapPin,
  FileText,
  Building2,
  Zap,
  Smartphone,
} from 'lucide-react';
import { VolansLogo } from '@/components/volans/VolansLogo';

export const metadata = {
  title: 'VOLANS — 最大ボリュームを、一瞬で。',
  description:
    '斜線制限 と 天空率緩和 を並置比較し、敷地から建てられる最大ボリュームを一瞬で提示する建築ボリューム AI ツール',
};

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--volans-bg, #f6f7fb)',
        color: 'var(--volans-text, #1c2230)',
        fontFamily: 'var(--font-body), "Noto Sans JP", sans-serif',
      }}
    >
      <Header />
      <Hero />
      <ValuePoints />
      <Flow />
      <Stack />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header
      className="flex h-14 items-center justify-between px-6"
      style={{
        background: 'var(--volans-surface, #ffffff)',
        borderBottom: '1px solid var(--volans-border, #e5e9f0)',
      }}
    >
      <VolansLogo size={32} />
      <div className="flex items-center gap-3">
        <Link
          href="/sky"
          className="flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium text-white"
          style={{ background: 'var(--volans-primary, #3b6de1)' }}
        >
          ツールを開く
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="flex flex-col items-center px-6 py-20 text-center">
      <div
        className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
        style={{
          background: 'var(--volans-primary-soft, #e4ecff)',
          color: 'var(--volans-primary-strong, #2b57bf)',
        }}
      >
        <Sparkles className="h-3 w-3" />
        中高層ボリューム検討を、一瞬で
      </div>
      <h1
        className="max-w-3xl text-[44px] font-bold leading-[1.2] tracking-tight"
        style={{ color: 'var(--volans-text, #1c2230)' }}
      >
        斜線制限の海から、
        <br />
        最大ボリュームの空へ。
      </h1>
      <p
        className="mt-4 max-w-2xl text-[15px] leading-relaxed"
        style={{ color: 'var(--volans-muted, #6b7280)' }}
      >
        VOLANS は 斜線制限 と 天空率緩和（建基法 56条7項）を自動で並置比較し、
        <br />
        敷地から実際に建てられる最大延床と階数を即時提示する建築ボリューム AI ツールです。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/sky"
          className="flex items-center gap-2 rounded-lg px-6 py-3 text-[14px] font-semibold text-white"
          style={{ background: 'var(--volans-primary, #3b6de1)' }}
        >
          今すぐ試す
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/m"
          className="flex items-center gap-2 rounded-lg px-5 py-3 text-[14px] font-medium"
          style={{
            background: 'var(--volans-surface, #ffffff)',
            border: '1px solid var(--volans-border-strong, #d0d6e1)',
            color: 'var(--volans-text, #1c2230)',
          }}
        >
          <Smartphone className="h-4 w-4" />
          モバイル版
        </Link>
      </div>

      {/* Mini hero metrics card */}
      <div
        className="mt-14 grid w-full max-w-3xl grid-cols-3 gap-3 rounded-2xl p-6"
        style={{
          background: 'var(--volans-surface, #ffffff)',
          border: '1px solid var(--volans-border, #e5e9f0)',
          boxShadow: '0 10px 30px rgba(28,34,48,0.06)',
        }}
      >
        <Metric label="斜線案 延床" value="5,420㎡" tone="slant" />
        <Metric label="天空率案 延床" value="6,712㎡" tone="sky" />
        <Metric label="増加分" value="+23.8%" tone="diff" />
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'slant' | 'sky' | 'diff' }) {
  const bg =
    tone === 'slant'
      ? 'var(--volans-sky-slant-soft, #e4ecff)'
      : tone === 'sky'
        ? 'var(--volans-sky-relax-soft, #e7f5ee)'
        : 'var(--volans-warning-soft, #fff0e0)';
  const fg =
    tone === 'slant'
      ? 'var(--volans-sky-slant, #5d86d9)'
      : tone === 'sky'
        ? 'var(--volans-sky-relax, #3eb883)'
        : 'var(--volans-warning, #f19342)';
  return (
    <div className="flex flex-col gap-1 rounded-xl p-4" style={{ background: bg }}>
      <span className="text-[10px] font-medium" style={{ color: 'var(--volans-muted, #6b7280)' }}>
        {label}
      </span>
      <span className="text-[22px] font-semibold tabular-nums" style={{ color: fg }}>
        {value}
      </span>
    </div>
  );
}

function ValuePoints() {
  const items = [
    {
      icon: Zap,
      title: '住所1つで全自動',
      body: '地番・用途地域・接道道路まで国交省 / 国土地理院 / OSM を横断取得。手入力ゼロで 3D と数値を即生成。',
    },
    {
      icon: Sparkles,
      title: '本物の天空率エンジン',
      body: '測定点生成 → レイトレース → binary-search で 56条7項の緩和限界を探索。固定の推定値ではなく実計算。',
    },
    {
      icon: Upload,
      title: '住所 / CAD / 測量図 すべて対応',
      body: '住所検索、.dxf 辺クリック分類、画像/PDF の Gemini Vision OCR、3 経路すべて同じ結果に収束。',
    },
  ];
  return (
    <section
      className="px-6 py-16"
      style={{
        background: 'var(--volans-surface, #ffffff)',
        borderTop: '1px solid var(--volans-border, #e5e9f0)',
        borderBottom: '1px solid var(--volans-border, #e5e9f0)',
      }}
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-[26px] font-semibold">
          VOLANS が手に入るもの
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.title}
                className="flex flex-col gap-3 rounded-2xl p-6"
                style={{
                  background: 'var(--volans-surface-alt, #fbfcfe)',
                  border: '1px solid var(--volans-border, #e5e9f0)',
                }}
              >
                <div
                  className="grid h-10 w-10 place-items-center rounded-lg"
                  style={{
                    background: 'var(--volans-primary-soft, #e4ecff)',
                    color: 'var(--volans-primary-strong, #2b57bf)',
                  }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-[16px] font-semibold">{it.title}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--volans-muted, #6b7280)' }}>
                  {it.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Flow() {
  const steps = [
    { icon: MapPin, label: '住所を入れる' },
    { icon: Building2, label: '敷地と法規が自動で埋まる' },
    { icon: Sparkles, label: '天空率で最大化' },
    { icon: FileText, label: 'PDF で出力' },
  ];
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-[26px] font-semibold">4 ステップ</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="flex flex-col items-center gap-3 rounded-xl p-5 text-center"
                style={{
                  background: 'var(--volans-surface, #ffffff)',
                  border: '1px solid var(--volans-border, #e5e9f0)',
                }}
              >
                <div
                  className="grid h-9 w-9 place-items-center rounded-full text-white"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--volans-primary, #3b6de1) 0%, var(--volans-sky-relax, #3eb883) 100%)',
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div
                  className="text-[10px] font-semibold"
                  style={{ color: 'var(--volans-muted, #6b7280)' }}
                >
                  STEP {i + 1}
                </div>
                <div className="text-[14px] font-medium">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Stack() {
  return (
    <section
      className="px-6 py-16"
      style={{
        background: 'var(--volans-surface, #ffffff)',
        borderTop: '1px solid var(--volans-border, #e5e9f0)',
      }}
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-[22px] font-semibold">計算根拠</h2>
        <p
          className="mx-auto mt-4 max-w-2xl text-[13px] leading-relaxed"
          style={{ color: 'var(--volans-muted, #6b7280)' }}
        >
          天空率計算は平成14年 国交省告示 第1350号に基づく算定。
          <br />
          地番データ: 国土交通省（pmtiles）/ 農研。用途地域: 国土数値情報。
          <br />
          接道道路: OpenStreetMap (Overpass API) / 国土地理院。
          <br />
          周辺建物: OpenStreetMap `building=*` の LOD1 相当。
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="flex items-center justify-between px-6 py-6 text-[11px]"
      style={{
        background: 'var(--volans-surface, #ffffff)',
        borderTop: '1px solid var(--volans-border, #e5e9f0)',
        color: 'var(--volans-muted, #6b7280)',
      }}
    >
      <span>© 2026 Archi Prisma Design works</span>
      <div className="flex items-center gap-4">
        <Link href="/sky" style={{ color: 'var(--volans-primary, #3b6de1)' }}>
          ツール
        </Link>
        <Link href="/m" style={{ color: 'var(--volans-primary, #3b6de1)' }}>
          モバイル
        </Link>
      </div>
    </footer>
  );
}
