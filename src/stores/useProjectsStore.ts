'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SiteBoundary, Road, ZoningData } from '@/engine/types';

/**
 * Each project captures the full editable state of the VOLANS store as a
 * snapshot. Project switching replaces the live store with the snapshot.
 */
export interface ProjectSnapshot {
  id: string;
  projectName: string;
  address: string;
  lat: number | null;
  lng: number | null;
  site: SiteBoundary;
  roads: Road[];
  zoning: ZoningData;
  latitude: number;
  floorHeights: number[];
  skyMaxScale: number | null;
  skyWorstMargin: number | null;
  skyOptimizedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

interface ProjectsStore {
  projects: ProjectSnapshot[];
  activeId: string | null;

  list: () => ProjectSnapshot[];
  save: (snapshot: Omit<ProjectSnapshot, 'id' | 'createdAt'>) => ProjectSnapshot;
  load: (id: string) => ProjectSnapshot | null;
  remove: (id: string) => void;
  rename: (id: string, newName: string) => void;
  duplicate: (id: string) => ProjectSnapshot | null;
  setActive: (id: string | null) => void;
}

function newId(): string {
  return `prj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeId: null,

      list: () =>
        [...get().projects].sort(
          (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        ),

      save: (input) => {
        const { activeId, projects } = get();
        const now = new Date().toISOString();
        if (activeId) {
          const existing = projects.find((p) => p.id === activeId);
          if (existing) {
            const updated: ProjectSnapshot = {
              ...existing,
              ...input,
              updatedAt: now,
            };
            set({
              projects: projects.map((p) => (p.id === activeId ? updated : p)),
            });
            return updated;
          }
        }
        const created: ProjectSnapshot = {
          ...input,
          id: newId(),
          createdAt: now,
          updatedAt: now,
        };
        set({ projects: [created, ...projects], activeId: created.id });
        return created;
      },

      load: (id) => {
        const found = get().projects.find((p) => p.id === id);
        if (found) set({ activeId: id });
        return found ?? null;
      },

      remove: (id) => {
        const { projects, activeId } = get();
        set({
          projects: projects.filter((p) => p.id !== id),
          activeId: activeId === id ? null : activeId,
        });
      },

      rename: (id, newName) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, projectName: newName, updatedAt: new Date().toISOString() } : p,
          ),
        }));
      },

      duplicate: (id) => {
        const { projects } = get();
        const src = projects.find((p) => p.id === id);
        if (!src) return null;
        const copy: ProjectSnapshot = {
          ...src,
          id: newId(),
          projectName: `${src.projectName} (コピー)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set({ projects: [copy, ...projects] });
        return copy;
      },

      setActive: (id) => set({ activeId: id }),
    }),
    {
      name: 'volans-projects-v1',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : (undefined as unknown as Storage),
      ),
    },
  ),
);
