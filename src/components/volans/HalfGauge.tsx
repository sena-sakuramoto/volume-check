interface HalfGaugeProps {
  value: number;
  baseline: number;
  ok?: boolean;
  size?: number;
  label?: string;
}

export function HalfGauge({ value, baseline, ok = true, size = 150, label = '適合' }: HalfGaugeProps) {
  const width = size;
  const height = size / 2 + 14;
  const cx = width / 2;
  const cy = size / 2;
  const r = cx - 10;
  const stroke = 10;

  // arc from 180deg to 0deg (half circle top)
  const startX = cx - r;
  const endX = cx + r;
  const startY = cy;

  const color = ok ? 'var(--volans-success)' : 'var(--volans-danger)';

  // progress arc: based on value (0-1), draw from left up to baseline proportion
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const valT = clamp(value);
  const baseT = clamp(baseline);

  // angle helper: t 0..1 → angle 180° (left) .. 0° (right)
  const pt = (t: number) => {
    const ang = Math.PI * (1 - t);
    return { x: cx + r * Math.cos(ang), y: cy - r * Math.sin(ang) };
  };
  const pValue = pt(valT);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {/* background arc */}
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${startY}`}
        stroke="var(--volans-border)"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
      />
      {/* value arc */}
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${pValue.x} ${pValue.y}`}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
      />
      {/* baseline tick */}
      {(() => {
        const p = pt(baseT);
        const ang = Math.PI * (1 - baseT);
        const dx = Math.cos(ang);
        const dy = -Math.sin(ang);
        const ox = p.x;
        const oy = p.y;
        const inner = { x: ox - dx * 4, y: oy - dy * 4 };
        const outer = { x: ox + dx * 8, y: oy + dy * 8 };
        return (
          <line
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="var(--volans-text)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        );
      })()}
      {/* label */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        fill={color}
      >
        {label}
      </text>
    </svg>
  );
}
