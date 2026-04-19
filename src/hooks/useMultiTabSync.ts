'use client';

import { useEffect } from 'react';
import { useVolansStore } from '@/stores/useVolansStore';

const CHANNEL = 'volans-sync-v1';

type SyncMessage = {
  type: 'state';
  payload: {
    projectName: string;
    address: string;
    lat: number | null;
    lng: number | null;
    site: unknown;
    roads: unknown;
    zoning: unknown;
    latitude: number;
    floorHeights: number[];
    skyMaxScale: number | null;
    updatedAt: string;
    origin: string;
  };
};

/**
 * Broadcast the store across tabs. One instance per mount; do not mount twice
 * in the same tab. When another tab writes a newer `updatedAt`, apply it here.
 */
export function useMultiTabSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof BroadcastChannel === 'undefined') return;

    const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = new BroadcastChannel(CHANNEL);

    const post = () => {
      const s = useVolansStore.getState();
      channel.postMessage({
        type: 'state',
        payload: {
          projectName: s.projectName,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          site: s.site,
          roads: s.roads,
          zoning: s.zoning,
          latitude: s.latitude,
          floorHeights: s.floorHeights,
          skyMaxScale: s.skyMaxScale,
          updatedAt: s.updatedAt,
          origin: tabId,
        },
      } satisfies SyncMessage);
    };

    // Debounced outgoing: avoid firing on every character
    let postTimer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useVolansStore.subscribe(() => {
      if (postTimer) clearTimeout(postTimer);
      postTimer = setTimeout(post, 250);
    });

    channel.onmessage = (ev: MessageEvent<SyncMessage>) => {
      const msg = ev.data;
      if (!msg || msg.type !== 'state') return;
      const payload = msg.payload;
      if (payload.origin === tabId) return;
      const current = useVolansStore.getState();
      if (Date.parse(payload.updatedAt) <= Date.parse(current.updatedAt)) return;
      useVolansStore.getState().loadSnapshot({
        projectName: payload.projectName,
        address: payload.address,
        lat: payload.lat,
        lng: payload.lng,
        // Cast: we trust same-origin tabs on the same app build
        site: payload.site as never,
        roads: payload.roads as never,
        zoning: payload.zoning as never,
        latitude: payload.latitude,
        floorHeights: payload.floorHeights,
        skyMaxScale: payload.skyMaxScale,
        updatedAt: payload.updatedAt,
      });
    };

    return () => {
      if (postTimer) clearTimeout(postTimer);
      unsub();
      channel.close();
    };
  }, []);
}
