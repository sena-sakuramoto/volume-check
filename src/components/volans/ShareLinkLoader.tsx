'use client';

import { useEffect } from 'react';
import { useVolansStore } from '@/stores/useVolansStore';
import { decodeShareLink } from '@/lib/share-link';

/**
 * Mounts once on /sky (and other public views) — reads #v=<b64> from the URL
 * hash and loads the encoded project into the store. Silently clears the hash
 * once applied so subsequent edits use the local store, not the share link.
 */
export function ShareLinkLoader() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash.startsWith('#v=')) return;
    const encoded = hash.slice(3);
    const payload = decodeShareLink(encoded);
    if (!payload) return;
    useVolansStore.getState().loadSnapshot({
      projectName: payload.name,
      address: payload.address,
      lat: payload.lat,
      lng: payload.lng,
      site: payload.site,
      roads: payload.roads,
      zoning: payload.zoning,
      latitude: payload.latitude,
      floorHeights: payload.floorHeights,
      skyMaxScale: payload.skyMaxScale,
    });
    // remove the hash so the URL stays clean
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);
  return null;
}
