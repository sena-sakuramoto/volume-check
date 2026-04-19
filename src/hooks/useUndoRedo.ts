'use client';

import { useCallback, useEffect } from 'react';
import { useVolansStore } from '@/stores/useVolansStore';
import { useHistoryStore, type HistorySnapshot } from '@/stores/useHistoryStore';

function snapshotOfStore(): HistorySnapshot {
  const s = useVolansStore.getState();
  return {
    site: { vertices: s.site.vertices.map((v) => ({ ...v })), area: s.site.area },
    roads: s.roads.map((r) => ({ ...r, edgeStart: { ...r.edgeStart }, edgeEnd: { ...r.edgeEnd } })),
    zoning: { ...s.zoning, heightDistrict: { ...s.zoning.heightDistrict }, districtPlan: s.zoning.districtPlan ? { ...s.zoning.districtPlan } : null, shadowRegulation: s.zoning.shadowRegulation ? { ...s.zoning.shadowRegulation } : null },
    floorHeights: [...s.floorHeights],
  };
}

function applySnapshot(snap: HistorySnapshot) {
  useVolansStore.setState({
    site: snap.site,
    roads: snap.roads,
    zoning: snap.zoning,
    floorHeights: snap.floorHeights,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Call `record()` after any user-initiated edit that changes site/roads/zoning.
 * Call `undo()` / `redo()` from a button or keyboard shortcut.
 *
 * Keyboard shortcut (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y) is auto-bound.
 */
export function useUndoRedo() {
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  const record = useCallback(() => {
    useHistoryStore.getState().push(snapshotOfStore());
  }, []);

  const undo = useCallback(() => {
    const history = useHistoryStore.getState();
    if (history.past.length === 0) return;
    // Push current → future before replacing
    const current = snapshotOfStore();
    const previous = history.undo();
    if (!previous) return;
    // The undo() above already pushed `last` into future, but we want `current`
    // in future. Fix the stack manually:
    useHistoryStore.setState((s) => ({
      future: [current, ...s.future.slice(1)],
    }));
    applySnapshot(previous);
  }, []);

  const redo = useCallback(() => {
    const history = useHistoryStore.getState();
    if (history.future.length === 0) return;
    const current = snapshotOfStore();
    const next = history.redo();
    if (!next) return;
    useHistoryStore.setState((s) => ({
      past: [...s.past.slice(0, -1), current],
    }));
    applySnapshot(next);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return { record, undo, redo, canUndo, canRedo };
}
