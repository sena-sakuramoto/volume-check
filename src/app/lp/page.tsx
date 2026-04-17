'use client';

import ElectricBorder from '@/components/ui/ElectricBorder';
import GhostCursor from '@/components/ui/GhostCursor';
import GridDistortion from '@/components/ui/GridDistortion';
import MagicBento from '@/components/ui/MagicBento';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import PillNav from '@/components/ui/PillNav';

const GridScan = dynamic(() => import('@/components/ui/GridScan'), { ssr: false });

const navItems = [
  { href: '#hero', label: '概要' },
  { href: '#product', label: '機能' },
  { href: '#features', label: '特長' },
  { href: '#zones', label: '用途地域' },
  { href: '#flow', label: '使い方' },
];

const trustBadges = [
  '用地仕入れ',
  '事業性検討',
  '設計初期',
  'AM/PM業務',
  '都市リサーチ',
];

const featureCards = [
  {
    number: '01',
    title: '住所入力から法規制確認まで、ワンステップ',
    description:
      '住所を入力するだけで、用途地域・建ぺい率・容積率・防火指定を一画面に集約。初動の確認時間を大幅に削減します。',
    points: ['住所候補を補完', '法規制を一覧化', '確認漏れを防止'],
  },
  {
    number: '02',
    title: '法規制を踏まえたボリューム検討',
    description:
      '斜線制限と道路条件を反映し、最大延床面積の目安を初期段階で可視化します。',
    points: ['高さ制限を自動反映', '延床面積を即確認', '社内協議の前提を統一'],
  },
  {
    number: '03',
    title: '社内検討をすぐ始められる状態に',
    description:
      '複数案件の比較に必要な要点を整理し、次に進めるべき案件の見極めを加速します。',
    points: ['比較の軸を整理', '社内共有に転用', '判断速度を向上'],
  },
];

const zones = [
  { name: '第一種低層住居専用地域', type: '住居系', ratio: '50 / 100' },
  { name: '第二種低層住居専用地域', type: '住居系', ratio: '60 / 150' },
  { name: '第一種中高層住居専用地域', type: '住居系', ratio: '60 / 200' },
  { name: '第二種中高層住居専用地域', type: '住居系', ratio: '60 / 200' },
  { name: '第一種住居地域', type: '住居系', ratio: '60 / 200' },
  { name: '第二種住居地域', type: '住居系', ratio: '60 / 200' },
  { name: '準住居地域', type: '住居系', ratio: '60 / 200' },
  { name: '田園住居地域', type: '住居系', ratio: '50 / 100' },
  { name: '近隣商業地域', type: '商業系', ratio: '80 / 300' },
  { name: '商業地域', type: '商業系', ratio: '80 / 400' },
  { name: '準工業地域', type: '工業系', ratio: '60 / 200' },
  { name: '工業地域', type: '工業系', ratio: '60 / 200' },
  { name: '工業専用地域', type: '工業系', ratio: '60 / 200' },
  { name: '用途地域未指定', type: '地域外', ratio: '個別判断' },
  { name: '特別用途地区重畳', type: '重畳', ratio: '地方規定' },
];

const steps = [
  {
    step: '01',
    title: '入力',
    description: '住所を入れるだけで対象地の初期条件を読み込みます。',
  },
  {
    step: '02',
    title: '確認',
    description: '用途地域と高さ制限を整理し、建築可能なボリュームの目安を算出します。',
  },
  {
    step: '03',
    title: '判断',
    description: '案件比較に必要な情報を整理し、次のアクションにつなげます。',
  },
];

const footerColumns = [
  {
    title: 'プロダクト',
    links: [
      { label: '概要', href: '#hero' },
      { label: '特長', href: '#features' },
      { label: '用途地域', href: '#zones' },
    ],
  },
  {
    title: 'ユースケース',
    links: [
      { label: 'デベロッパー', href: '#trust' },
      { label: '用地取得', href: '#trust' },
      { label: '計画', href: '#product' },
    ],
  },
  {
    title: 'アクション',
    links: [
      { label: 'アプリを開く', href: '/project' },
      { label: '試してみる', href: '#cta' },
      { label: '使い方', href: '#flow' },
    ],
  },
  {
    title: '会社情報',
    links: [
      { label: 'VolumeCheck', href: '/lp' },
      { label: 'お問い合わせ', href: '#cta' },
      { label: 'トップ', href: '#hero' },
    ],
  },
];

