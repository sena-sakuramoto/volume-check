'use client';

import { useState } from 'react';
import { ChevronDown, FolderOpen, Plus, Copy, Trash2, Check } from 'lucide-react';
import { useProjectsStore, type ProjectSnapshot } from '@/stores/useProjectsStore';
import { useVolansStore, formatUpdatedAt } from '@/stores/useVolansStore';

export function ProjectSwitcher() {
  const [open, setOpen] = useState(false);
  const projects = useProjectsStore((s) => s.projects);
  const activeId = useProjectsStore((s) => s.activeId);
  const sorted = [...projects].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  const store = useVolansStore();
  const activeName = store.projectName;

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

  function onSave() {
    useProjectsStore.getState().save(snapshot());
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
    useProjectsStore.setState({ activeId: p.id });
    setOpen(false);
  }

  function onDuplicate(p: ProjectSnapshot, e: React.MouseEvent) {
    e.stopPropagation();
    useProjectsStore.getState().duplicate(p.id);
  }

  function onRemove(p: ProjectSnapshot, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`プロジェクト「${p.projectName}」を削除しますか？`)) return;
    useProjectsStore.getState().remove(p.id);
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
          className="absolute right-0 top-full z-30 mt-1 w-[280px] rounded-xl p-2 shadow-lg"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border-strong)`,
          }}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={onSave}
              className="flex-1 rounded-md px-2 py-1 text-[11px] font-medium text-white"
              style={{ background: 'var(--volans-primary)' }}
            >
              {activeId ? '上書き保存' : '保存 (新規)'}
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
            className="mt-2 max-h-[260px] overflow-y-auto rounded-md"
            style={{ border: `1px solid var(--volans-border)` }}
          >
            {sorted.length === 0 && (
              <div
                className="p-3 text-center text-[10px]"
                style={{ color: 'var(--volans-muted)' }}
              >
                保存済みプロジェクトはありません
              </div>
            )}
            {sorted.map((p) => {
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
