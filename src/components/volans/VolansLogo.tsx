interface VolansLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  compact?: boolean;
}

export function VolansLogo({ size = 28, showText = true, compact = false, className }: VolansLogoProps) {
  return (
    <div className={['flex items-center gap-2', className].filter(Boolean).join(' ')}>
      <span
        className="inline-flex items-center justify-center rounded-lg"
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #3b6de1 0%, #22a06b 100%)',
        }}
        aria-hidden
      >
        <svg viewBox="0 0 32 32" width={size * 0.72} height={size * 0.72} fill="none">
          <path
            d="M6 7 L16 24 L26 7"
            stroke="#ffffff"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="24.5" cy="8" r="1.6" fill="#ffd87a" />
        </svg>
      </span>
      {showText && (
        <div className="leading-tight">
          <div
            className="font-semibold tracking-[0.08em] text-[13px]"
            style={{ color: 'var(--volans-text)' }}
          >
            VOLANS
          </div>
          {!compact && (
            <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
              最大ボリュームを、一瞬で。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