function SectionEyebrow({ children }: { children: string }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#666666]">
      {children}
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <header className="sticky top-0 z-50 border-b border-[#e5e5e5]/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1350px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <PillNav
            logoText="VC"
            logoHref="/lp"
            items={navItems}
            baseColor="#111111"
            pillColor="#f0f0f0"
            pillTextColor="#111111"
            hoveredPillTextColor="#f0f0f0"
            ease="power3.easeOut"
          />
          <Link
            href="/project"
            className="inline-flex items-center justify-center rounded-full border border-black bg-black px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#222222]"
          >
            VolumeCheckを開く
          </Link>
        </div>
      </header>

      <section id="hero" className="relative flex min-h-screen flex-col overflow-hidden bg-[#eef9ff] pt-16">
        <GhostCursor
          color="#06b6d4"
          brightness={1.2}
          trailLength={50}
          inertia={0.5}
          bloomStrength={0.15}
          bloomRadius={1.0}
          bloomThreshold={0.025}
          grainIntensity={0.04}
          mixBlendMode="darken"
          zIndex={2}
        />
        <div className="absolute inset-0 z-[1]">
          <GridScan
            linesColor="#7dd3fc"
            scanColor="#38bdf8"
            scanOpacity={0.35}
            gridScale={0.12}
            lineThickness={1.0}
            lineJitter={0.3}
            enablePost={false}
            bloomIntensity={0}
            bloomThreshold={1.0}
            bloomSmoothing={0}
            chromaticAberration={0}
            noiseIntensity={0}
            scanDuration={2.0}
            scanDelay={1.5}
          />
        </div>
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#0891b2]">
            建築用地スクリーニング
          </p>
          <h1 className="mb-6 text-5xl font-bold leading-tight text-[#0f172a] sm:text-6xl lg:text-7xl" style={{ textShadow: '0 0 40px rgba(255,255,255,0.9), 0 2px 8px rgba(255,255,255,0.8)' }}>
            用地ボリューム、秒で掴む。
          </h1>
          <p className="mb-10 max-w-md text-sm leading-relaxed text-[#334155]" style={{ textShadow: '0 1px 4px rgba(255,255,255,0.9)' }}>
            住所を入れるだけ。用途地域・斜線制限・最大延床面積を自動取得し、一画面に集約。
          </p>
          <ElectricBorder
            color="#06b6d4"
            speed={1.2}
            chaos={0.14}
            thickness={1.5}
            style={{ display: 'inline-block', borderRadius: 9999 }}
          >
            <Link
              href="/project"
              className="inline-block rounded-full bg-black px-8 py-3.5 font-semibold text-white transition-colors hover:bg-[#222222]"
            >
              今すぐ開始 →
            </Link>
          </ElectricBorder>
        </div>
      </section>

      <section id="trust" className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-[1350px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm uppercase tracking-[0.2em] text-[#666666]">こんな業務に使われています</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {trustBadges.map((badge, i) => (
                <div
                  key={badge}
                  className="trust-badge rounded-full border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 text-center text-sm font-medium text-[#333333] transition-all duration-300 hover:scale-105 hover:border-[#B497CF]/60 hover:bg-white hover:shadow-[0_0_16px_rgba(180,151,207,0.35)] hover:text-[#111]"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {badge}
                </div>
              ))}
            </div>
          </div>
        </div>
        <style>{`
          @keyframes trustFadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .trust-badge {
            opacity: 0;
            animation: trustFadeUp 0.5s ease forwards;
          }
        `}</style>
      </section>

      <section id="product" className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto grid max-w-[1350px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <SectionEyebrow>プロダクト紹介</SectionEyebrow>
            <h2 className="mt-5 tracking-[-0.03em] text-black">
              <span className="block text-2xl font-medium text-[#777777] sm:text-3xl">
                法規制の確認からボリューム検討、<br />社内共有まで。
              </span>
              <span className="mt-1 block text-4xl font-semibold sm:text-5xl">
                一画面で完結。
              </span>
            </h2>
          </div>

          <div className="grid gap-4">
            <p className="max-w-[42rem] text-base leading-8 text-[#555555]">
              用地検討に必要な情報は複数のサイトに散在しています。VolumeCheckは敷地条件と法規制を一画面に集約し、机上ボリュームスタディの時間を短縮。そのまま社内共有できる状態に仕上げます。
            </p>
            <MagicBento
              items={[
                { label: '入力', title: '住所', body: '住所起点で検討を始められます。' },
                { label: '取得', title: '法規制', body: '用途地域・建ぺい率・容積率・防火指定を自動取得。' },
                { label: '算出', title: 'ボリューム', body: '最大延床面積の目安をすぐ掴めます。' },
              ]}
              glowColor="132, 0, 255"
              enableSpotlight={true}
              enableBorderGlow={true}
              enableStars={true}
              enableTilt={true}
              enableMagnetism={true}
              clickEffect={true}
              spotlightRadius={200}
              particleCount={6}
              gridClassName="md:grid-cols-3"
            />
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-[1350px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <SectionEyebrow>3つのコア機能</SectionEyebrow>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
                タブを閉じて、判断を速く。
              </h2>
            </div>
            <p className="max-w-[32rem] text-sm leading-7 text-[#555555]">
              検討画面がそのまま社内共有の資料になる。再編集は不要。
            </p>
          </div>

          <div className="mt-10">
            <MagicBento
              items={featureCards.map(c => ({ label: c.number, title: c.title, body: c.description }))}
              glowColor="13, 148, 136"
              enableSpotlight={true}
              enableBorderGlow={true}
              enableStars={false}
              enableTilt={true}
              enableMagnetism={true}
              clickEffect={true}
              spotlightRadius={240}
              particleCount={8}
              gridClassName="lg:grid-cols-3"
            />
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/project"
              className="inline-flex items-center justify-center rounded-full border border-black bg-black px-8 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#222222]"
            >
              今すぐ試してみる →
            </Link>
          </div>
        </div>
      </section>

      <section id="zones" className="border-b border-[#e5e5e5] bg-[#fafafa]">
        <div className="mx-auto max-w-[1350px] px-4 py-20 text-center sm:px-6 lg:px-8">
          <SectionEyebrow>対応用途地域</SectionEyebrow>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
            全13用途地域に対応。
          </h2>
          <p className="mx-auto mt-5 max-w-[36rem] text-sm leading-7 text-[#555555]">
            住居系8区分・商業系2区分・工業系3区分の全13用途地域に加え、用途地域の指定のない区域や特別用途地区の重畳にも対応。建ぺい率・容積率を自動で紐づけます。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {zones.map((z) => (
              <span
                key={z.name}
                className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs text-[#555555]"
              >
                {z.name}
              </span>
            ))}
          </div>
          <Link
            href="/project"
            className="mt-10 inline-flex items-center justify-center rounded-full border border-black bg-black px-8 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#222222]"
          >
            今すぐ試してみる →
          </Link>
        </div>
      </section>

      <section id="flow" className="border-b border-[#e5e5e5] bg-white text-black">
        <div className="mx-auto max-w-[1350px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <SectionEyebrow>3ステップ</SectionEyebrow>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
                住所入力から判断まで、3ステップ。
              </h2>
            </div>
            <p className="max-w-[34rem] text-sm leading-7 text-[#555555]">
              土地勘がなくても、敷地の概要をすぐ把握できます。
            </p>
          </div>

          <div className="mt-10">
            <MagicBento
              items={steps.map(s => ({ label: s.step, title: s.title, body: s.description }))}
              glowColor="13, 148, 136"
              enableSpotlight={true}
              enableBorderGlow={true}
              enableStars={false}
              enableTilt={true}
              enableMagnetism={true}
              clickEffect={true}
              spotlightRadius={260}
              particleCount={10}
              gridClassName="lg:grid-cols-3"
            />
          </div>
        </div>
      </section>

      <section id="cta" className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-[1350px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-[16px] border border-[#cccccc] bg-[#fafafa] px-6 py-10 sm:px-8 lg:flex lg:items-end lg:justify-between">
            <div>
              <SectionEyebrow>はじめる</SectionEyebrow>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
                次の用地検討を、今すぐ始めよう。
              </h2>
            </div>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row lg:mt-0">
              <ElectricBorder
                color="#7df9ff"
                speed={1.0}
                chaos={0.1}
                thickness={1.2}
                style={{ display: 'inline-block', borderRadius: 9999 }}
              >
                <Link
                  href="/project"
                  className="inline-flex items-center justify-center rounded-full border border-black bg-black px-6 py-4 text-sm font-semibold text-white"
                >
                  VolumeCheckを開く
                </Link>
              </ElectricBorder>
              <a
                href="#hero"
                className="inline-flex items-center justify-center rounded-full border border-[#cccccc] px-6 py-4 text-sm font-semibold text-black"
              >
                トップへ戻る
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto max-w-[1350px] px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 border-t border-[#e5e5e5] pt-10 md:grid-cols-2 xl:grid-cols-[1.2fr_repeat(3,1fr)]">
            <div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black text-sm font-semibold">
                  VC
                </span>
                <span className="text-sm font-semibold tracking-[0.08em]">VolumeCheck</span>
              </div>
              <p className="mt-5 max-w-[24rem] text-sm leading-7 text-[#555555]">
                法規制の確認からボリューム算出まで、用地検討の初動を加速するツール。
              </p>
            </div>

            {footerColumns.map((column) => (
              <div key={column.title}>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#666666]">{column.title}</div>
                <div className="mt-5 grid gap-3">
                  {column.links.map((link) => (
                    <a key={link.label} href={link.href} className="text-sm text-[#555555] transition-colors hover:text-black">
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
