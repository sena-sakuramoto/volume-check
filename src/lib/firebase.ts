'use client';

import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth } from 'firebase/auth';

/**
 * Firebase is opt-in for VOLANS. When the public config env vars are missing
 * we fall back to "anonymous local" mode — no sign-in, localStorage-only.
 *
 * To enable cloud auth, set NEXT_PUBLIC_FIREBASE_* env vars (see .env.example).
 */

export interface FirebaseBundle {
  app: FirebaseApp;
  auth: Auth;
}

function readConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

let cached: FirebaseBundle | null = null;

export function getFirebase(): FirebaseBundle | null {
  if (cached) return cached;
  if (typeof window === 'undefined') return null;
  const cfg = readConfig();
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
    return null;
  }
  const app = getApps().length ? getApp() : initializeApp(cfg);
  const auth = getAuth(app);
  cached = { app, auth };
  return cached;
}

export function isFirebaseConfigured(): boolean {
  const cfg = readConfig();
  return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
}
