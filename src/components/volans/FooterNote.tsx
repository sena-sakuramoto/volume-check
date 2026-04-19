import { VOLANS_DEMO } from '@/lib/volans-demo';

export function FooterNote() {
  return (
    <footer
      className="flex h-8 shrink-0 items-center justify-between px-4 text-[11px]"
      style={{
        background: 'var(--volans-surface)',
        borderTop: `1px solid var(--volans-border)`,
        color: 'var(--volans-muted)',
      }}
    >
      <span>{VOLANS_DEMO.footerNote}</span>
      <a
        href="#"
        className="underline-offset-2 hover:underline"
        style={{ color: 'var(--volans-primary)' }}
      >
        {VOLANS_DEMO.feedbackLink}
      </a>
    </footer>
  );
}
