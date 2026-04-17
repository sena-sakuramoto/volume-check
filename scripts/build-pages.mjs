#!/usr/bin/env node
/**
 * GitHub Pages static export build.
 * Strips server-only routes (API, debug, login, project) from src/app so
 * `next export` succeeds, then restores everything after build.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const APP_DIR = path.join(ROOT, 'src', 'app');
const STASH_DIR = path.join(ROOT, '.pages-stash');

const STRIP = ['api', 'debug', 'login', 'project'];
const CONFIG_SRC = path.join(ROOT, 'next.config.pages.ts');
const CONFIG_DST = path.join(ROOT, 'next.config.ts');
const CONFIG_BACKUP = path.join(ROOT, '.pages-stash-config.ts');

function stash() {
  if (fs.existsSync(STASH_DIR)) {
    fs.rmSync(STASH_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STASH_DIR, { recursive: true });

  for (const name of STRIP) {
    const src = path.join(APP_DIR, name);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(STASH_DIR, name);
    fs.cpSync(src, dst, { recursive: true });
    fs.rmSync(src, { recursive: true, force: true });
    console.log(`[stash] moved ${name} -> .pages-stash/`);
  }

  // Backup and swap next.config.ts
  if (fs.existsSync(CONFIG_DST)) {
    fs.copyFileSync(CONFIG_DST, CONFIG_BACKUP);
  }
  fs.copyFileSync(CONFIG_SRC, CONFIG_DST);
  console.log('[config] swapped next.config.ts -> pages variant');

  // Replace root page with redirect to /sky
  const rootPagePath = path.join(APP_DIR, 'page.tsx');
  if (fs.existsSync(rootPagePath)) {
    fs.copyFileSync(rootPagePath, path.join(STASH_DIR, 'page.tsx'));
  }
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const skyUrl = `${basePath}/sky/`;
  fs.writeFileSync(
    rootPagePath,
    `export const metadata = { title: 'SKY FACTOR 天空率計算' };

export default function Home() {
  return (
    <html lang="ja">
      <head>
        <meta httpEquiv="refresh" content="0; url=${skyUrl}" />
      </head>
      <body>
        <a href="${skyUrl}">SKY FACTOR を開く</a>
      </body>
    </html>
  );
}
`,
    'utf8',
  );
  console.log('[root] replaced src/app/page.tsx with meta-refresh redirect to /sky');
}

function restore() {
  for (const name of STRIP) {
    const src = path.join(STASH_DIR, name);
    const dst = path.join(APP_DIR, name);
    if (fs.existsSync(src)) {
      if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
      fs.cpSync(src, dst, { recursive: true });
      fs.rmSync(src, { recursive: true, force: true });
      console.log(`[restore] moved ${name} back`);
    }
  }

  const stashedRoot = path.join(STASH_DIR, 'page.tsx');
  const rootPagePath = path.join(APP_DIR, 'page.tsx');
  if (fs.existsSync(stashedRoot)) {
    fs.copyFileSync(stashedRoot, rootPagePath);
    fs.rmSync(stashedRoot);
  }

  if (fs.existsSync(CONFIG_BACKUP)) {
    fs.copyFileSync(CONFIG_BACKUP, CONFIG_DST);
    fs.rmSync(CONFIG_BACKUP);
    console.log('[config] restored next.config.ts');
  }

  if (fs.existsSync(STASH_DIR)) {
    fs.rmSync(STASH_DIR, { recursive: true, force: true });
  }
}

const command = process.argv[2];
if (command === 'stash') stash();
else if (command === 'restore') restore();
else if (command === 'full') {
  try {
    stash();
    console.log('[build] running: next build');
    const envBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    execSync('pnpm exec next build', {
      stdio: 'inherit',
      env: { ...process.env, NEXT_PUBLIC_BASE_PATH: envBasePath },
    });

    // Create .nojekyll so Pages serves _next correctly
    const outDir = path.join(ROOT, 'out');
    if (fs.existsSync(outDir)) {
      fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
      console.log('[build] wrote out/.nojekyll');
    }
  } finally {
    restore();
  }
} else {
  console.error('Usage: build-pages.mjs [stash|restore|full]');
  process.exit(1);
}
