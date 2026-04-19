'use client';

import { useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useVolansStore } from '@/stores/useVolansStore';
import type { Point2D, Road, ZoningDistrict, FireDistrict } from '@/engine/types';

interface AnalyzeResponse {
  site?: {
    vertices: Array<{ x: number; y: number }>;
    area: number;
  };
  roads?: Array<{
    direction?: 'north' | 'south' | 'east' | 'west';
    width?: number;
    edgeVertexIndices?: [number, number];
    confidence?: 'high' | 'medium' | 'low';
    reasoning?: string;
  }>;
  zoning?: {
    district?: string | null;
    coverageRatio?: number | null;
    floorAreaRatio?: number | null;
    fireDistrict?: string | null;
  };
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
  error?: string;
}

const DISTRICT_MATCH: Record<string, ZoningDistrict> = {
  商業: '商業地域',
  近隣商業: '近隣商業地域',
  第一種低層住居: '第一種低層住居専用地域',
  第二種低層住居: '第二種低層住居専用地域',
  第一種中高層: '第一種中高層住居専用地域',
  第二種中高層: '第二種中高層住居専用地域',
  第一種住居: '第一種住居地域',
  第二種住居: '第二種住居地域',
  準住居: '準住居地域',
  田園住居: '田園住居地域',
  準工業: '準工業地域',
  工業専用: '工業専用地域',
  工業: '工業地域',
};

function mapDistrict(raw?: string | null): ZoningDistrict | null {
  if (!raw) return null;
  for (const [k, v] of Object.entries(DISTRICT_MATCH)) {
    if (raw.includes(k)) return v;
  }
  return null;
}

function mapFireDistrict(raw?: string | null): FireDistrict | null {
  if (!raw) return null;
  if (raw.includes('準防火')) return '準防火地域';
  if (raw.includes('防火')) return '防火地域';
  return '指定なし';
}

function bearingOf(d?: string): number {
  switch (d) {
    case 'north':
      return 0;
    case 'east':
      return 90;
    case 'south':
      return 180;
    case 'west':
      return 270;
    default:
      return 0;
  }
}

export function OcrBoundaryPicker() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(
    null,
  );
  const [fileName, setFileName] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setMessage({ kind: 'info', text: 'Gemini Vision で解析中…（10〜20秒）' });
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch('/api/analyze-site', {
        method: 'POST',
        body: fd,
      });
      const data = (await resp.json()) as AnalyzeResponse;
      if (!resp.ok || !data.site) {
        throw new Error(data.error ?? 'OCR に失敗しました');
      }

      // Apply to store
      const verts = data.site.vertices as Point2D[];
      const roads: Road[] =
        data.roads?.map((r) => {
          const i = r.edgeVertexIndices?.[0] ?? 0;
          const j = r.edgeVertexIndices?.[1] ?? 1;
          const A = verts[i];
          const B = verts[(j % verts.length + verts.length) % verts.length];
          const width = r.width && r.width > 0 ? r.width : 6;
          return {
            edgeStart: A,
            edgeEnd: B,
            width,
            centerOffset: width / 2,
            bearing: bearingOf(r.direction),
          };
        }) ?? [];

      useVolansStore.getState().setSiteFromCad(verts, {
        roadEdgeIndices:
          roads.length === 0 && data.roads
            ? data.roads
                .filter((r) => r.edgeVertexIndices)
                .map((r) => r.edgeVertexIndices as [number, number])
            : undefined,
      });

      // Then apply roads explicitly (setSiteFromCad re-orders verts but not applicable if we want explicit bearings)
      if (roads.length > 0) {
        useVolansStore.setState({ roads, updatedAt: new Date().toISOString() });
      }

      // Zoning
      if (data.zoning) {
        const current = useVolansStore.getState().zoning;
        const district = mapDistrict(data.zoning.district);
        const fire = mapFireDistrict(data.zoning.fireDistrict);
        useVolansStore.getState().setZoning({
          ...current,
          district: district ?? current.district,
          coverageRatio:
            data.zoning.coverageRatio !== null && data.zoning.coverageRatio !== undefined
              ? data.zoning.coverageRatio
              : current.coverageRatio,
          floorAreaRatio:
            data.zoning.floorAreaRatio !== null && data.zoning.floorAreaRatio !== undefined
              ? data.zoning.floorAreaRatio
              : current.floorAreaRatio,
          fireDistrict: fire ?? current.fireDistrict,
        });
      }

      const summary = [
        `敷地 ${verts.length} 頂点`,
        roads.length > 0 ? `道路 ${roads.length} 本` : null,
        data.zoning?.district ? `用途地域: ${data.zoning.district}` : null,
      ]
        .filter(Boolean)
        .join(' / ');
      setMessage({
        kind: 'ok',
        text: `OCR 完了（信頼度: ${data.confidence ?? '中'}）— ${summary}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '解析に失敗しました';
      setMessage({ kind: 'err', text: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-3"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div className="text-[12px] font-semibold" style={{ color: 'var(--volans-text)' }}>
        画像 / PDF 取込（測量図・概要書）
      </div>
      <label
        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-medium"
        style={{
          background: busy ? 'var(--volans-surface-alt)' : 'var(--volans-success-soft)',
          color: 'var(--volans-success)',
          border: `1px dashed var(--volans-success)`,
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {fileName ?? 'JPEG / PNG / PDF を選択'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
      {message && (
        <div
          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[11px]"
          style={{
            background:
              message.kind === 'ok'
                ? 'var(--volans-success-soft)'
                : message.kind === 'err'
                  ? '#fdecec'
                  : 'var(--volans-primary-soft)',
            color:
              message.kind === 'ok'
                ? 'var(--volans-success)'
                : message.kind === 'err'
                  ? 'var(--volans-danger)'
                  : 'var(--volans-primary-strong)',
          }}
        >
          {message.kind === 'ok' ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : message.kind === 'err' ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          ) : null}
          <span>{message.text}</span>
        </div>
      )}
      <div className="text-[10px]" style={{ color: 'var(--volans-muted)' }}>
        測量図・公図・概要書を Gemini Vision で解析し、敷地ポリゴン・道路・用途地域を自動入力します。
      </div>
    </div>
  );
}
