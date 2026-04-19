'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  deleteProjectFromCloud,
  listCloudProjects,
  saveProjectToCloud,
} from '@/lib/firestore';
import type { ProjectSnapshot } from '@/stores/useProjectsStore';

export interface CloudProjectsState {
  /** Cloud-saved projects for the current signed-in user. */
  cloudProjects: ProjectSnapshot[];
  loading: boolean;
  error: string | null;
  /** True when NEXT_PUBLIC_FIREBASE_* env vars are set. */
  configured: boolean;
  /** True when cloud sync can be attempted (Firebase configured + non-anon sign-in). */
  cloudReady: boolean;
  refresh: () => Promise<void>;
  saveToCloud: (snapshot: ProjectSnapshot) => Promise<{ ok: boolean; error?: string }>;
  removeFromCloud: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Reads/writes projects to Firestore when signed in. Anonymous users and
 * unconfigured Firebase both yield `cloudReady = false` — the UI should fall
 * back to local-only project management.
 */
export function useCloudProjects(): CloudProjectsState {
  const { user, configured } = useAuth();
  const [cloudProjects, setCloudProjects] = useState<ProjectSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloudReady = configured && user !== null && !user.isAnonymous;

  const refresh = useCallback(async () => {
    if (!cloudReady || !user) {
      setCloudProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listCloudProjects(user.uid);
      setCloudProjects(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'クラウド取得失敗');
    } finally {
      setLoading(false);
    }
  }, [cloudReady, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveToCloud = useCallback(
    async (snapshot: ProjectSnapshot) => {
      if (!cloudReady || !user) return { ok: false, error: 'サインインしてください' };
      const result = await saveProjectToCloud(user.uid, snapshot);
      if (result.ok) void refresh();
      return result;
    },
    [cloudReady, user, refresh],
  );

  const removeFromCloud = useCallback(
    async (id: string) => {
      if (!cloudReady || !user) return { ok: false, error: 'サインインしてください' };
      const result = await deleteProjectFromCloud(user.uid, id);
      if (result.ok) void refresh();
      return result;
    },
    [cloudReady, user, refresh],
  );

  return {
    cloudProjects,
    loading,
    error,
    configured,
    cloudReady,
    refresh,
    saveToCloud,
    removeFromCloud,
  };
}
