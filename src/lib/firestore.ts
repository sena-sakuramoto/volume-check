'use client';

import {
  type Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { ProjectSnapshot } from '@/stores/useProjectsStore';

/**
 * Cloud project sync helpers. All calls no-op (return null / empty list) when
 * Firebase is not configured OR the caller isn't signed in.
 *
 * Layout: `users/{uid}/volansProjects/{projectId}` — matches Firebase security
 * rules that scope reads/writes to the owning user.
 */

let firestoreCache: Firestore | null = null;

function getDb(): Firestore | null {
  if (firestoreCache) return firestoreCache;
  const bundle = getFirebase();
  if (!bundle) return null;
  firestoreCache = getFirestore(bundle.app);
  return firestoreCache;
}

function userCollection(uid: string) {
  const db = getDb();
  if (!db) return null;
  return collection(db, 'users', uid, 'volansProjects');
}

export async function saveProjectToCloud(
  uid: string,
  project: ProjectSnapshot,
): Promise<{ ok: boolean; error?: string }> {
  const col = userCollection(uid);
  if (!col) return { ok: false, error: 'Firebase 未設定' };
  try {
    await setDoc(doc(col, project.id), project);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'クラウド保存失敗' };
  }
}

export async function deleteProjectFromCloud(
  uid: string,
  projectId: string,
): Promise<{ ok: boolean; error?: string }> {
  const col = userCollection(uid);
  if (!col) return { ok: false, error: 'Firebase 未設定' };
  try {
    await deleteDoc(doc(col, projectId));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'クラウド削除失敗' };
  }
}

export async function listCloudProjects(uid: string): Promise<ProjectSnapshot[]> {
  const col = userCollection(uid);
  if (!col) return [];
  try {
    const snapshot = await getDocs(query(col, orderBy('updatedAt', 'desc')));
    return snapshot.docs.map((d) => d.data() as ProjectSnapshot);
  } catch {
    return [];
  }
}
