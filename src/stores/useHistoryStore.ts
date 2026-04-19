'use client';

import { create } from 'zustand';
import type { SiteBoundary, Road, ZoningData } from '@/engine/types';

/**
 * Lightweight history of edit-relevant parts of the VOLANS project.
 * Decoupled from the main store so we can snapshot only what matters for
 * undo/redo and avoid capturing ephemeral bits like `progressLabel`.
 */
export interface HistorySnapshot {
  site: SiteBoundary;
  roads: Road[];
  zoning: ZoningData;
  floorHeights: number[];
}

interface HistoryStore {
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  push: (snap: HistorySnapshot) => void;
  undo: () => HistorySnapshot | null;
  redo: () => HistorySnapshot | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

const MAX_HISTORY = 50;

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],

  push: (snap) =>
    set((s) => {
      const next = [...s.past, snap];
      if (next.length > MAX_HISTORY) next.shift();
      return { past: next, future: [] };
    }),

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return null;
    const last = past[past.length - 1];
    set({ past: past.slice(0, -1), future: [last, ...future].slice(0, MAX_HISTORY) });
    return last;
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    set({ past: [...past, next].slice(-MAX_HISTORY), future: future.slice(1) });
    return next;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  clear: () => set({ past: [], future: [] }),
}));
