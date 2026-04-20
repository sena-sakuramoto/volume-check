'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';

export type ProgressStepState = 'pending' | 'running' | 'done' | 'error';

export interface ProgressStep {
  key: string;
  label: string;
  state: ProgressStepState;
  detail?: string;
}

interface AnalysisProgressOverlayProps {
  open: boolean;
  title?: string;
  steps: ProgressStep[];
  error?: string | null;
  onDismiss?: () => void;
}

/**
 * Full-screen modal overlay that walks the user through the multi-step
 * analysis pipeline. Each step shows a spinner while running, a check when
 * done, and a red dot if it errors. Non-blocking — user can still see the
 * app behind a soft scrim.
 */
export function AnalysisProgressOverlay({
  open,
  title = '解析を実行中',
  steps,
  error,
  onDismiss,
}: AnalysisProgressOverlayProps) {
  if (!open) return null;

  const allDone = steps.every((s) => s.state === 'done');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{
        background: 'rgba(15, 20, 32, 0.45)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 volans-msg-in"
        style={{
          background: 'var(--volans-surface)',
          border: `1px solid var(--volans-border-strong)`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
        }}
      >
        <div className="flex items-center gap-2">
          {allDone ? (
            <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--volans-success)' }} />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--volans-primary)' }} />
          )}
          <div className="text-[14px] font-semibold" style={{ color: 'var(--volans-text)' }}>
            {allDone ? '解析が完了しました' : title}
          </div>
        </div>

        <ol className="mt-4 flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-start gap-2">
              <StepIcon state={s.state} index={i + 1} />
              <div className="flex-1">
                <div
                  className="text-[12px]"
                  style={{
                    color: s.state === 'done'
                      ? 'var(--volans-text)'
                      : s.state === 'running'
                        ? 'var(--volans-text)'
                        : s.state === 'error'
                          ? 'var(--volans-danger)'
                          : 'var(--volans-muted)',
                    fontWeight: s.state === 'running' ? 600 : 400,
                  }}
                >
                  {s.label}
                </div>
                {s.detail && (
                  <div
                    className="text-[10px] tabular-nums"
                    style={{ color: 'var(--volans-muted)' }}
                  >
                    {s.detail}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        {error && (
          <div
            className="mt-3 rounded-md px-2.5 py-2 text-[11px]"
            style={{
              background: '#fdecec',
              color: 'var(--volans-danger)',
              border: `1px solid var(--volans-danger)`,
            }}
          >
            {error}
          </div>
        )}

        {(allDone || error) && onDismiss && (
          <button
            onClick={onDismiss}
            className="mt-4 w-full rounded-md py-2 text-[12px] font-medium text-white transition-colors hover:brightness-110"
            style={{ background: 'var(--volans-primary)' }}
          >
            {allDone ? '結果を開く' : '閉じる'}
          </button>
        )}
      </div>
    </div>
  );
}

function StepIcon({ state, index }: { state: ProgressStepState; index: number }) {
  if (state === 'done') {
    return (
      <span
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
        style={{ background: 'var(--volans-success-soft)' }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--volans-success)' }} />
      </span>
    );
  }
  if (state === 'running') {
    return (
      <span
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
        style={{ background: 'var(--volans-primary-soft)' }}
      >
        <Loader2
          className="h-3.5 w-3.5 animate-spin"
          style={{ color: 'var(--volans-primary)' }}
        />
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
        style={{ background: '#fdecec' }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--volans-danger)' }}
        />
      </span>
    );
  }
  return (
    <span
      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold"
      style={{
        background: 'var(--volans-surface-alt)',
        color: 'var(--volans-muted)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      {index}
    </span>
  );
}
