'use client';

import type { ZoningData, VolumeResult } from '@/engine/types';
import { MAX_HEIGHT_CAP } from '@/engine/constants';

interface PrintReportProps {
  zoning: ZoningData | null;
  result: VolumeResult | null;
  siteArea: number | null;
  floorHeights?: number[];
  latitude?: number;
}

const td = { padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' } as const;
const tdVal = { padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' as const } as const;
const tdBold = { ...tdVal, fontWeight: 'bold' as const };
const h2Style = { fontSize: '1.1rem', fontWeight: 'bold' as const, marginBottom: '0.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.25rem' };

export function PrintReport({ zoning, result, siteArea, floorHeights, latitude }: PrintReportProps) {
  if (!zoning || !result) return null;

  // Floor breakdown
  const floors = floorHeights && floorHeights.length > 0 ? floorHeights : [];
  const totalFloorHeight = floors.reduce((s, h) => s + h, 0);

  return (
    <div className="print-area hidden" style={{ background: 'white', color: 'black', padding: '2rem', fontFamily: 'serif' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        建築ボリュームチェック レポート
      </h1>
      <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1.5rem' }}>
        出力日: {new Date().toLocaleDateString('ja-JP')} | VolumeCheck
      </p>

      {/* Regulation Summary */}
      <h2 style={h2Style}>法規制サマリー</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <tbody>
          {siteArea != null && (
            <tr>
              <td style={td}>敷地面積</td>
              <td style={tdVal}>{siteArea.toFixed(2)} m²</td>
            </tr>
          )}
          <tr>
            <td style={td}>用途地域</td>
            <td style={tdVal}>{zoning.district}</td>
          </tr>
          <tr>
            <td style={td}>建ぺい率</td>
            <td style={tdVal}>{(zoning.coverageRatio * 100).toFixed(0)}%</td>
          </tr>
          <tr>
            <td style={td}>容積率</td>
            <td style={tdVal}>{(zoning.floorAreaRatio * 100).toFixed(0)}%</td>
          </tr>
          <tr>
            <td style={td}>防火地域</td>
            <td style={tdVal}>{zoning.fireDistrict}</td>
          </tr>
          <tr>
            <td style={td}>高度地区</td>
            <td style={tdVal}>{zoning.heightDistrict?.type ?? '指定なし'}</td>
          </tr>
          <tr>
            <td style={td}>絶対高さ制限</td>
            <td style={tdVal}>
              {zoning.absoluteHeightLimit !== null ? `${zoning.absoluteHeightLimit}m` : 'なし'}
            </td>
          </tr>
          <tr>
            <td style={td}>外壁後退</td>
            <td style={tdVal}>
              {zoning.wallSetback !== null ? `${zoning.wallSetback}m` : 'なし'}
            </td>
          </tr>
          {zoning.isCornerLot && (
            <tr>
              <td style={td}>角地緩和</td>
              <td style={tdVal}>適用（建ぺい率+10%）</td>
            </tr>
          )}
          {latitude != null && (
            <tr>
              <td style={td}>緯度</td>
              <td style={tdVal}>{latitude.toFixed(2)}°</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Shadow Regulation */}
      {zoning.shadowRegulation && (
        <>
          <h2 style={h2Style}>日影規制</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            <tbody>
              <tr>
                <td style={td}>測定面の高さ</td>
                <td style={tdVal}>{zoning.shadowRegulation.measurementHeight}m</td>
              </tr>
              <tr>
                <td style={td}>5mライン規制時間</td>
                <td style={tdVal}>{zoning.shadowRegulation.maxHoursAt5m}時間</td>
              </tr>
              <tr>
                <td style={td}>10mライン規制時間</td>
                <td style={tdVal}>{zoning.shadowRegulation.maxHoursAt10m}時間</td>
              </tr>
              <tr>
                <td style={td}>対象期間</td>
                <td style={tdVal}>冬至日 8:00〜16:00</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Calculation Results */}
      <h2 style={h2Style}>計算結果</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <tbody>
          <tr>
            <td style={td}>最大延べ面積</td>
            <td style={tdBold}>{result.maxFloorArea.toFixed(2)} m²</td>
          </tr>
          <tr>
            <td style={td}>最大建築面積</td>
            <td style={tdBold}>{result.maxCoverageArea.toFixed(2)} m²</td>
          </tr>
          <tr>
            <td style={td}>最大高さ</td>
            <td style={tdBold}>
              {Number.isFinite(result.maxHeight) ? `${result.maxHeight.toFixed(2)}m` : '制限なし'}
            </td>
          </tr>
          <tr>
            <td style={td}>計算上限</td>
            <td style={tdVal}>{MAX_HEIGHT_CAP.toFixed(0)}m</td>
          </tr>
          <tr>
            <td style={td}>最大階数</td>
            <td style={tdBold}>{result.maxFloors}F</td>
          </tr>
          {siteArea != null && siteArea > 0 && (
            <>
              <tr>
                <td style={td}>実効容積率</td>
                <td style={tdVal}>{((result.maxFloorArea / siteArea) * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={td}>実効建ぺい率</td>
                <td style={tdVal}>{((result.maxCoverageArea / siteArea) * 100).toFixed(1)}%</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Floor Breakdown */}
      {floors.length > 0 && (
        <>
          <h2 style={h2Style}>階別内訳</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '4px 8px', borderBottom: '2px solid #ccc', textAlign: 'left' }}>階</th>
                <th style={{ padding: '4px 8px', borderBottom: '2px solid #ccc', textAlign: 'right' }}>階高 (m)</th>
                <th style={{ padding: '4px 8px', borderBottom: '2px solid #ccc', textAlign: 'right' }}>FL高さ (m)</th>
              </tr>
            </thead>
            <tbody>
              {floors.map((h, i) => {
                const floorLevel = floors.slice(0, i).reduce((s, v) => s + v, 0);
                return (
                  <tr key={i}>
                    <td style={{ padding: '3px 8px', borderBottom: '1px solid #eee' }}>{i + 1}F</td>
                    <td style={{ padding: '3px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{h.toFixed(2)}</td>
                    <td style={{ padding: '3px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>GL+{floorLevel.toFixed(2)}</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 'bold', background: '#f9f9f9' }}>
                <td style={{ padding: '4px 8px', borderTop: '2px solid #ccc' }}>合計</td>
                <td style={{ padding: '4px 8px', borderTop: '2px solid #ccc', textAlign: 'right' }}>{totalFloorHeight.toFixed(2)}</td>
                <td style={{ padding: '4px 8px', borderTop: '2px solid #ccc', textAlign: 'right' }}></td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Reverse Shadow Info */}
      {result.reverseShadow && result.reverseShadow.contourLines.length > 0 && (
        <>
          <h2 style={h2Style}>逆日影ライン（日影高さ制限）</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '4px 8px', borderBottom: '2px solid #ccc', textAlign: 'left' }}>制限高さ</th>
                <th style={{ padding: '4px 8px', borderBottom: '2px solid #ccc', textAlign: 'right' }}>線分数</th>
              </tr>
            </thead>
            <tbody>
              {result.reverseShadow.contourLines.map((cl) => (
                <tr key={cl.height}>
                  <td style={{ padding: '3px 8px', borderBottom: '1px solid #eee' }}>{cl.height}m</td>
                  <td style={{ padding: '3px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{cl.segments.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1rem' }}>
            逆日影ラインは日影規制により各地点で許容される最大建物高さの等高線です。
          </p>
        </>
      )}

      {/* Disclaimer */}
      <div style={{ marginTop: '2rem', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.7rem', color: '#888' }}>
        <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>免責事項</p>
        <p>
          本レポートはVolumeCheckによる概算結果であり、法的な確認書類ではありません。
          実際の建築計画には、所管の行政機関への確認および建築士による法適合確認が必要です。
          計算結果は入力データの精度に依存し、特定建築物や地区計画等の個別規制は考慮されていない場合があります。
        </p>
      </div>
    </div>
  );
}
