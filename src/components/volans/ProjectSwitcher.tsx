'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, FolderOpen, Plus, Copy, Trash2, Check, Cloud, CloudOff } from 'lucide-react';
import { useProjectsStore, type ProjectSnapshot } from '@/stores/useProjectsStore';
import { useVolansStore, formatUpdatedAt } from '@/stores/useVolansStore';
import { useCloudProjects } from '@/hooks/useCloudProjects';

export function ProjectSwitcher() {
  const [open, setOpen] = useState(false);
  const projects = useProjectsStore((s) => s.projects);
  const activeId = useProjectsStore((s) => s.activeId);
  const store = useVolansStore();
  const activeName = store.projectName;
  const cloud = useCloudProjects();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Merge cloud and local projects, dedupe by id (cloud wins for updatedAt).
  const merged = useMemo(() => {
    const map = new Map<string, ProjectSnapshot & { inCloud: boolean; inLocal: boolean }>();
    for (const p of projects) {
      map.set(p.id, { ...p, inCloud: false, inLocal: true });
    }
    for (const p of cloud.cloudProjects) {
      const existing = map.get(p.id);
      if (existing) {
        const newer = Date.parse(p.updatedAt) > Date.parse(existing.updatedAt) ? p : existing;
        map.set(p.id, { ...newer, inCloud: true, inLocal: true });
      } else {
        map.set(p.id, { ...p, inCloud: true, inLocal: false });
      }
    }
    return [...map.values()].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  }, [projects, cloud.cloudProjects]);

  function snapshot() {
    return {
      projectName: store.projectName,
      address: store.address,
      lat: store.lat,
      lng: store.lng,
      site: store.site,
      roads: store.roads,
      zoning: store.zoning,
      latitude: store.latitude,
      floorHeights: store.floorHeights,
      skyMaxScale: store.skyMaxScale,
      skyWorstMargin: store.skyWorstMargin,
      skyOptimizedAt: store.skyOptimizedAt,
      updatedAt: store.updatedAt,
    };
  }

  async function onSave() {
    setSyncError(null);
    const saved = useProjectsStore.getState().save(snapshot());
    if (cloud.cloudReady) {
      setSyncing(true);
      const result = await cloud.saveToCloud(saved);
      setSyncing(false);
      if (!result.ok && result.error) setSyncError(result.error);
    }
  }

  function onNew() {
    // Save current if unsaved, then reset to a blank new project.
    if (!activeId) onSave();
    useProjectsStore.setState({ activeId: null });
    useVolansStore.setState({
      projectName: '新規プロジェクト',
      lastRunAt: null,
      skyMaxScale: null,
      skyWorstMargin: null,
      skyOptimizedAt: null,
      parcelCandidates: [],
      selectedParcelIndex: -1,
      updatedAt: new Date().toISOString(),
    });
    setOpen(false);
  }

  function onLoad(p: ProjectSnapshot) {
    const { id: _id, createdAt: _c, ...rest } = p;
    void _id;
    void _c;
    useVolansStore.getState().loadSnapshot(rest);
    // Ensure local mirror exists so further edits persist offline.
    const local = useProjectsStore.getState().projects.find((lp) => lp.id === p.id);
    if (!local) {
      useProjectsStore.setState((s) => ({ projects: [p, ...s.projects] }));
    }
    useProjectsStore.setState({ activeId: p.id });
    setOpen(false);
  }

  function onDuplicate(p: ProjectSnapshot, e: React.MouseEvent) {
    e.stopPropagation();
    useProjectsStore.getState().duplicate(p.id);
  }

  async function onRemove(p: ProjectSnapshot, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`プロジェクト「${p.projectName}」を削除しますか？`)) return;
    useProjectsStore.getState().remove(p.id);
    if (cloud.cloudReady) await cloud.removeFromCloud(p.id);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
        style={{
          background: 'var(--volans-surface)',
          border: `1px solid var(--volans-border-strong)`,
          color: 'var(--volans-text)',
        }}
      >
        <FolderOpen className="h-3 w-3" />
        <span className="max-w-[140px] truncate">
          {activeId ? activeName : '(未保存)'}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-[300px] rounded-xl p-2 shadow-lg"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border-strong)`,
          }}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={onSave}
              disabled={syncing}
              className="flex-1 rounded-md px-2 py-1 text-[11px] font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--volans-primary)' }}
            >
              {syncing
                ? '同期中…'
                : activeId
                  ? cloud.cloudReady
                    ? '上書き保存（＋クラウド）'
                    : '上書き保存'
                  : cloud.cloudReady
                    ? '保存（＋クラウド）'
                    : '保存 (新規)'}
            </button>
            <button
              onClick={onNew}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
              style={{
                background: 'var(--volans-surface)',
                border: `1px solid var(--volans-border-strong)`,
                color: 'var(--volans-text)',
              }}
            >
              <Plus className="h-3 w-3" />
              新規
            </button>
          </div>

          <div
            className="mt-2 flex items-center justify-between text-[10px]"
            style={{ color: 'var(--volans-muted)' }}
          >
            {cloud.cloudReady ? (
              <span className="flex items-center gap-1" style={{ color: 'var(--volans-success)' }}>
                <Cloud className="h-3 w-3" />
                クラウド同期オン
              </span>
            ) : cloud.configured === false ? (
              <span className="flex items-center gap-1">
                <CloudOff className="h-3 w-3" />
                ローカル保存のみ（Firebase 未設定）
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <CloudOff className="h-3 w-3" />
                ローカル保存のみ（未サインイン）
              </span>
            )}
            {cloud.loading && (
              <span style={{ color: 'var(--volans-muted)' }}>読込中…</span>
            )}
          </div>
          {syncError && (
            <div
              className="mt-1 rounded-md px-2 py-1 text-[10px]"
              style={{
                background: '#fdecec',
                color: 'var(--volans-danger)',
                border: `1px solid var(--volans-danger)`,
              }}
            >
              {syncError}
            </div>
          )}

          <div
            className="mt-2 max-h-[260px] overflow-y-auto rounded-md"
            style={{ border: `1px solid var(--volans-border)` }}
          >
            {merged.length === 0 && (
              <div
                className="p-3 text-center text-[10px]"
                style={{ color: 'var(--volans-muted)' }}
              >
                保存済みプロジェクトはありません
              </div>
            )}
            {merged.map((p) => {
              const active = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => onLoad(p)}
                  className="flex w-full items-start justify-between gap-2 px-2 py-1.5 text-left"
                  style={{
                    background: active ? 'var(--volans-primary-soft)' : 'transparent',
                    borderBottom: `1px solid var(--volans-border)`,
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1">
                      {active && (
                        <Check
                          className="h-3 w-3 shrink-0"
                          style={{ color: 'var(--volans-primary)' }}
                        />
                      )}
                      <span
                        className="truncate text-[11px] font-medium"
                        style={{ color: 'var(--volans-text)' }}
                      >
                        {p.projectName}
                      </span>
                      {p.inCloud && (
                        <Cloud
                          className="h-3 w-3 shrink-0"
                          style={{ color: 'var(--volans-success)' }}
                          aria-label="クラウド保存済み"
                        />
                      )}
                    </div>
                    <span
                      className="truncate text-[9px]"
                      style={{ color: 'var(--volans-muted)' }}
                    >
                      {formatUpdatedAt(p.updatedAt)} / {p.address || '—'}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => onDuplicate(p, e)}
                      className="grid h-5 w-5 place-items-center rounded hover:bg-slate-200"
                      aria-label="複製"
                      style={{ color: 'var(--volans-muted)' }}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => onRemove(p, e)}
                      className="grid h-5 w-5 place-items-center rounded hover:bg-red-50"
                      aria-label="削除"
                      style={{ color: 'var(--volans-danger)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
