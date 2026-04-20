'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'volans-theme';

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * Light/dark theme toggle. Persists to localStorage; defaults to the user's
 * OS preference on first visit. Writing data-theme on <html> lets the
 * CSS overrides in globals.css flip every --volans-* token atomically.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const stored = typeof window !== 'undefined'
        ? (localStorage.getItem(STORAGE_KEY) as Theme | null)
        : null;
      const osDark = typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      const initial: Theme = stored ?? (osDark ? 'dark' : 'light');
      setTheme(initial);
      applyTheme(initial);
      setMounted(true);
    });
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }

  if (!mounted) {
    return (
      <span
        className="grid h-7 w-7 place-items-center rounded-md"
        style={{
          background: 'var(--volans-surface-alt)',
          border: `1px solid var(--volans-border)`,
        }}
        aria-hidden
      />
    );
  }

  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'ライトモードに切替' : 'ダークモードに切替'}
      className="grid h-7 w-7 place-items-center rounded-md transition-all hover:brightness-95 active:scale-95"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border-strong)`,
        color: 'var(--volans-text)',
      }}
    >
      {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}
