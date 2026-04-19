'use client';

import { useState } from 'react';
import { Share2, Check, Copy } from 'lucide-react';
import { useVolansStore } from '@/stores/useVolansStore';
import { buildShareUrl } from '@/lib/share-link';

export function ShareLinkButton() {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const store = useVolansStore();

  async function generate() {
    const payload = {
      v: 1 as const,
      name: store.projectName,
      address: store.address,
      lat: store.lat,
      lng: store.lng,
      site: store.site,
      roads: store.roads,
      zoning: store.zoning,
      latitude: store.latitude,
      floorHeights: store.floorHeights,
      skyMaxScale: store.skyMaxScale,
    };
    const link = buildShareUrl(payload, '/sky');
    setUrl(link);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={generate}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px]"
        style={{
          background: 'var(--volans-surface)',
          border: `1px solid var(--volans-border-strong)`,
          color: 'var(--volans-text)',
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" style={{ color: 'var(--volans-success)' }} /> : <Share2 className="h-3.5 w-3.5" />}
        {copied ? 'コピー済' : '共有リンク'}
      </button>
      {url && (
        <div
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px]"
          style={{
            background: 'var(--volans-surface-alt)',
            border: `1px solid var(--volans-border)`,
            color: 'var(--volans-muted)',
            maxWidth: 320,
          }}
        >
          <Copy className="h-3 w-3 shrink-0" />
          <span className="truncate tabular-nums" title={url}>
            {url}
          </span>
        </div>
      )}
    </div>
  );
}
