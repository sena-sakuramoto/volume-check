'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderOpen,
  FilePlus,
  Layers,
  BarChart3,
  GitCompare,
  MessageCircleQuestion,
  Sparkles,
  FileScan,
  Database,
  Cable,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useVolansStore } from '@/stores/useVolansStore';
import { useProjectsStore } from '@/stores/useProjectsStore';

type Item = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  /** scroll to this DOM id on the current page (opt-in highlight) */
  scrollTo?: string;
  /** custom action when the item has no href */
  action?: 'new-project' | 'settings' | 'tutorial';
};
type Section = { heading: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    heading: '',
    items: [
      { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard, href: '/sky' },
    ],
  },
  {
    heading: 'プロジェクト',
    items: [
      { id: 'project-list', label: 'プロジェクト一覧', icon: FolderOpen, href: '/m/compare' },
      { id: 'project-new', label: '新規プロジェクト', icon: FilePlus, action: 'new-project' },
      { id: 'project-template', label: 'テンプレート', icon: Layers, href: '/m/input' },
    ],
  },
  {
    heading: '解析',
    items: [
      { id: 'volume', label: 'ボリューム検討', icon: BarChart3, href: '/sky' },
      { id: 'sky', label: '天空率チェック', icon: Sparkles, href: '/sky', scrollTo: 'volans-sky-check' },
      { id: 'compare', label: 'パターン比較', icon: GitCompare, href: '/m/compare' },
    ],
  },
  {
    heading: 'AIアシスタント',
    items: [
      { id: 'ai-qa', label: '法規Q&A', icon: MessageCircleQuestion, href: '/m/ai' },
      { id: 'ai-plan', label: '計画提案', icon: Sparkles, href: '/m/ai' },
      { id: 'ai-ocr', label: '図面読み取り (AI)', icon: FileScan, href: '/m/input' },
    ],
  },
  {
    heading: 'データ',
    items: [
      { id: 'site-data', label: '敷地・法規データ', icon: Database, href: '/m/input' },
      { id: 'ext', label: '外部データ連携', icon: Cable, href: '/m/input' },
    ],
  },
];

const BOTTOM: Item[] = [
  { id: 'tutorial', label: 'チュートリアル', icon: GraduationCap, href: '/' },
  { id: 'settings', label: '設定・ヘルプ', icon: Settings, action: 'settings' },
];

export function LeftNav() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  function handleAction(action: Item['action']) {
    if (action === 'new-project') {
      useProjectsStore.setState({ activeId: null });
      useVolansStore.setState({
        projectName: '新規プロジェクト',
        skyMaxScale: null,
        skyWorstMargin: null,
        skyOptimizedAt: null,
        parcelCandidates: [],
        selectedParcelIndex: -1,
        updatedAt: new Date().toISOString(),
      });
      router.push('/m/input');
    } else if (action === 'settings') {
      alert('設定・ヘルプは準備中です');
    }
  }

  function scrollIntoView(id: string) {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.outline = '2px solid var(--volans-primary)';
      setTimeout(() => {
        el.style.outline = '';
      }, 1600);
    }
  }

  function renderItem(item: Item) {
    const Icon = item.icon;
    const isActive =
      (item.href && pathname === item.href) ||
      (item.scrollTo && pathname === item.href);
    const style = {
      background: isActive ? 'var(--volans-primary-soft)' : 'transparent',
      color: isActive ? 'var(--volans-primary-strong)' : 'var(--volans-text-soft)',
      fontWeight: isActive ? 600 : 400,
    } as const;
    const className =
      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition hover:bg-slate-50';
    const content = (
      <>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </>
    );

    if (item.href) {
      return (
        <Link
          key={item.id}
          href={item.href}
          onClick={() => {
            if (item.scrollTo) setTimeout(() => scrollIntoView(item.scrollTo!), 100);
          }}
          className={className}
          style={style}
          title={collapsed ? item.label : undefined}
        >
          {content}
        </Link>
      );
    }
    return (
      <button
        key={item.id}
        onClick={() => handleAction(item.action)}
        className={className}
        style={style}
        title={collapsed ? item.label : undefined}
      >
        {content}
      </button>
    );
  }

  return (
    <aside
      className="flex shrink-0 flex-col py-3"
      style={{
        width: collapsed ? 56 : 220,
        background: 'var(--volans-surface)',
        borderRight: `1px solid var(--volans-border)`,
        transition: 'width 160ms ease',
      }}
    >
      <div className="flex flex-col gap-4 px-2">
        {SECTIONS.map((s) => (
          <div key={s.heading || 'root'} className="flex flex-col gap-0.5">
            {!collapsed && s.heading && (
              <div
                className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--volans-muted)' }}
              >
                {s.heading}
              </div>
            )}
            {s.items.map((item) => renderItem(item))}
          </div>
        ))}
      </div>

      <div
        className="mt-auto flex flex-col gap-0.5 px-2 pt-3"
        style={{ borderTop: `1px solid var(--volans-border)` }}
      >
        {BOTTOM.map((item) => renderItem(item))}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mt-1 flex items-center justify-center rounded-md px-2.5 py-1.5 text-[11px]"
          style={{ color: 'var(--volans-muted)' }}
          aria-label="サイドバー折りたたみ"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>
    </aside>
  );
}
