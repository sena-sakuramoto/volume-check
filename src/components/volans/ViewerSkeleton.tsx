/**
 * Loading skeleton shown while the 3D viewer chunk + WebGL context boots.
 * Mimics the final viewer's framing (axes hint + envelope outline) so the
 * layout doesn't jump once the real scene mounts.
 */
export function ViewerSkeleton() {
  return (
    <div
      className="grid h-full w-full place-items-center"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 10%, rgba(59,109,225,0.05) 0%, transparent 60%), linear-gradient(180deg, #f2f5fa 0%, #e6eaf3 100%)',
      }}
    >
      <svg viewBox="0 0 240 160" width="220" height="150" className="volans-viewer-skeleton" aria-hidden>
        {/* ground grid */}
        {[...Array(5)].map((_, i) => (
          <line
            key={`h-${i}`}
            x1={20 + i * 8}
            y1={130 - i * 2}
            x2={220 - i * 8}
            y2={130 - i * 2}
            stroke="rgba(28,34,48,0.08)"
            strokeWidth={1}
          />
        ))}
        {/* slant envelope — red dashed */}
        <polygon
          points="80,120 160,120 150,30 90,30"
          fill="none"
          stroke="#ef4444"
          strokeWidth={1.4}
          strokeDasharray="4 3"
          opacity={0.7}
        />
        {/* sky-relaxed envelope — green dotted */}
        <polygon
          points="76,122 164,122 156,22 84,22"
          fill="none"
          stroke="#3eb883"
          strokeWidth={1.4}
          strokeDasharray="2 3"
          opacity={0.7}
        />
        {/* building block */}
        <g opacity={0.75}>
          <rect x="95" y="55" width="50" height="70" fill="#5d86d9" />
          <rect x="95" y="55" width="50" height="22" fill="#84adf0" />
        </g>
        {/* sun marker */}
        <circle cx="205" cy="28" r="5" fill="#ffd87a" opacity={0.9} />
        {/* spinner dot */}
        <circle cx="120" cy="150" r="3" fill="var(--volans-primary)">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div
        className="mt-3 text-[11px] tracking-wider"
        style={{ color: 'var(--volans-muted)' }}
      >
        3D シーンを構築中…
      </div>
    </div>
  );
}
