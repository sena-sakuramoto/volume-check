import type { SiteBoundary, Road, ZoningData } from '@/engine/types';

/**
 * Minimal shape encoded/decoded via share URLs. Keep this stable.
 * Version-tagged so old links keep working.
 */
export interface ShareablePayload {
  v: 1;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  site: SiteBoundary;
  roads: Road[];
  zoning: ZoningData;
  latitude: number;
  floorHeights: number[];
  skyMaxScale: number | null;
}

function b64urlEncode(str: string): string {
  const utf8 = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(str)
    : Buffer.from(str, 'utf-8');
  // Chunk to avoid stack overflow on huge payloads
  let binary = '';
  const bytes = utf8 as Uint8Array;
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  return Buffer.from(bytes).toString('utf-8');
}

export function encodeShareLink(payload: ShareablePayload): string {
  const json = JSON.stringify(payload);
  return b64urlEncode(json);
}

export function decodeShareLink(encoded: string): ShareablePayload | null {
  try {
    const json = b64urlDecode(encoded);
    const obj = JSON.parse(json);
    if (typeof obj === 'object' && obj !== null && obj.v === 1) {
      return obj as ShareablePayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a full URL for the current origin with #v=... hash.
 */
export function buildShareUrl(payload: ShareablePayload, path: string = '/sky'): string {
  const encoded = encodeShareLink(payload);
  if (typeof window === 'undefined') {
    return `${path}#v=${encoded}`;
  }
  const base = `${window.location.origin}${path}`;
  return `${base}#v=${encoded}`;
}
