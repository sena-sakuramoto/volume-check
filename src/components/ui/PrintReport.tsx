'use client';

import type { ZoningData, VolumeResult } from '@/engine/types';

interface PrintReportProps {
  zoning: ZoningData | null;
  result: VolumeResult | null;
  siteArea: number | null;
}

export function PrintReport({ zoning, result, siteArea }: PrintReportProps) {
  if (!zoning || !result) return null;

  return (
    <div className="print-area hidden" style={{ background: 'white', color: 'black', padding: '2rem', fontFamily: 'serif' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        建築ボリュームチェック レポート
      </h1>
      <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1.5rem' }}>
        出力日: {new Date().toLocaleDateString('ja-JP')}
      </p>

      {/* Regulation Summary */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.25rem' }}>
        法規制サマリー
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <tbody>
          {siteArea && (
            <tr>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>敷地面積</td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{siteArea.toFixed(2)} m²</td>
            </tr>
          )}
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>用途地域</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{zoning.district}</td>
          </tr>
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>建ぺい率</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{(zoning.coverageRatio * 100).toFixed(0)}%</td>
          </tr>
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>容積率</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{(zoning.floorAreaRatio * 100).toFixed(0)}%</td>
          </tr>
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>防火地域</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{zoning.fireDistrict}</td>
          </tr>
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>絶対高さ制限</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
              {zoning.absoluteHeightLimit !== null ? `${zoning.absoluteHeightLimit}m` : 'なし'}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>外壁後退</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
              {zoning.wallSetback !== null ? `${zoning.wallSetback}m` : 'なし'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Calculation Results */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem', borderBottom: '1px solid #ccc', paddingBottom: '0.25rem' }}>
        計算結果
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <tbody>
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>最大延べ面積</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{result.maxFloorArea.toFixed(2)} m²</td>
          </tr>
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>最大建築面積</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{result.maxCoverageArea.toFixed(2)} m²</td>
          </tr>
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>最大高さ</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>
              {result.maxHeight < 0 ? '制限なし' : `${result.maxHeight.toFixed(2)}m`}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#555' }}>最大階数</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{result.maxFloors}F</td>
          </tr>
        </tbody>
      </table>

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
