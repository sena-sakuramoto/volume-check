'use client';

import { useState } from 'react';
import { User as UserIcon, LogOut, LogIn, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Header badge for Firebase auth. In "unconfigured" mode it shows a subtle
 * "ローカル" indicator (no sign-in possible). With Firebase configured it
 * lets the user sign in with Google or sign out.
 */
export function AuthBadge() {
  const { configured, user, signInWithGoogle, signInGuest, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!configured) {
    return (
      <div
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px]"
        style={{
          background: 'var(--volans-surface-alt)',
          color: 'var(--volans-muted)',
          border: `1px solid var(--volans-border)`,
        }}
        title="Firebase 未設定 — ローカル保存のみ"
      >
        <UserIcon className="h-3 w-3" />
        ローカル
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-white"
        style={{ background: 'var(--volans-primary)' }}
      >
        <LogIn className="h-3 w-3" />
        サインイン
      </button>
    );
  }

  const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]"
        style={{
          background: 'var(--volans-surface)',
          border: `1px solid var(--volans-border-strong)`,
          color: 'var(--volans-text)',
        }}
      >
        <span
          className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #3b6de1, #22a06b)' }}
        >
          {initial}
        </span>
        <span className="max-w-[90px] truncate">
          {user.displayName ?? user.email ?? 'ゲスト'}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-[200px] overflow-hidden rounded-md shadow-md"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border-strong)`,
          }}
        >
          <div className="p-2 text-[10px]" style={{ color: 'var(--volans-muted)' }}>
            {user.email ?? '匿名ゲスト'}
          </div>
          {user.isAnonymous && (
            <button
              onClick={() => {
                setOpen(false);
                signInWithGoogle();
              }}
              className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] hover:bg-slate-50"
              style={{ color: 'var(--volans-text)' }}
            >
              <LogIn className="h-3 w-3" />
              Google でサインイン
            </button>
          )}
          {!user.isAnonymous && (
            <button
              onClick={() => {
                setOpen(false);
                signInGuest();
              }}
              className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] hover:bg-slate-50"
              style={{ color: 'var(--volans-text)' }}
            >
              <UserIcon className="h-3 w-3" />
              ゲストに切替
            </button>
          )}
          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-1.5 border-t px-2 py-1.5 text-left text-[11px] hover:bg-slate-50"
            style={{ color: 'var(--volans-danger)', borderColor: 'var(--volans-border)' }}
          >
            <LogOut className="h-3 w-3" />
            サインアウト
          </button>
        </div>
      )}
    </div>
  );
}
