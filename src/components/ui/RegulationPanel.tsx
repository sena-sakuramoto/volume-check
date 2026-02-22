'use client';

import type { ZoningData, VolumeResult } from '@/engine/types';

interface RegulationPanelProps {
  zoning: ZoningData | null;
  result: VolumeResult | null;
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

export function RegulationPanel({ zoning, result }: RegulationPanelProps) {
  if (!zoning) {
    return (
      <div className="flex flex-col gap-4 p-3">
        <p className="text-sm text-gray-500 text-center py-8">
          住所を入力して法規制を取得してください
        </p>
      </div>
    );
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
              unit="m&sup2;"
            />
            <ResultValue
              label="最大建築面積"
              value={result.maxCoverageArea.toFixed(2)}
              unit="m&sup2;"
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

      {/* Action Buttons */}
      <div className="flex gap-2 mt-auto">
        <button className="flex-1 rounded bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 transition-colors">
          PDF出力
        </button>
        <button className="flex-1 rounded bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 transition-colors">
          保存
        </button>
      </div>
    </div>
  );
}
