'use client';

import { useState, useRef, useCallback } from 'react';
import type { ZoningDistrict, FireDistrict } from '@/engine/types';
import { Input } from '@/components/ui/shadcn/input';
import { Button } from '@/components/ui/shadcn/button';
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { SearchStatus, SiteCallbacks } from './site-types';
import {
  matchDistrict,
  matchFireDistrict,
  normalizeRatio,
  shortenDistrict,
  buildZoningData,
} from './site-helpers';

interface AddressSearchProps extends SiteCallbacks {
  onDistrictDetected: (d: ZoningDistrict) => void;
  onCoverageDetected: (v: string) => void;
  onFarDetected: (v: string) => void;
  onFireDetected: (f: FireDistrict) => void;
}

export function AddressSearch({
  onLatitudeChange,
  onZoningChange,
  onDistrictDetected,
  onCoverageDetected,
  onFarDetected,
  onFireDetected,
}: AddressSearchProps) {
  const [address, setAddress] = useState('');
  const [searchStatus, setSearchStatus] = useState<SearchStatus>({ state: 'idle' });
  const latLngRef = useRef<{ lat: number; lng: number } | null>(null);

  const isSearching =
    searchStatus.state === 'loading' || searchStatus.state === 'zoning-loading';

  const handleSearch = useCallback(async () => {
    const trimmed = address.trim();
    if (!trimmed) return;

    setSearchStatus({ state: 'loading' });

    try {
      const geocodeRes = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: trimmed }),
      });

      if (!geocodeRes.ok) {
        const data = await geocodeRes.json().catch(() => ({}));
        setSearchStatus({ state: 'error', message: data.error || '住所が見つかりませんでした' });
        return;
      }

      const geocodeData: { lat: number; lng: number; address: string } =
        await geocodeRes.json();
      const { lat, lng, address: confirmedAddress } = geocodeData;

      latLngRef.current = { lat, lng };
      onLatitudeChange(lat);

      setSearchStatus({ state: 'zoning-loading', address: confirmedAddress, lat, lng });

      const zoningRes = await fetch('/api/zoning-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });

      if (!zoningRes.ok) {
        setSearchStatus({ state: 'zoning-not-found', address: confirmedAddress });
        return;
      }

      const zoningData: {
        district: string;
        coverageRatio: number;
        floorAreaRatio: number;
        fireDistrict: string;
      } = await zoningRes.json();

      const matchedDistrict = matchDistrict(zoningData.district);
      if (!matchedDistrict) {
        setSearchStatus({ state: 'zoning-not-found', address: confirmedAddress });
        return;
      }

      const normalizedCoverage = normalizeRatio(zoningData.coverageRatio);
      const normalizedFAR = normalizeRatio(zoningData.floorAreaRatio);
      const matchedFire = matchFireDistrict(zoningData.fireDistrict);

      onDistrictDetected(matchedDistrict);
      onCoverageDetected(normalizedCoverage > 0 ? String(Math.round(normalizedCoverage * 100)) : '');
      onFarDetected(normalizedFAR > 0 ? String(Math.round(normalizedFAR * 100)) : '');
      onFireDetected(matchedFire);

      setSearchStatus({ state: 'success', address: confirmedAddress, district: matchedDistrict });

      onZoningChange(
        buildZoningData(matchedDistrict, {
          coverageRatio: normalizedCoverage > 0 ? normalizedCoverage : undefined,
          floorAreaRatio: normalizedFAR > 0 ? normalizedFAR : undefined,
          fireDistrict: matchedFire,
        }),
      );
    } catch {
      setSearchStatus({ state: 'error', message: 'サーバーに接続できませんでした' });
    }
  }, [address, onLatitudeChange, onZoningChange, onDistrictDetected, onCoverageDetected, onFarDetected, onFireDetected]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">住所検索</label>
      <div className="flex gap-1.5">
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
          placeholder="東京都渋谷区..."
          disabled={isSearching}
          className="h-8 text-xs"
        />
        <Button
          onClick={handleSearch}
          disabled={isSearching || !address.trim()}
          size="sm"
          className="h-8 shrink-0"
        >
          {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '検索'}
        </Button>
      </div>

      {searchStatus.state === 'success' && (
        <div className="flex items-start gap-1.5 rounded-md bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <p className="text-[11px] text-emerald-300 truncate">{searchStatus.address}</p>
            <p className="text-[10px] text-emerald-400/70">
              {shortenDistrict(searchStatus.district)} を自動設定しました
            </p>
          </div>
        </div>
      )}

      {searchStatus.state === 'zoning-not-found' && (
        <div className="flex items-start gap-1.5 rounded-md bg-amber-950/40 border border-amber-800/40 px-2.5 py-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <p className="text-[11px] text-amber-300 truncate">{searchStatus.address}</p>
            <p className="text-[10px] text-amber-400/70">用途地域を下から選択してください</p>
          </div>
        </div>
      )}

      {searchStatus.state === 'zoning-loading' && (
        <div className="flex items-center gap-1.5 px-2.5 py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <p className="text-[11px] text-primary/80 truncate">
            {searchStatus.address} の用途地域を取得中...
          </p>
        </div>
      )}

      {searchStatus.state === 'error' && (
        <div className="flex items-start gap-1.5 rounded-md bg-red-950/40 border border-red-800/40 px-2.5 py-2">
          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-400" />
          <p className="text-[11px] text-red-300">{searchStatus.message}</p>
        </div>
      )}
    </div>
  );
}
