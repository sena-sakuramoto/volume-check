'use client';

import { useCallback } from 'react';
import type { ZoningData, VolumeResult, SiteBoundary, Road } from '@/engine/types';
import {
  getRoadSetbackParams,
  getAdjacentSetbackParams,
  getNorthSetbackParams,
} from '@/engine';
import { generatePdfReport } from '@/lib/pdf-export';
import { saveProject } from '@/lib/project-storage';

interface RegulationPanelProps {
  zoning: ZoningData | null;
  result: VolumeResult | null;
  site?: SiteBoundary | null;
  roads?: Road[];
  floorHeights?: number[];
  latitude?: number;
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-100">{value}</span>
    </div>
  );
}

function ResultValue({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-bold text-blue-400">
        {value}
        <span className="ml-0.5 text-xs font-normal text-gray-500">{unit}</span>
      </span>
    </div>
  );
}

const DIRECTION_LABELS: Record<number, string> = {
  0: '北',
  90: '東',
  180: '南',
  270: '西',
};

export function RegulationPanel({
  zoning,
  result,
  site,
  roads,
  floorHeights,
  latitude,
}: RegulationPanelProps) {
  const handlePdf = useCallback(() => {
    if (!zoning || !result) return;
    const dirLabel = (bearing: number) => DIRECTION_LABELS[bearing] ?? `${bearing}°`;
    generatePdfReport(
      zoning,
      result,
      site?.area ?? 0,
      floorHeights ?? [],
      (roads ?? []).map((r) => ({ direction: dirLabel(r.bearing), width: r.width })),
    );
  }, [zoning, result, site, roads, floorHeights]);

  const handleSave = useCallback(() => {
    if (!site || !zoning || !roads) return;
    saveProject({
      site,
      roads,
      zoning,
      latitude: latitude ?? 35.68,
      floorHeights: floorHeights ?? [],
      savedAt: '',
    });
    // Brief visual feedback via alert (simple but effective)
    alert('保存しました');
  }, [site, roads, zoning, latitude, floorHeights]);

  if (!zoning) {
    return (
      <div className="flex flex-col gap-4 p-3">
        <p className="text-sm text-gray-500 text-center py-8">
          住所を入力して法規制を取得してください
        </p>
      </div>
    );
  }

  const roadParams = getRoadSetbackParams(zoning.district);
  const adjParams = getAdjacentSetbackParams(zoning.district);
  const northParams = getNorthSetbackParams(zoning.district);

  // Build floor elevation table data
  const floorRows: { floor: number; height: number; cumulative: number }[] = [];
  if (floorHeights && floorHeights.length > 0 && result) {
    let cumH = 0;
    for (let i = 0; i < floorHeights.length; i++) {
      cumH += floorHeights[i];
      if (cumH > (result.maxHeight ?? Infinity) + 0.01) break;
      floorRows.push({ floor: i + 1, height: floorHeights[i], cumulative: cumH });
    }
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Regulation Summary */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          法規制サマリー
        </h3>
        <div className="rounded bg-gray-800 border border-gray-700 px-3 py-2 divide-y divide-gray-700">
          <DataRow label="用途地域" value={zoning.district} />
          <DataRow
            label="建ぺい率"
            value={`${(zoning.coverageRatio * 100).toFixed(0)}%`}
          />
          <DataRow
            label="容積率"
            value={`${(zoning.floorAreaRatio * 100).toFixed(0)}%`}
          />
          <DataRow label="防火地域" value={zoning.fireDistrict} />
          <DataRow label="高度地区" value={zoning.heightDistrict?.type ?? '指定なし'} />
          <DataRow
            label="絶対高さ制限"
            value={
              zoning.absoluteHeightLimit !== null
                ? `${zoning.absoluteHeightLimit}m`
                : 'なし'
            }
          />
          <DataRow
            label="外壁後退"
            value={
              zoning.wallSetback !== null
                ? `${zoning.wallSetback}m`
                : 'なし'
            }
          />
          {zoning.isCornerLot && (
            <DataRow label="角地緩和" value="適用 (+10%)" />
          )}
        </div>
      </div>

      {/* Applied Setback Regulations */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          適用斜線制限
        </h3>
        <div className="rounded bg-gray-800 border border-gray-700 px-3 py-2 divide-y divide-gray-700">
          <DataRow label="道路斜線" value={`勾配 ${roadParams.slopeRatio}`} />
          {roadParams.applicationDistance !== Infinity && (
            <DataRow label="適用距離" value={`${roadParams.applicationDistance}m`} />
          )}
          <DataRow label="隣地斜線" value={`${adjParams.riseHeight}m + ${adjParams.slopeRatio}D`} />
          {northParams && (
            <DataRow label="北側斜線" value={`${northParams.riseHeight}m + ${northParams.slopeRatio}D`} />
          )}
          {roads && roads.length > 0 && (
            <DataRow
              label="道路幅員制限容積率"
              value={`${Math.round(Math.min(...roads.map((r) => r.width * 0.4)) * 100)}%`}
            />
          )}
        </div>
      </div>

      {/* Calculation Results */}
      {result && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            計算結果
          </h3>
          <div className="rounded bg-gray-800 border border-gray-700 px-3 py-2 divide-y divide-gray-700">
            <ResultValue
              label="最大延べ面積"
              value={result.maxFloorArea.toFixed(2)}
              unit="m²"
            />
            <ResultValue
              label="最大建築面積"
              value={result.maxCoverageArea.toFixed(2)}
              unit="m²"
            />
            <ResultValue
              label="最大高さ"
              value={
                result.maxHeight < 0
                  ? '制限なし'
                  : result.maxHeight.toFixed(2)
              }
              unit={result.maxHeight < 0 ? '' : 'm'}
            />
            <ResultValue
              label="最大階数"
              value={`${result.maxFloors}`}
              unit="F"
            />
          </div>
        </div>
      )}

      {/* Floor-by-floor table */}
      {floorRows.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            階別面積表
          </h3>
          <div className="rounded bg-gray-800 border border-gray-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-750 border-b border-gray-700">
                  <th className="px-3 py-1.5 text-left text-gray-400 font-medium">階</th>
                  <th className="px-3 py-1.5 text-right text-gray-400 font-medium">階高</th>
                  <th className="px-3 py-1.5 text-right text-gray-400 font-medium">累積高さ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {floorRows.map((row) => (
                  <tr key={row.floor}>
                    <td className="px-3 py-1 text-gray-300">{row.floor}F</td>
                    <td className="px-3 py-1 text-right text-gray-300 font-mono">
                      {row.height.toFixed(1)}m
                    </td>
                    <td className="px-3 py-1 text-right text-gray-300 font-mono">
                      {row.cumulative.toFixed(1)}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={handlePdf}
          disabled={!result}
          className="flex-1 rounded bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          PDF出力
        </button>
        <button
          onClick={handleSave}
          disabled={!site || !zoning}
          className="flex-1 rounded bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          保存
        </button>
      </div>
    </div>
  );
}
