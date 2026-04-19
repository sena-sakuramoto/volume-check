'use client';

import { useEffect, useState } from 'react';
import {
  type User,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously as fbSignInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';

export interface AuthState {
  /** true when Firebase env vars are wired up */
  configured: boolean;
  user: User | null;
  /** null until the first auth state callback fires */
  initialized: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    configured: isFirebaseConfigured(),
    user: null,
    initialized: false,
    error: null,
  });

  useEffect(() => {
    const bundle = getFirebase();
    if (!bundle) {
      // Defer the "no firebase" init flip to a microtask so we don't setState
      // synchronously inside the effect body.
      const t = queueMicrotask(() =>
        setState((s) => ({ ...s, initialized: true })),
      );
      return () => {
        void t;
      };
    }
    const unsub = onAuthStateChanged(bundle.auth, (user) => {
      setState((s) => ({ ...s, user, initialized: true, error: null }));
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    const bundle = getFirebase();
    if (!bundle) {
      setState((s) => ({ ...s, error: 'Firebase 設定が未構成です' }));
      return;
    }
    try {
      await signInWithPopup(bundle.auth, new GoogleAuthProvider());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'サインイン失敗';
      setState((s) => ({ ...s, error: msg }));
    }
  }

  async function signInGuest() {
    const bundle = getFirebase();
    if (!bundle) {
      setState((s) => ({ ...s, error: 'Firebase 設定が未構成です' }));
      return;
    }
    try {
      await fbSignInAnonymously(bundle.auth);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ゲストサインイン失敗';
      setState((s) => ({ ...s, error: msg }));
    }
  }

  async function signOut() {
    const bundle = getFirebase();
    if (!bundle) return;
    try {
      await fbSignOut(bundle.auth);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'サインアウト失敗';
      setState((s) => ({ ...s, error: msg }));
    }
  }

  return { ...state, signInWithGoogle, signInGuest, signOut };
}
