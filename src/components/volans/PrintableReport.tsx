'use client';

import { useVolansResult } from '@/hooks/useVolansResult';
import { formatUpdatedAt, useVolansStore } from '@/stores/useVolansStore';

const fmt = (n: number) =>
  n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = (n: number) =>
  n.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Hidden printable layout activated via window.print(). Invisible on screen
 * (display:none under normal conditions) but becomes the only visible DOM
 * when @media print fires.
 */
/**
 * OSM-raster URL for a static map tile. Uses the standard Z/X/Y scheme.
 * At zoom 17, a single tile (~256px) is ~75 m across at Tokyo latitude —
 * enough context for a property-level report.
 */
function osmTileUrl(lat: number, lng: number, zoom = 17): string {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

export function PrintableReport() {
  const d = useVolansResult();
  const lat = useVolansStore((s) => s.lat);
  const lng = useVolansStore((s) => s.lng);
  const mapUrl = lat !== null && lng !== null ? osmTileUrl(lat, lng, 17) : null;

  return (
    <div
      id="volans-print-root"
      className="volans-print-only"
      style={{
        background: '#ffffff',
        color: '#111827',
        fontFamily: '"Noto Sans JP", sans-serif',
      }}
    >
      <div style={{ padding: '0 4mm' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderBottom: '2px solid #1c2230',
            paddingBottom: 6,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {d.projectName}
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
              解析レポート — VOLANS / 最大ボリュームを、一瞬で。
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>
            発行日: {formatUpdatedAt(d.updatedAt)}
          </div>
        </div>

        {mapUrl && (
          <Section title="1. 所在地">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                alignItems: 'stretch',
              }}
            >
              <div
                style={{
                  background: '#eef2f9',
                  border: '1px solid #e5e9f0',
                  borderRadius: 4,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapUrl}
                  alt="敷地位置"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* red marker at center */}
                <div
                  style={{
                    position: 'absolute',
                    left: 'calc(50% - 4px)',
                    top: 'calc(50% - 4px)',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#ef4444',
                    boxShadow: '0 0 0 2px #fff',
                  }}
                />
              </div>
              <table style={tableStyle}>
                <tbody>
                  <KV k="所在地" v={d.address} />
                  <KV
                    k="緯度経度"
                    v={`${lat!.toFixed(5)}, ${lng!.toFixed(5)}`}
                  />
                  <KV k="敷地面積" v={`${fmt(d.siteArea)} ㎡`} />
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2, textAlign: 'right' }}>
              地図: © OpenStreetMap contributors
            </div>
          </Section>
        )}

        <Section title="2. 計画概要">
          <table style={tableStyle}>
            <tbody>
              <KV k="所在地" v={d.address} />
              <KV k="敷地面積" v={`${fmt(d.siteArea)} ㎡`} />
              <KV k="用途地域" v={d.zoningName} />
              <KV
                k="建ぺい率 / 容積率"
                v={`${d.coverageRatioPct}% / ${d.floorAreaRatioPct}%`}
              />
              <KV k="前面道路" v={d.roadLabel} />
              <KV k="高度地区" v={d.heightDistrict} />
              <KV k="防火地域" v={d.fireDistrict} />
            </tbody>
          </table>
        </Section>

        <Section title="3. ボリューム比較">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Box color="#5d86d9" bg="#e4ecff" title="斜線案 (現行)">
              <Big>{fmt(d.slant.floorArea)} ㎡</Big>
              <Small>{d.slant.floors} 階 / 充足率 {fmt1(d.slant.farRatio)}%</Small>
            </Box>
            <Box color="#3eb883" bg="#e7f5ee" title="天空率案">
              <Big>{fmt(d.sky.floorArea)} ㎡</Big>
              <Small>{d.sky.floors} 階 / 充足率 {fmt1(d.sky.farRatio)}%</Small>
            </Box>
          </div>
          <div
            style={{
              marginTop: 6,
              padding: '6px 10px',
              background: '#fff0e0',
              border: '1px solid #f19342',
              borderRadius: 4,
              color: '#f19342',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            増加分: +{fmt(d.diff.floorArea)} ㎡ (+{fmt1(d.diff.pct)}%) / +{d.diff.floors} 階
          </div>
        </Section>

        <Section title="4. 天空率チェック">
          <table style={tableStyle}>
            <tbody>
              <KV k="測定点種類" v={d.skyCheck.type} />
              <KV
                k="測定点No."
                v={`${d.skyCheck.index} / ${d.skyCheck.total}`}
              />
              <KV k="天空率" v={d.skyCheck.value.toFixed(3)} />
              <KV k="基準率" v={d.skyCheck.baseline.toFixed(3)} />
              <KV
                k="参考 (天空率 − 基準率)"
                v={`+${d.skyCheck.margin.toFixed(3)} (+${d.skyCheck.marginPct.toFixed(1)}%)`}
                accent
              />
            </tbody>
          </table>
        </Section>

        <Section title="5. 主要チェック結果">
          <table style={{ ...tableStyle, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>項目</th>
                <th style={th}>判定</th>
                <th style={th}>注記</th>
              </tr>
            </thead>
            <tbody>
              {d.checks.map((c) => (
                <tr key={c.label}>
                  <td style={tdL}>{c.label}</td>
                  <td
                    style={{
                      ...tdR,
                      color: c.ok ? '#22a06b' : '#ef4444',
                      fontWeight: 600,
                    }}
                  >
                    {c.ok ? '適合' : '不適合'}
                  </td>
                  <td style={tdR}>{c.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div
          style={{
            marginTop: 12,
            paddingTop: 6,
            borderTop: '1px solid #e5e9f0',
            fontSize: 9,
            color: '#6b7280',
          }}
        >
          天空率計算は平成14年 国交省告示 第1350号に基づく方法で算定しています。
          {!d.skyEngineReal && '（本リリースでは天空率緩和量は推定値です）'}
        </div>
      </div>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 11,
  borderCollapse: 'collapse',
};
const tdL: React.CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid #e5e9f0',
  color: '#6b7280',
};
const tdR: React.CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid #e5e9f0',
  textAlign: 'right',
  color: '#111827',
};
const th: React.CSSProperties = {
  padding: '4px 8px',
  borderBottom: '2px solid #1c2230',
  textAlign: 'left',
  color: '#1c2230',
  fontSize: 10,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 4,
          color: '#1c2230',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <tr>
      <td style={tdL}>{k}</td>
      <td
        style={{
          ...tdR,
          color: accent ? '#22a06b' : '#111827',
          fontWeight: accent ? 600 : 400,
        }}
      >
        {v}
      </td>
    </tr>
  );
}

function Box({
  color,
  bg,
  title,
  children,
}: {
  color: string;
  bg: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: 8,
      }}
    >
      <div style={{ fontSize: 10, color: '#6b7280' }}>{title}</div>
      {children}
    </div>
  );
}

function Big({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 2 }}>
      {children}
    </div>
  );
}

function Small({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{children}</div>
  );
}
