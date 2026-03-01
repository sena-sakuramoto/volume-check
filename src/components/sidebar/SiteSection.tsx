'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SiteBoundary, Road, ZoningData, ZoningDistrict, FireDistrict, HeightDistrict } from '@/engine/types';
import { AddressSearch } from '@/components/site/AddressSearch';
import { FileUpload } from '@/components/site/FileUpload';
import { SiteEditor } from '@/components/site/SiteEditor';
import { RoadEditor } from '@/components/site/RoadEditor';
import type { RoadConfig } from '@/components/site/site-types';
import { buildRectSite, buildRoad, buildZoningData } from '@/components/site/site-helpers';

interface SiteSectionProps {
  site: SiteBoundary | null;
  onSiteChange: (site: SiteBoundary) => void;
  onRoadsChange: (roads: Road[]) => void;
  onZoningChange: (zoning: ZoningData) => void;
  onLatitudeChange: (lat: number) => void;
  /** Pass detected zoning state up to parent for cross-step coordination */
  selectedDistrict: ZoningDistrict | null;
  onDistrictChange: (d: ZoningDistrict) => void;
  coverageOverride: string;
  onCoverageChange: (v: string) => void;
  farOverride: string;
  onFarChange: (v: string) => void;
  fireDistrict: FireDistrict;
  onFireDistrictChange: (f: FireDistrict) => void;
  heightDistrictType: HeightDistrict['type'];
  isCornerLot: boolean;
  onCornerLotChange: (v: boolean) => void;
  roadConfigs: RoadConfig[];
  onRoadConfigsChange: (configs: RoadConfig[]) => void;
}

export function SiteSection({
  site,
  onSiteChange,
  onRoadsChange,
  onZoningChange,
  onLatitudeChange,
  selectedDistrict,
  onDistrictChange,
  coverageOverride,
  onCoverageChange,
  farOverride,
  onFarChange,
  fireDistrict,
  onFireDistrictChange,
  heightDistrictType,
  isCornerLot,
  onCornerLotChange,
  roadConfigs,
  onRoadConfigsChange,
}: SiteSectionProps) {
  const [siteWidth, setSiteWidth] = useState('');
  const [siteDepth, setSiteDepth] = useState('');
  const [siteMode, setSiteMode] = useState<'rect' | 'polygon'>('rect');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const tryBuildScene = useCallback(() => {
    const w = parseFloat(siteWidth);
    const d = parseFloat(siteDepth);
    if (!selectedDistrict || isNaN(w) || isNaN(d) || w <= 0 || d <= 0) return;

    if (siteMode === 'rect') onSiteChange(buildRectSite(w, d));

    const covParsed = coverageOverride ? parseFloat(coverageOverride) / 100 : undefined;
    const farParsed = farOverride ? parseFloat(farOverride) / 100 : undefined;

    onZoningChange(buildZoningData(selectedDistrict, {
      coverageRatio: covParsed,
      floorAreaRatio: farParsed,
      fireDistrict,
      heightDistrict: { type: heightDistrictType },
      isCornerLot,
    }));

    const roads = roadConfigs.map((rc) => buildRoad(w, d, rc.width, rc.direction));
    onRoadsChange(roads);
  }, [siteWidth, siteDepth, selectedDistrict, siteMode, coverageOverride, farOverride, fireDistrict, heightDistrictType, isCornerLot, roadConfigs, onSiteChange, onZoningChange, onRoadsChange]);

  const debouncedUpdate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(tryBuildScene, 80);
  }, [tryBuildScene]);

  const handleSiteWidth = (v: string) => { setSiteWidth(v); debouncedUpdate(); };
  const handleSiteDepth = (v: string) => { setSiteDepth(v); debouncedUpdate(); };

  const handleRoadConfigsChange = (configs: RoadConfig[]) => {
    onRoadConfigsChange(configs);
    // Rebuild immediately
    const w = parseFloat(siteWidth);
    const d = parseFloat(siteDepth);
    if (selectedDistrict && !isNaN(w) && w > 0 && !isNaN(d) && d > 0) {
      const roads = configs.map((rc) => buildRoad(w, d, rc.width, rc.direction));
      onRoadsChange(roads);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <AddressSearch
        onSiteChange={onSiteChange}
        onRoadsChange={onRoadsChange}
        onZoningChange={onZoningChange}
        onLatitudeChange={onLatitudeChange}
        onDistrictDetected={onDistrictChange}
        onCoverageDetected={onCoverageChange}
        onFarDetected={onFarChange}
        onFireDetected={onFireDistrictChange}
      />

      <FileUpload
        onSiteChange={onSiteChange}
        onRoadsChange={onRoadsChange}
        onZoningChange={onZoningChange}
        onLatitudeChange={onLatitudeChange}
        roadWidth={roadConfigs[0]?.width ?? 6}
        selectedDistrict={selectedDistrict}
        onSiteWidthDetected={setSiteWidth}
        onSiteDepthDetected={setSiteDepth}
        onDistrictDetected={onDistrictChange}
        onCoverageDetected={onCoverageChange}
        onFarDetected={onFarChange}
        onFireDetected={onFireDistrictChange}
      />

      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-border" />
        <span className="text-[10px] text-muted-foreground">設定</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <SiteEditor
        site={site}
        onSiteChange={onSiteChange}
        siteWidth={siteWidth}
        siteDepth={siteDepth}
        onSiteWidthChange={handleSiteWidth}
        onSiteDepthChange={handleSiteDepth}
        siteMode={siteMode}
        onSiteModeChange={setSiteMode}
      />

      <RoadEditor
        roadConfigs={roadConfigs}
        onRoadConfigsChange={handleRoadConfigsChange}
        onCornerLotChange={onCornerLotChange}
      />
    </div>
  );
}
